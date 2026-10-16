"use client";

import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { bytesBR, tempoBR, velocidadeBR } from "@/lib/drive/bytes";
import type { Foto, ItemFila, LoteFila, Motor } from "@/lib/drive/navegador/motor";
import { cn } from "@/lib/utils";

/**
 * Progresso nas páginas públicas (docs/dev/drive.md §8.2 e §8.3): um bloco por envio, com o total,
 * a barra, Pausar/Continuar/Cancelar/Tentar de novo e a lista recolhida dos arquivos. O texto para
 * leitor de tela muda no máximo a cada 5 s.
 */

export const LOTES_FINAIS = new Set<LoteFila["estado"]>(["concluido", "parcial", "erro", "cancelado"]);

const botao =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-ui transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4";
export const estilos = {
  principal: cn(botao, "h-14 bg-white px-7 text-base font-medium text-void hover:bg-light"),
  secundario: cn(botao, "border border-line-strong text-light hover:border-white/40 hover:bg-white/[0.04]"),
  discreto: cn(botao, "text-ash hover:bg-white/[0.06] hover:text-light"),
  perigo: cn(botao, "border border-danger/40 text-danger hover:bg-danger/10"),
};

/** O texto acompanha `texto`, mas muda no máximo a cada `ms` (para aria-live). */
export function useAnuncio(texto: string, ms = 5000): string {
  const [anunciado, setAnunciado] = useState(texto);
  const ultimo = useRef(0);
  useEffect(() => {
    const espera = Math.max(0, ultimo.current + ms - Date.now());
    const t = setTimeout(() => {
      ultimo.current = Date.now();
      setAnunciado(texto);
    }, espera);
    return () => clearTimeout(t);
  }, [texto, ms]);
  return anunciado;
}

/** 0 a 100, sem chegar a 100 antes da hora. */
export function porcento(enviados: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((enviados / total) * 100));
}

/** "38% · 80,6 GB de 212,4 GB · 42 MB/s · faltam 52 min" */
export function textoDoProgresso(lote: LoteFila, total: Foto["total"]): string {
  const partes = [`${porcento(lote.bytesEnviados, lote.bytes)}%`, `${bytesBR(lote.bytesEnviados)} de ${bytesBR(lote.bytes)}`];
  if (lote.estado === "enviando" && total.velocidade > 0) partes.push(velocidadeBR(total.velocidade));
  if (lote.estado === "enviando" && total.restante != null) partes.push(`faltam ${tempoBR(total.restante)}`);
  return partes.join(" · ");
}

/** "1 arquivo" / "128 arquivos" */
export function arquivosBR(n: number): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "arquivo" : "arquivos"}`;
}

export function Barra({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]"
    >
      <div
        className="h-full rounded-full bg-white/80 shadow-[0_0_12px_rgb(255_255_255/0.5)] transition-[width] duration-500 ease-out-expo"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

/* ============================== Avisos da fila ============================== */

/** Sem internet e o aviso único da fila (limite do dia, Drive cheio, Google fora, link inativo). */
export function AvisosDaFila({ foto, motor }: { foto: Foto; motor: Motor }) {
  if (!foto.semInternet && !foto.aviso) return null;
  return (
    <div className="grid gap-3">
      {foto.semInternet ? (
        <Aviso>Sem internet. O envio continua sozinho quando a conexão voltar.</Aviso>
      ) : null}
      {foto.aviso ? (
        <Aviso
          acao={
            <button type="button" className={estilos.secundario} onClick={() => motor.tentarDeNovo()}>
              <RotateCcw aria-hidden />
              Tentar de novo
            </button>
          }
        >
          {foto.aviso}
        </Aviso>
      ) : null}
    </div>
  );
}

export function Aviso({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-4 rounded-card border border-line-strong bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ui text-light">{children}</p>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}

/* ============================== Um envio ============================== */

const ROTULO_ESTADO: Record<LoteFila["estado"], string> = {
  preparando: "Preparando",
  pergunta: "Antes de enviar",
  enviando: "Enviando",
  pausado: "Pausado",
  concluido: "Recebido",
  parcial: "Parcial",
  erro: "Não foi",
  cancelado: "Cancelado",
};

export function LotePublico({
  motor,
  foto,
  lote,
  titulo,
  concluido,
  pergunta,
  ios,
  aoEscolherDeNovo,
  rotuloEscolherDeNovo = "Escolher de novo",
}: {
  motor: Motor;
  foto: Foto;
  lote: LoteFila;
  /** "Rolo A003", "Áudio · Zoom F6", "Manual de marca". */
  titulo: string;
  /** Título, texto e ação quando tudo chegou. */
  concluido: React.ReactNode;
  /** A pergunta do servidor (mesmo cartão). */
  pergunta?: React.ReactNode;
  ios: boolean;
  aoEscolherDeNovo?: () => void;
  rotuloEscolherDeNovo?: string;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const itens = foto.itens.filter((i) => i.lote === lote.chave);
  const valor = porcento(lote.bytesEnviados, lote.bytes);
  const progresso = textoDoProgresso(lote, foto.total);
  const ativo = lote.estado === "enviando" || lote.estado === "pausado";
  const anuncio = useAnuncio(ativo ? `${titulo}: ${progresso}` : `${titulo}: ${ROTULO_ESTADO[lote.estado]}`);
  const nota = itens.find((i) => i.nota && (i.estado === "enviando" || i.estado === "conferindo" || i.estado === "preparando"))?.nota ?? null;
  const conferindo = lote.estado === "enviando" && itens.some((i) => i.estado === "conferindo") && !itens.some((i) => i.estado === "enviando");
  const escolherDeNovo = aoEscolherDeNovo ? (
    <button type="button" className={estilos.secundario} onClick={aoEscolherDeNovo}>
      {rotuloEscolherDeNovo}
    </button>
  ) : null;

  return (
    <section className="border-t border-line pt-10" aria-label={titulo}>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <p className="label text-mute">{conferindo ? "Conferindo" : ROTULO_ESTADO[lote.estado]}</p>

      {lote.estado === "concluido" ? (
        <div className="mt-4">{concluido}</div>
      ) : (
        <h2 className="mt-4 text-h2 break-words text-white">{titulo}</h2>
      )}

      {lote.estado === "preparando" ? <p className="mt-4 text-body-lg text-ash">Preparando o envio…</p> : null}

      {lote.estado === "pergunta" ? <div className="mt-6">{pergunta}</div> : null}

      {ativo ? (
        <div className="mt-6 grid gap-5">
          <p className="text-body-lg text-light">{conferindo ? "Conferindo no Drive…" : progresso}</p>
          <Barra valor={valor} rotulo={`Progresso de ${titulo}`} />
          {nota ? <p className="text-ui text-ash">{nota}</p> : null}
          {lote.estado === "enviando" ? (
            <p className="text-ui text-ash">{ios ? "Deixe esta tela aberta até terminar." : "Deixe esta página aberta até terminar."}</p>
          ) : (
            <p className="text-ui text-ash">Pausado. Toque em Continuar quando quiser: segue de onde parou.</p>
          )}
          {confirmar ? (
            <div className="grid gap-3 rounded-card border border-line-strong p-5">
              <p className="text-ui text-light">Cancelar este envio? O que já chegou fica com a ZRO.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={estilos.perigo}
                  onClick={() => {
                    setConfirmar(false);
                    motor.cancelar(lote.chave);
                  }}
                >
                  Cancelar envio
                </button>
                <button type="button" className={estilos.discreto} onClick={() => setConfirmar(false)}>
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {lote.estado === "pausado" ? (
                <button type="button" className={estilos.secundario} onClick={() => motor.continuar(lote.chave)}>
                  <Play aria-hidden />
                  Continuar
                </button>
              ) : (
                <button type="button" className={estilos.secundario} onClick={() => motor.pausar(lote.chave)}>
                  <Pause aria-hidden />
                  Pausar
                </button>
              )}
              <button type="button" className={estilos.discreto} onClick={() => setConfirmar(true)}>
                <X aria-hidden />
                Cancelar
              </button>
            </div>
          )}
        </div>
      ) : null}

      {lote.estado === "parcial" ? (
        <div className="mt-6 grid gap-5">
          <p className="text-body-lg text-ash">
            {lote.recebidos.toLocaleString("pt-BR")} de {arquivosBR(lote.arquivos)} chegaram. Toque em Tentar de novo no que faltou.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={estilos.principal} onClick={() => motor.tentarDeNovo(lote.chave)}>
              <RotateCcw aria-hidden />
              Tentar de novo
            </button>
            {escolherDeNovo}
          </div>
        </div>
      ) : null}

      {lote.estado === "erro" ? (
        <div className="mt-6 grid gap-5">
          <p className="text-body-lg text-ash" role="alert">
            {lote.erro ?? "Não deu para enviar. Toque em Tentar de novo."}
          </p>
          <div className="flex flex-wrap gap-3">
            {lote.arquivos > 0 ? (
              <button type="button" className={estilos.principal} onClick={() => motor.tentarDeNovo(lote.chave)}>
                <RotateCcw aria-hidden />
                Tentar de novo
              </button>
            ) : null}
            {escolherDeNovo}
          </div>
        </div>
      ) : null}

      {lote.estado === "cancelado" ? (
        <div className="mt-6 grid gap-5">
          <p className="text-body-lg text-ash">Envio cancelado. O que já tinha chegado fica com a ZRO.</p>
          {escolherDeNovo ? <div className="flex flex-wrap gap-3">{escolherDeNovo}</div> : null}
        </div>
      ) : null}

      {lote.ignorados.length ? (
        <p className="mt-5 text-caption text-mute">{textoIgnorados(lote.ignorados.length)}</p>
      ) : null}

      {itens.length ? <ListaDeArquivos itens={itens} /> : null}
    </section>
  );
}

/** "3 arquivos do sistema ficaram de fora (.DS_Store e parecidos)." */
export function textoIgnorados(n: number): string {
  return n === 1
    ? "1 arquivo do sistema ficou de fora (.DS_Store e parecidos)."
    : `${n.toLocaleString("pt-BR")} arquivos do sistema ficaram de fora (.DS_Store e parecidos).`;
}

/* ============================== Lista recolhida ============================== */

const ORDEM: Record<ItemFila["estado"], number> = {
  erro: 0,
  enviando: 1,
  conferindo: 2,
  preparando: 3,
  pausado: 4,
  fila: 5,
  cancelado: 6,
  concluido: 7,
  "ja-recebido": 8,
};
const MAX_LINHAS = 300;

function estadoDoItem(it: ItemFila): string {
  switch (it.estado) {
    case "fila":
      return "Na fila";
    case "preparando":
      return "Preparando";
    case "enviando":
      return `Enviando · ${porcento(it.enviado, it.tamanho)}%`;
    case "pausado":
      return "Pausado";
    case "conferindo":
      return "Conferindo no Drive…";
    case "concluido":
      return "No Drive";
    case "ja-recebido":
      return "Já estava na pasta";
    case "erro":
      return "Não foi";
    case "cancelado":
      return "Cancelado";
  }
}

export function ListaDeArquivos({ itens }: { itens: ItemFila[] }) {
  const [aberta, setAberta] = useState(false);
  const linhas = aberta ? [...itens].sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado]).slice(0, MAX_LINHAS) : [];
  return (
    <details className="group mt-8 rounded-card border border-line" onToggle={(e) => setAberta(e.currentTarget.open)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 text-ui text-ash transition-colors hover:text-light [&::-webkit-details-marker]:hidden">
        <span>Ver os arquivos ({itens.length.toLocaleString("pt-BR")})</span>
        <span className="text-mute transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      {aberta ? (
        <ul className="max-h-[420px] overflow-y-auto border-t border-line">
          {linhas.map((it) => (
            <li key={it.chave} className="grid gap-1 border-b border-line px-5 py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 truncate text-[14px] text-light" title={it.nome}>
                  {it.nome}
                </p>
                <p className={cn("shrink-0 text-[13px]", it.estado === "erro" ? "text-danger" : "text-mute")}>{estadoDoItem(it)}</p>
              </div>
              <p className="truncate text-[13px] text-mute">
                {[it.caminho, bytesBR(it.tamanho)].filter(Boolean).join(" · ")}
              </p>
              {it.erro ? <p className="text-[13px] text-ash">{it.erro}</p> : it.nota ? <p className="text-[13px] text-ash">{it.nota}</p> : null}
            </li>
          ))}
          {itens.length > MAX_LINHAS ? (
            <li className="px-5 py-3 text-[13px] text-mute">e mais {(itens.length - MAX_LINHAS).toLocaleString("pt-BR")}.</li>
          ) : null}
        </ul>
      ) : null}
    </details>
  );
}
