"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ChevronDown, FolderOpen, Pause, Play, RotateCcw, WifiOff, X } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/surface";
import { bytesBR, tempoBR, velocidadeBR } from "@/lib/drive/bytes";
import type { Foto, ItemFila, LoteFila, Motor } from "@/lib/drive/navegador/motor";
import { ehIOS } from "@/lib/drive/navegador/plataforma";
import { esquecerLote } from "@/lib/drive/navegador/retomar";
import type { Selecao } from "@/lib/drive/navegador/selecao";
import { transporteDaRota } from "@/lib/drive/navegador/transporte";
import { useMotor } from "@/lib/drive/navegador/use-motor";
import { cn } from "@/lib/utils";

/**
 * Fila de envio do painel (docs/dev/drive.md §6 e §7.1): um motor só para a tela de Arquivos, vivo
 * enquanto se navega entre pastas (?pasta= não remonta a página). Os bytes vão do navegador direto ao
 * Google pela rota fixa /painel/arquivos/api; quem confere e conclui é o servidor.
 */

const ROTA = "/painel/arquivos/api";
const ESCOPO = "painel";
const FINAIS = new Set<LoteFila["estado"]>(["concluido", "parcial", "cancelado", "erro"]);
const semAssinatura = () => () => {};

type Destino = { id: string; nome: string };
type FilaCtx = {
  motor: Motor;
  foto: Foto;
  enviar: (selecao: Selecao, pasta: Destino) => void;
  destinoDe: (lote: string) => Destino | undefined;
};

const Contexto = createContext<FilaCtx | null>(null);

export function useFila(): FilaCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("Componente de Arquivos fora do <FilaProvider>.");
  return ctx;
}

/** O aparelho é um iPhone ou iPad (só o navegador sabe; no servidor, não é). */
export function useEhIOS(): boolean {
  return useSyncExternalStore(semAssinatura, ehIOS, () => false);
}

const arquivosTexto = (n: number) => (n === 1 ? "1 arquivo" : `${n} arquivos`);

export function FilaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [transporte] = useState(() => transporteDaRota(ROTA));
  const { motor, foto } = useMotor({ transporte, escopo: ESCOPO, voz: "painel" });
  const destinos = useRef(new Map<string, Destino>());
  const estados = useRef(new Map<string, LoteFila["estado"]>());

  const enviar = useCallback(
    (selecao: Selecao, pasta: Destino) => {
      const chave = motor.adicionar(selecao, { tipo: "pasta", pastaId: pasta.id });
      destinos.current.set(chave, pasta);
      const n = selecao.arquivos.length;
      if (n) toast(`${arquivosTexto(n)} na fila para ${pasta.nome}.`);
    },
    [motor],
  );
  const destinoDe = useCallback((lote: string) => destinos.current.get(lote), []);

  // Lote que acabou: aviso e a lista da pasta atualiza (o arquivo novo aparece).
  useEffect(() => {
    let terminou = false;
    for (const l of foto.lotes) {
      const antes = estados.current.get(l.chave);
      estados.current.set(l.chave, l.estado);
      if (antes === undefined || antes === l.estado || FINAIS.has(antes)) continue;
      if (l.estado === "concluido") {
        toast.success("Arquivos no Drive.");
        terminou = true;
      } else if (l.estado === "parcial") {
        toast.warning(`${l.recebidos} de ${arquivosTexto(l.arquivos)} chegaram. Toque em Tentar de novo no que faltou.`);
        terminou = true;
      }
    }
    if (terminou) router.refresh();
  }, [foto.lotes, router]);

  // Sair da tela de Arquivos pausa os envios (dá para continuar escolhendo os mesmos arquivos): pergunta antes.
  useEffect(() => {
    if (!foto.ativo) return;
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("Os envios param se você sair desta tela. Sair mesmo assim?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [foto.ativo]);

  const valor = useMemo(() => ({ motor, foto, enviar, destinoDe }), [motor, foto, enviar, destinoDe]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/* ============================== Textos de estado ============================== */

function textoDoItem(it: ItemFila): string {
  switch (it.estado) {
    case "fila":
      return "Na fila";
    case "preparando":
      return "Preparando…";
    case "enviando":
      return `Enviando · ${bytesBR(it.enviado)} de ${bytesBR(it.tamanho)}`;
    case "pausado":
      return "Pausado";
    case "conferindo":
      return "Conferindo no Drive…";
    case "concluido":
      return "No Drive";
    case "ja-recebido":
      return "Já estava na pasta";
    case "cancelado":
      return "Cancelado";
    case "erro":
      return it.erro ?? "Não deu para enviar este arquivo. Toque em Tentar de novo.";
  }
}

function textoDoLote(l: LoteFila): { texto: string; tom: "ok" | "warn" | "danger" | "neutral" } {
  switch (l.estado) {
    case "preparando":
      return { texto: "Preparando…", tom: "neutral" };
    case "pergunta":
    case "enviando":
      return { texto: "Enviando", tom: "neutral" };
    case "pausado":
      return { texto: "Pausado", tom: "warn" };
    case "concluido":
      return { texto: "No Drive", tom: "ok" };
    case "parcial":
      return { texto: `${l.recebidos} de ${arquivosTexto(l.arquivos)} chegaram`, tom: "warn" };
    case "cancelado":
      return { texto: "Cancelado", tom: "neutral" };
    case "erro":
      return { texto: "Não enviado", tom: "danger" };
  }
}

function totalTexto(f: Foto): string {
  const partes = [`${bytesBR(f.total.enviados)} de ${bytesBR(f.total.bytes)}`];
  if (f.ativo && f.total.velocidade > 0) partes.push(velocidadeBR(f.total.velocidade));
  if (f.ativo && f.total.restante != null) partes.push(`faltam ${tempoBR(f.total.restante)}`);
  return partes.join(" · ");
}

function Barra({ valor, total, className }: { valor: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div
      className={cn("h-1 overflow-hidden rounded-full bg-white/[0.08]", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="h-full rounded-full bg-white/80 transition-[width] duration-500 ease-out-expo" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ============================== Fila ============================== */

export function Fila() {
  const { motor, foto } = useFila();
  const ios = useEhIOS();
  const [dispensados, setDispensados] = useState<string[]>([]);
  const retomaveis = foto.retomaveis.filter((r) => !dispensados.includes(r.loteId));
  const temFinais = foto.lotes.some((l) => l.estado === "concluido" || l.estado === "cancelado");
  const vazio = !foto.lotes.length && !retomaveis.length;

  return (
    <Card id="fila" className="min-w-0 scroll-mt-20">
      <CardHeader
        title="Envios"
        action={
          temFinais ? (
            <Button variant="ghost" size="sm" onClick={() => motor.limparConcluidos()}>
              Limpar concluídos
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6 sm:pb-6" aria-live="polite">
        {foto.precisaEntrar ? (
          <div className="grid gap-3 rounded-2xl border border-warn/35 bg-warn/[0.06] p-4">
            <p className="text-[14px] text-light">Sua sessão expirou. Entre de novo para continuar.</p>
            <div className="flex flex-wrap gap-2">
              <a href="/entrar?next=/painel/arquivos" target="_blank" rel="noreferrer" className={buttonClasses({ variant: "primary", size: "sm" })}>
                Entrar
              </a>
              <Button variant="secondary" size="sm" onClick={() => motor.continuar()}>
                <Play aria-hidden /> Continuar
              </Button>
            </div>
            <p className="text-[12px] text-mute">O login abre em outra aba. A fila espera aqui.</p>
          </div>
        ) : null}

        {foto.semInternet ? (
          <p className="flex items-start gap-2 text-[14px] text-warn" role="status">
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden /> Sem internet. Continua sozinho quando a conexão voltar.
          </p>
        ) : null}

        {foto.aviso ? (
          <p className="text-[14px] text-warn" role="alert">
            {foto.aviso}
          </p>
        ) : null}

        {retomaveis.length ? (
          <div className="grid gap-2 rounded-2xl border border-line p-4">
            <p className="text-[14px] text-light">
              {retomaveis.length === 1 ? "1 envio parou no meio." : `${retomaveis.length} envios pararam no meio.`} Escolha os mesmos arquivos
              para continuar.
            </p>
            <ul className="grid gap-1.5">
              {retomaveis.map((r) => (
                <li key={r.loteId} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-ash">
                    {r.rotulo || "Envio"} · {arquivosTexto(r.arquivos)} · {r.bytes ? Math.min(99, Math.floor((r.enviados / r.bytes) * 100)) : 0}%
                  </span>
                  <button
                    type="button"
                    className="grid size-10 shrink-0 place-items-center rounded-full text-mute hover:bg-white/[0.06] hover:text-light sm:size-8"
                    aria-label={`Esquecer o envio parado em ${r.rotulo || "pasta"}`}
                    onClick={() => {
                      esquecerLote(ESCOPO, r.loteId);
                      setDispensados((d) => [...d, r.loteId]);
                    }}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {vazio ? <p className="text-[14px] text-mute">Nada na fila. Escolha arquivos ou arraste para a lista.</p> : null}

        {foto.lotes.length ? (
          <div className="grid gap-2">
            <p className="text-[15px] text-light">{totalTexto(foto)}</p>
            <Barra valor={foto.total.enviados} total={foto.total.bytes} />
            {ios && foto.ativo ? <p className="text-[12px] text-mute">Deixe esta tela aberta até terminar.</p> : null}
          </div>
        ) : null}

        {foto.lotes.length ? (
          <ul className="grid gap-3">
            {[...foto.lotes].reverse().map((l) => (
              <LoteLinha key={l.chave} lote={l} itens={foto.itens.filter((i) => i.lote === l.chave)} />
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

function LoteLinha({ lote, itens }: { lote: LoteFila; itens: ItemFila[] }) {
  const { motor, destinoDe } = useFila();
  const [aberto, setAberto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const destino = destinoDe(lote.chave);
  const s = textoDoLote(lote);
  const andando = lote.estado === "enviando" || lote.estado === "preparando" || lote.estado === "pergunta";
  const comErro = itens.some((i) => i.estado === "erro");
  const podeTentar = lote.estado === "erro" || lote.estado === "parcial" || comErro;
  const final = lote.estado === "concluido" || lote.estado === "cancelado";

  // Na lista aberta: o que deu erro e o que está andando primeiro (no máximo 100 linhas).
  const ordem: Record<ItemFila["estado"], number> = {
    erro: 0,
    enviando: 1,
    conferindo: 1,
    preparando: 2,
    pausado: 3,
    fila: 4,
    concluido: 5,
    "ja-recebido": 5,
    cancelado: 6,
  };
  const visiveis = aberto ? [...itens].sort((a, b) => ordem[a.estado] - ordem[b.estado]).slice(0, 100) : [];

  return (
    <li className="rounded-2xl border border-line">
      <div className="grid gap-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] text-light">{lote.rotulo ?? destino?.nome ?? "Preparando…"}</p>
            <p className="mt-0.5 text-[12px] text-mute">
              {lote.recebidos} de {arquivosTexto(lote.arquivos)} · {bytesBR(lote.bytesEnviados)} de {bytesBR(lote.bytes)}
            </p>
          </div>
          <Badge tone={s.tom}>{s.texto}</Badge>
        </div>
        {!final ? <Barra valor={lote.bytesEnviados} total={lote.bytes} /> : null}
        {lote.erro ? (
          <p className="text-[13px] text-danger" role="alert">
            {lote.erro}
          </p>
        ) : null}
        {lote.ignorados.length ? (
          <p className="text-[12px] text-mute">
            {lote.ignorados.length === 1 ? "1 arquivo do sistema ignorado." : `${lote.ignorados.length} arquivos do sistema ignorados.`}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {andando ? (
            <Button variant="ghost" size="sm" className="h-10 sm:h-8" onClick={() => motor.pausar(lote.chave)}>
              <Pause aria-hidden /> Pausar
            </Button>
          ) : null}
          {lote.estado === "pausado" ? (
            <Button variant="secondary" size="sm" className="h-10 sm:h-8" onClick={() => motor.continuar(lote.chave)}>
              <Play aria-hidden /> Continuar
            </Button>
          ) : null}
          {podeTentar ? (
            <Button variant="secondary" size="sm" className="h-10 sm:h-8" onClick={() => motor.tentarDeNovo(lote.chave)}>
              <RotateCcw aria-hidden /> Tentar de novo
            </Button>
          ) : null}
          {lote.estado === "concluido" && destino ? (
            <Link href={`/painel/arquivos?pasta=${encodeURIComponent(destino.id)}`} className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 sm:h-8" })}>
              <FolderOpen aria-hidden /> Abrir
            </Link>
          ) : null}
          {!final ? (
            confirmar ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  className="h-10 sm:h-8"
                  onClick={() => {
                    motor.cancelar(lote.chave);
                    setConfirmar(false);
                  }}
                >
                  Cancelar envio
                </Button>
                <Button variant="ghost" size="sm" className="h-10 sm:h-8" onClick={() => setConfirmar(false)}>
                  Voltar
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="h-10 text-ash sm:h-8" onClick={() => setConfirmar(true)}>
                <X aria-hidden /> Cancelar
              </Button>
            )
          ) : null}
          {itens.length ? (
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              className="ml-auto inline-flex h-10 items-center gap-1 rounded-full px-2.5 text-[13px] text-mute hover:text-light sm:h-8"
            >
              {aberto ? "Esconder" : "Arquivos"} <ChevronDown className={cn("size-4 transition-transform duration-200", aberto && "rotate-180")} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {aberto ? (
        <ul className="max-h-80 overflow-y-auto border-t border-line px-3 py-2 sm:px-4">
          {visiveis.map((it) => (
            <li key={it.chave} className="grid gap-0.5 py-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-light" title={it.caminho ? `${it.caminho}/${it.nome}` : it.nome}>
                  {it.caminho ? <span className="text-mute">{it.caminho}/</span> : null}
                  {it.nome}
                </span>
                <span className="shrink-0 text-[12px] text-mute">{bytesBR(it.tamanho)}</span>
              </div>
              <span className={cn("text-[12px]", it.estado === "erro" ? "text-danger" : it.estado === "concluido" || it.estado === "ja-recebido" ? "text-ok" : "text-mute")}>
                {textoDoItem(it)}
                {it.nota && it.estado !== "erro" ? ` · ${it.nota}` : ""}
              </span>
            </li>
          ))}
          {itens.length > visiveis.length ? (
            <li className="py-1.5 text-[12px] text-mute">E mais {arquivosTexto(itens.length - visiveis.length)}.</li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

/* ============================== Faixa no celular ============================== */

/** No celular, a fila vira uma faixa fixa embaixo enquanto houver envio (toque para ver a fila). */
export function FaixaFila() {
  const { foto } = useFila();
  const pendente = foto.lotes.some((l) => !FINAIS.has(l.estado));
  if (!pendente) return null;
  const pct = foto.total.bytes ? Math.min(100, Math.floor((foto.total.enviados / foto.total.bytes) * 100)) : 0;
  return (
    <div className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 xl:hidden">
      <button
        type="button"
        onClick={() => document.getElementById("fila")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="grid w-full gap-2 rounded-2xl border border-line-strong bg-ink/95 px-4 py-3 text-left shadow-[0_16px_48px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl"
      >
        <span className="flex items-center justify-between gap-3 text-[13px]">
          <span className="truncate text-light">
            {foto.semInternet ? "Sem internet" : foto.precisaEntrar ? "Entre de novo para continuar" : foto.ativo ? `Enviando · ${pct}%` : "Envios pausados"}
          </span>
          <span className="shrink-0 text-mute">Ver fila</span>
        </span>
        <Barra valor={foto.total.enviados} total={foto.total.bytes} />
      </button>
    </div>
  );
}
