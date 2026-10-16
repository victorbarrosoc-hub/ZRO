"use client";

import { Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Aviso,
  AvisosDaFila,
  LOTES_FINAIS,
  LotePublico,
  arquivosBR,
  estilos,
  porcento,
  textoIgnorados,
} from "@/components/envio/fila-publica";
import { Seletor, useEhIOS, useSemSolturaFora } from "@/components/envio/seletor";
import { Modal, ModalContent } from "@/components/ui/overlay";
import { bytesBR } from "@/lib/drive/bytes";
import type { LoteFila } from "@/lib/drive/navegador/motor";
import { impressao as calcularImpressao, type Selecao } from "@/lib/drive/navegador/selecao";
import { transporteDaRota } from "@/lib/drive/navegador/transporte";
import { useMotor } from "@/lib/drive/navegador/use-motor";
import { textoLimiteDiario } from "@/lib/drive/protocolo";
import type { DadosArea } from "@/lib/services/drive-publico";
import { cn } from "@/lib/utils";
import { renovarAcessoAction } from "./actions";
import { SenhaForm } from "./senha-form";

/**
 * Envio do cliente para a ZRO (docs/dev/drive.md §8.3): logo, manual de marca e referências vão para
 * 03 Assets/Do cliente/<data> · <assunto> do projeto escolhido, ou para "Arquivos da empresa". Pede o
 * aceite (LGPD). Se a senha da área cair no meio, uma janela pede de novo e a fila continua depois.
 */

const EMPRESA = "empresa";
type Escolha = { projetoId: string | null; assunto: string };

const chaveLocal = (linkId: string) => `zro.cliente.v1.${linkId}`;

function lerEscolhas(linkId: string): Record<string, Escolha & { em: number }> {
  try {
    const bruto = localStorage.getItem(chaveLocal(linkId));
    const v = bruto ? (JSON.parse(bruto) as Record<string, Escolha & { em: number }>) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function guardarEscolha(linkId: string, loteId: string, e: Escolha) {
  try {
    const todas = lerEscolhas(linkId);
    todas[loteId] = { ...e, em: Date.now() };
    const recentes = Object.entries(todas)
      .sort((a, b) => b[1].em - a[1].em)
      .slice(0, 30);
    localStorage.setItem(chaveLocal(linkId), JSON.stringify(Object.fromEntries(recentes)));
  } catch {
    // sem armazenamento: a retomada continua valendo pelos mesmos arquivos
  }
}

/** "2026-03-13" → "13/03" */
function diaMes(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function AreaCliente({
  token,
  linkId,
  projetos,
  googleOk,
  temSenha,
  limiteDiario,
  enviadoHoje,
  envios,
}: {
  token: string;
  linkId: string;
  projetos: { id: string; titulo: string; mes: string }[];
  googleOk: boolean;
  temSenha: boolean;
  limiteDiario: number | null;
  enviadoHoje: number;
  envios: DadosArea["envios"];
}) {
  const router = useRouter();
  const [transporte] = useState(() => transporteDaRota(`/cliente/${encodeURIComponent(token)}/api`));
  const { motor, foto } = useMotor({ transporte, escopo: `cliente:${linkId}`, voz: "publico" });
  useSemSolturaFora();
  const ios = useEhIOS();
  const idProjeto = useId();
  const idAssunto = useId();

  const [projeto, setProjeto] = useState(projetos.length === 1 ? projetos[0].id : "");
  const [assunto, setAssunto] = useState("");
  const [aceite, setAceite] = useState(false);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [marca, setMarca] = useState<{ s: Selecao; h: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [outro, setOutro] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [dispensados, setDispensados] = useState<string[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [janelaFechada, setJanelaFechada] = useState(false);
  const guardados = useRef(new Set<string>());
  const atualizados = useRef(new Set<string>());

  // Acesso com senha: renova o cookie de 30 dias também para quem só abre a área (uma vez por dia).
  useEffect(() => {
    if (temSenha) renovarAcessoAction(token).catch(() => {});
  }, [temSenha, token]);

  // O aparelho anota projeto e assunto de cada envio (para a retomada) e a lista "Você já enviou"
  // se atualiza quando um envio termina.
  useEffect(() => {
    let atualizar = false;
    for (const l of foto.lotes) {
      const e = escolhas[l.chave];
      if (l.loteId && e && !guardados.current.has(l.loteId)) {
        guardados.current.add(l.loteId);
        guardarEscolha(linkId, l.loteId, e);
      }
      if ((l.estado === "concluido" || l.estado === "parcial") && !atualizados.current.has(l.chave)) {
        atualizados.current.add(l.chave);
        atualizar = true;
      }
    }
    if (atualizar) router.refresh();
  }, [foto.lotes, escolhas, linkId, router]);

  const visiveis = foto.lotes.filter((l) => !ocultos.includes(l.chave));
  const emAndamento = foto.lotes.some((l) => !LOTES_FINAIS.has(l.estado));
  const mostrarFormulario = !emAndamento && (outro || visiveis.length === 0);
  const retomaveis = foto.retomaveis.filter((s) => !dispensados.includes(s.loteId));
  const impressaoAtual = marca && marca.s === selecao ? marca.h : null;
  const retomando = impressaoAtual ? foto.retomaveis.find((s) => s.impressao === impressaoAtual) : undefined;
  const bytesSelecao = selecao ? selecao.arquivos.reduce((s, a) => s + a.file.size, 0) : 0;
  const cabemHoje = limiteDiario != null ? Math.max(0, limiteDiario - enviadoHoje) : null;

  function escolher(s: Selecao) {
    setErro(null);
    if (!s.arquivos.length) {
      setSelecao(null);
      setErro("Nada para enviar: só havia arquivos do sistema.");
      return;
    }
    setSelecao(s);
    calcularImpressao(s)
      .then((h) => setMarca({ s, h }))
      .catch(() => {});
  }

  function enviar() {
    if (!projeto) return setErro("Escolha para qual projeto vão os arquivos.");
    const assuntoLimpo = assunto.trim();
    if (assuntoLimpo.length < 2) return setErro("Diga do que se trata (ex.: manual de marca).");
    if (!aceite) return setErro("Precisamos do seu ok para receber os arquivos.");
    if (!selecao?.arquivos.length) return setErro("Escolha os arquivos.");
    const projetoId = projeto === EMPRESA ? null : projeto;
    const chave = motor.adicionar(selecao, { tipo: "cliente", projetoId, assunto: assuntoLimpo, consentimento: true });
    setEscolhas((e) => ({ ...e, [chave]: { projetoId, assunto: assuntoLimpo } }));
    setSelecao(null);
    setErro(null);
    setOutro(false);
  }

  function enviarMais() {
    motor.limparConcluidos();
    setOcultos((o) => [...o, ...foto.lotes.filter((l) => l.estado === "erro" || l.estado === "cancelado").map((l) => l.chave)]);
    setSelecao(null);
    setAssunto("");
    setErro(null);
    setOutro(true);
  }

  function continuarEnvio(loteId: string) {
    const e = lerEscolhas(linkId)[loteId];
    enviarMais();
    if (e) {
      setProjeto(e.projetoId && projetos.some((p) => p.id === e.projetoId) ? e.projetoId : e.projetoId ? "" : EMPRESA);
      setAssunto(e.assunto);
    }
    requestAnimationFrame(() => document.getElementById("envie-arquivos")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function concluidoDo(l: LoteFila, ultimo: boolean) {
    const e = escolhas[l.chave];
    const n = l.recebidos;
    return (
      <div className="grid gap-5">
        <h2 className="flex items-center gap-4 text-h2 text-white">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-void" aria-hidden>
            <Check className="size-5" />
          </span>
          Recebido.
        </h2>
        <p className="max-w-xl text-body-lg text-ash">
          {arquivosBR(n)} {n === 1 ? "chegou" : "chegaram"} na pasta {e && !e.projetoId ? "da sua empresa" : "do projeto"}.
        </p>
        {ultimo && !mostrarFormulario ? (
          <div>
            <button type="button" className={estilos.principal} onClick={enviarMais}>
              Enviar mais
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="envie-para-a-zro" id="envie-arquivos" className="grid scroll-mt-8 gap-10">
      <div>
        <p className="label mb-4 text-mute">Envio</p>
        <h2 id="envie-para-a-zro" className="text-title text-white">
          Envie para a ZRO.
        </h2>
        <p className="mt-4 max-w-xl text-body-lg text-ash">Logo, manual de marca, referências. Vai direto para a pasta do projeto.</p>
      </div>

      {!googleOk ? (
        <p className="text-body-lg text-ash">Não dá para receber arquivos agora. Avise a ZRO.</p>
      ) : (
        <>
          {retomaveis.length > 0 && mostrarFormulario ? (
            <div className="grid gap-3">
              {retomaveis.map((s) => (
                <Aviso
                  key={s.loteId}
                  acao={
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={estilos.secundario} onClick={() => continuarEnvio(s.loteId)}>
                        <RotateCcw aria-hidden />
                        Continuar
                      </button>
                      <button type="button" className={estilos.discreto} onClick={() => setDispensados((d) => [...d, s.loteId])}>
                        Dispensar
                      </button>
                    </div>
                  }
                >
                  O envio “{s.rotulo}” parou em {porcento(s.enviados, s.bytes)}%. Escolha os mesmos arquivos para continuar.
                </Aviso>
              ))}
            </div>
          ) : null}

          <AvisosDaFila foto={foto} motor={motor} />

          {foto.precisaEntrar ? (
            temSenha ? (
              <>
                <Aviso
                  acao={
                    <button type="button" className={estilos.secundario} onClick={() => setJanelaFechada(false)}>
                      Digitar a senha
                    </button>
                  }
                >
                  Digite a senha da área para continuar. O envio espera e segue de onde parou.
                </Aviso>
                <Modal open={!janelaFechada} onOpenChange={(aberta) => setJanelaFechada(!aberta)}>
                  <ModalContent title="Digite a senha." description="O envio espera e segue de onde parou." size="sm">
                    <SenhaForm
                      token={token}
                      modo="modal"
                      aoEntrar={() => {
                        setJanelaFechada(false);
                        motor.continuar();
                      }}
                    />
                  </ModalContent>
                </Modal>
              </>
            ) : (
              <Aviso
                acao={
                  <button type="button" className={estilos.secundario} onClick={() => motor.continuar()}>
                    Continuar
                  </button>
                }
              >
                A conexão com a ZRO caiu. Toque em Continuar. Se não voltar, recarregue a página e escolha os mesmos arquivos.
              </Aviso>
            )
          ) : null}

          {visiveis.map((l, i) => (
            <div key={l.chave} className="motion-safe:animate-[sheet-in_500ms_cubic-bezier(0.16,1,0.3,1)_backwards]">
              <LotePublico
                motor={motor}
                foto={foto}
                lote={l}
                titulo={escolhas[l.chave]?.assunto ?? l.rotulo ?? "Arquivos"}
                concluido={concluidoDo(l, i === visiveis.length - 1)}
                ios={ios}
                aoEscolherDeNovo={mostrarFormulario ? undefined : enviarMais}
                rotuloEscolherDeNovo="Enviar mais"
              />
            </div>
          ))}

          {mostrarFormulario ? (
            <div className={cn("grid gap-6", visiveis.length ? "border-t border-line pt-10" : "")}>
              <div className="grid gap-2">
                <label htmlFor={idProjeto} className="text-caption text-ash">
                  Para qual projeto?
                </label>
                <div className="relative">
                  <select
                    id={idProjeto}
                    value={projeto}
                    onChange={(e) => {
                      setProjeto(e.target.value);
                      setErro(null);
                    }}
                    className="h-14 w-full appearance-none rounded-field border border-line-strong bg-white/[0.03] pr-12 pl-4 text-base text-light focus:border-white/50 focus:outline-none"
                  >
                    <option value="" disabled>
                      Escolha
                    </option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.titulo} · {p.mes}
                      </option>
                    ))}
                    <option value={EMPRESA}>Arquivos da empresa, sem projeto</option>
                  </select>
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ash"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor={idAssunto} className="text-caption text-ash">
                  Assunto
                </label>
                <input
                  id={idAssunto}
                  value={assunto}
                  onChange={(e) => {
                    setAssunto(e.target.value);
                    setErro(null);
                  }}
                  maxLength={80}
                  placeholder="Manual de marca"
                  autoComplete="off"
                  className="h-14 w-full rounded-field border border-line-strong bg-white/[0.03] px-4 text-base text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-ui leading-snug text-ash">
                <span className="relative mt-0.5 grid size-5 shrink-0">
                  <input
                    type="checkbox"
                    checked={aceite}
                    onChange={(e) => {
                      setAceite(e.target.checked);
                      setErro(null);
                    }}
                    className="peer size-5 cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-white/[0.03] transition-colors checked:border-white checked:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  />
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute inset-0 hidden p-[3px] text-void peer-checked:block"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                </span>
                <span>
                  Concordo que a ZRO guarde estes arquivos para o projeto, como explica a{" "}
                  <Link href="/privacidade" target="_blank" rel="noopener" className="text-light underline decoration-white/30 underline-offset-4">
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </label>

              {selecao ? (
                <div className="rounded-media border border-line-strong bg-white/[0.02] p-6 sm:p-8">
                  <p className="text-h3 text-white">
                    {arquivosBR(selecao.arquivos.length)} · {bytesBR(bytesSelecao)}
                  </p>
                  {retomando ? <p className="mt-4 text-ui text-ash">Continua o envio de onde parou.</p> : null}
                  {selecao.ignorados.length ? <p className="mt-3 text-caption text-mute">{textoIgnorados(selecao.ignorados.length)}</p> : null}
                  {cabemHoje != null && bytesSelecao > cabemHoje ? (
                    <p className="mt-3 text-ui text-light">{textoLimiteDiario(bytesBR(cabemHoje))}</p>
                  ) : null}
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button type="button" className={estilos.principal} onClick={enviar}>
                      Enviar
                    </button>
                    <button
                      type="button"
                      className={estilos.secundarioGrande}
                      onClick={() => {
                        setSelecao(null);
                        setErro(null);
                      }}
                    >
                      Trocar os arquivos
                    </button>
                  </div>
                </div>
              ) : (
                <Seletor
                  principal="arquivos"
                  rotuloPasta="Escolher pasta"
                  rotuloArquivos="Escolher arquivos"
                  textoSoltar="Ou arraste os arquivos para cá."
                  notaCelular={ios ? "Escolha pelo app Arquivos para mandar o vídeo original." : undefined}
                  onEscolher={escolher}
                />
              )}
              <p className="min-h-6 text-sm text-danger" role="alert" aria-live="polite">
                {erro ?? ""}
              </p>
            </div>
          ) : null}
        </>
      )}

      {envios.length ? (
        <div className="grid gap-4">
          <p className="label text-mute">Você já enviou</p>
          <ul className="border-t border-line">
            {envios.map((e, i) => (
              <li key={`${e.data}-${e.assunto}-${i}`} className="border-b border-line py-4">
                <p className="text-ui text-light">
                  {diaMes(e.data)} · {e.assunto} · {arquivosBR(e.arquivos)} · {bytesBR(e.bytes)}
                </p>
                {e.projeto ? <p className="mt-0.5 text-caption text-mute">{e.projeto}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
