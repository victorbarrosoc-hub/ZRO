"use client";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:/data:) gerada no navegador */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  File as IconeArquivo,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Pause,
  Play,
  RotateCcw,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { bytesBR, tempoBR, velocidadeBR } from "@/lib/drive/bytes";
import { criarMotor, FOTO_VAZIA, type Foto, type ItemFila, type LoteFila, type Motor } from "@/lib/drive/navegador/motor";
import { deInput } from "@/lib/drive/navegador/selecao";
import { transporteDaRota } from "@/lib/drive/navegador/transporte";
import type { PastaPauta } from "./metodo";

/**
 * "Enviar aqui" dentro do card (aba Peça → Onde subir): o seletor do aparelho abre na hora e o envio
 * acontece no próprio card, com o mesmo motor do painel (/painel/arquivos/api; bytes do navegador direto
 * para o Google, conferência no servidor). Um motor só para a Pauta inteira: fechar a ficha não para o
 * envio, e o card na lista mostra o andamento. Ao fechar o lote, o servidor grava a mensagem e os links
 * no card (registrarEnvioNoCard), como no link do freela.
 */

const ESCOPO = "pauta";
const CHAVE_LOCAL = "zro.pauta.envio.v1";

/* ---------------- o motor da Pauta (um por página) ---------------- */

let motorPauta: Motor | null = null;
function motor(): Motor {
  motorPauta ??= criarMotor({ transporte: transporteDaRota("/painel/arquivos/api"), escopo: ESCOPO, voz: "painel" });
  return motorPauta;
}
const assinar = (fn: () => void) => motor().assinar(fn);
const fotoAgora = () => motor().foto();
const fotoServidor = () => FOTO_VAZIA;

/** A fila de envio da Pauta (todas as fichas). */
export function useEnvioPauta(): { motor: () => Motor; foto: Foto } {
  const foto = useSyncExternalStore(assinar, fotoAgora, fotoServidor);
  return { motor, foto };
}

/** De que card e para onde é cada lote da fila (e os arquivos, para as prévias). */
const lotesDoCard = new Map<string, { cardId: string; destino: string; arquivos: File[] }>();

/** loteId → card, no aparelho: para avisar no card certo que um envio parou (retomada). */
type Salvo = Record<string, { cardId: string; destino: string; em: number }>;
function lerSalvos(): Salvo {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? "{}") as Salvo;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function salvar(loteId: string, cardId: string, destino: string) {
  try {
    const todos = lerSalvos();
    if (todos[loteId]) return;
    todos[loteId] = { cardId, destino, em: Date.now() };
    const recentes = Object.entries(todos)
      .sort((a, b) => b[1].em - a[1].em)
      .slice(0, 40);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(Object.fromEntries(recentes)));
  } catch {
    // sem armazenamento: o envio continua; só o aviso de retomada não aparece
  }
}

const FINAIS = new Set<LoteFila["estado"]>(["concluido", "parcial", "erro", "cancelado"]);
const porcento = (a: number, t: number) => (t > 0 ? Math.min(100, Math.floor((a / t) * 100)) : 0);
const arquivos = (n: number) => (n === 1 ? "1 arquivo" : `${n} arquivos`);

/** Os lotes deste card na fila. */
function lotesDe(foto: Foto, cardId: string): LoteFila[] {
  return foto.lotes.filter((l) => lotesDoCard.get(l.chave)?.cardId === cardId);
}

/* ---------------- botão ---------------- */

/** "Enviar aqui": abre o seletor do aparelho (no iPhone, Fotos ou Arquivos) e põe na fila do card. */
export function EnviarAqui({ cardId, pasta, destino }: { cardId: string; pasta: PastaPauta; destino: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="q-pil prim" data-acao="enviar-peca" onClick={() => ref.current?.click()}>
        <Upload size={14} aria-hidden /> Enviar aqui
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        data-campo="arquivos-peca"
        aria-label={`Arquivos para ${destino}`}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = ""; // os mesmos arquivos podem ser escolhidos de novo (é assim que um envio continua)
          if (!files.length) return;
          const selecao = deInput(files);
          if (!selecao.arquivos.length) return;
          const chave = motor().adicionar(selecao, { tipo: "pasta", pastaId: pasta.id, cardId });
          lotesDoCard.set(chave, { cardId, destino, arquivos: selecao.arquivos.map((a) => a.file) });
        }}
      />
    </>
  );
}

/* ---------------- no card da lista ---------------- */

/** Chip pequeno no card enquanto a peça sobe (a ficha pode estar fechada). */
export function IndicadorEnvio({ cardId }: { cardId: string }) {
  const { foto } = useEnvioPauta();
  const ativos = lotesDe(foto, cardId).filter((l) => !FINAIS.has(l.estado));
  if (!ativos.length) return null;
  const bytes = ativos.reduce((s, l) => s + l.bytes, 0);
  const env = ativos.reduce((s, l) => s + l.bytesEnviados, 0);
  const pausado = ativos.every((l) => l.estado === "pausado");
  return (
    <span className="q-chip q-chip-envio" title={pausado ? "Envio pausado" : "Enviando a peça"} data-envio-card={cardId}>
      <Upload size={11} aria-hidden /> {pausado ? "Pausado" : `${porcento(env, bytes)}%`}
    </span>
  );
}

/* ---------------- prévia ---------------- */

/** Ícone pelo tipo (ou pela extensão, quando o aparelho não diz o tipo). */
function iconeDo(tipo: string, nome: string) {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  const p = { size: 18 };
  if (tipo.startsWith("image/") || ["psd", "ai", "heic", "tif", "tiff", "dng", "cr2", "arw"].includes(ext)) return <FileImage {...p} />;
  if (tipo.startsWith("video/") || ["mov", "mp4", "mxf", "braw", "r3d", "m4v"].includes(ext)) return <FileVideo {...p} />;
  if (tipo.startsWith("audio/") || ["wav", "mp3", "aif", "aiff", "m4a"].includes(ext)) return <FileAudio {...p} />;
  if (["zip", "rar", "7z"].includes(ext)) return <FileArchive {...p} />;
  if (tipo.startsWith("text/") || ["pdf", "srt", "vtt", "txt", "doc", "docx"].includes(ext)) return <FileText {...p} />;
  return <IconeArquivo {...p} />;
}

/** Um quadro do vídeo, gerado no navegador (sem subir nada). null se o aparelho não conseguir. */
function quadroDoVideo(file: File): Promise<string | null> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let feito = false;
    const fim = (r: string | null) => {
      if (feito) return;
      feito = true;
      clearTimeout(t);
      v.removeAttribute("src");
      v.load();
      URL.revokeObjectURL(url);
      ok(r);
    };
    const t = setTimeout(() => fim(null), 8000);
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
      } catch {
        fim(null);
      }
    };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        const lado = 96;
        const k = Math.max(lado / (v.videoWidth || lado), lado / (v.videoHeight || lado));
        c.width = Math.round((v.videoWidth || lado) * k);
        c.height = Math.round((v.videoHeight || lado) * k);
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        fim(c.toDataURL("image/jpeg", 0.7));
      } catch {
        fim(null);
      }
    };
    v.onerror = () => fim(null);
    v.src = url;
  });
}

/** Miniatura: imagem pelo próprio arquivo, vídeo por um quadro, o resto pelo ícone do tipo. */
function Miniatura({ file, nome, tipo, comPrevia }: { file: File | null; nome: string; tipo: string; comPrevia: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !comPrevia) return;
    let vivo = true;
    let url: string | null = null;
    if (file.type.startsWith("image/") && !/heic|heif|tiff/.test(file.type)) {
      const u = URL.createObjectURL(file);
      url = u;
      void Promise.resolve().then(() => {
        if (vivo) setSrc(u);
      });
    } else if (file.type.startsWith("video/")) {
      void quadroDoVideo(file).then((r) => {
        if (vivo && r) setSrc(r);
      });
    }
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, comPrevia]);
  return (
    <span className="q-mini" aria-hidden>
      {src ? <img src={src} alt="" onError={() => setSrc(null)} /> : iconeDo(file?.type || tipo, nome)}
      {file?.type.startsWith("video/") && src ? <i className="q-mini-play" /> : null}
    </span>
  );
}

/* ---------------- a fila dentro do card ---------------- */

function estadoDoItem(it: ItemFila): string {
  switch (it.estado) {
    case "fila":
      return "Na fila";
    case "preparando":
      return "Preparando";
    case "enviando":
      return `${porcento(it.enviado, it.tamanho)}%`;
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

const ROTULO_LOTE: Record<LoteFila["estado"], string> = {
  preparando: "Preparando",
  pergunta: "Antes de enviar",
  enviando: "Enviando",
  pausado: "Pausado",
  concluido: "No Drive",
  parcial: "Parcial",
  erro: "Não foi",
  cancelado: "Cancelado",
};

function LoteDoCard({ l, foto, m }: { l: LoteFila; foto: Foto; m: Motor }) {
  const [confirmar, setConfirmar] = useState(false);
  const meta = lotesDoCard.get(l.chave);
  const itens = foto.itens.filter((i) => i.lote === l.chave);
  const valor = porcento(l.bytesEnviados, l.bytes);
  const ativo = l.estado === "enviando" || l.estado === "pausado" || l.estado === "preparando";
  const conferindo = l.estado === "enviando" && itens.length > 0 && itens.every((i) => ["conferindo", "concluido", "ja-recebido"].includes(i.estado));
  const partes = [`${valor}%`, `${bytesBR(l.bytesEnviados)} de ${bytesBR(l.bytes)}`];
  if (l.estado === "enviando" && foto.total.velocidade > 0) partes.push(velocidadeBR(foto.total.velocidade));
  if (l.estado === "enviando" && foto.total.restante != null) partes.push(`faltam ${tempoBR(foto.total.restante)}`);
  const nota = itens.find((i) => i.nota && ["enviando", "conferindo", "preparando"].includes(i.estado))?.nota;

  return (
    <div className="q-envio-lote" data-lote={l.estado}>
      <div className="q-envio-cab">
        <p>
          <b>{meta?.destino ?? l.rotulo ?? "Drive"}</b>
          <span className="q-mut"> · {arquivos(l.arquivos)}</span>
        </p>
        <span className={`q-envio-estado ${l.estado}`}>{conferindo ? "Conferindo" : ROTULO_LOTE[l.estado]}</span>
      </div>
      {ativo ? (
        <>
          <div className="q-barra-env" role="progressbar" aria-label={`Envio para ${meta?.destino ?? "o Drive"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor}>
            <i style={{ width: `${valor}%` }} />
          </div>
          <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
            {conferindo ? "Conferindo no Drive…" : l.estado === "preparando" ? "Preparando o envio…" : partes.join(" · ")}
          </p>
          {nota ? <p style={{ margin: 0, fontSize: 12.5 }}>{nota}</p> : null}
        </>
      ) : null}
      {l.estado === "concluido" ? (
        <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
          {arquivos(l.recebidos)} {l.recebidos === 1 ? "conferido" : "conferidos"} no Drive. Os links entraram na Peça.
        </p>
      ) : null}
      {l.estado === "parcial" ? (
        <p style={{ margin: 0, fontSize: 12.5 }}>
          {l.recebidos} de {arquivos(l.arquivos)} chegaram. Toque em Tentar de novo no que faltou.
        </p>
      ) : null}
      {l.estado === "erro" ? <p style={{ margin: 0, fontSize: 12.5 }}>{l.erro ?? "Não deu para enviar. Toque em Tentar de novo."}</p> : null}

      <ul className="q-envio-itens">
        {itens.slice(0, 60).map((it, i) => (
          <li key={it.chave} className={it.estado}>
            <Miniatura file={meta?.arquivos[i] ?? null} nome={it.nome} tipo="" comPrevia={i < 24} />
            <span className="q-envio-nome">
              <span title={it.nome}>{it.nome}</span>
              <small>
                {bytesBR(it.tamanho)} · {estadoDoItem(it)}
              </small>
              {it.estado === "enviando" || it.estado === "pausado" ? (
                <span className="q-barra-env fina" aria-hidden>
                  <i style={{ width: `${porcento(it.enviado, it.tamanho)}%` }} />
                </span>
              ) : null}
              {it.erro ? <small className="q-envio-erro">{it.erro}</small> : null}
            </span>
          </li>
        ))}
        {itens.length > 60 ? <li className="q-mut">e mais {itens.length - 60}.</li> : null}
      </ul>

      <div className="q-acoes">
        {l.estado === "enviando" ? (
          <button type="button" className="q-pil" data-acao="pausar-envio" onClick={() => m.pausar(l.chave)}>
            <Pause size={13} aria-hidden /> Pausar
          </button>
        ) : null}
        {l.estado === "pausado" ? (
          <button type="button" className="q-pil prim" data-acao="continuar-envio" onClick={() => m.continuar(l.chave)}>
            <Play size={13} aria-hidden /> Continuar
          </button>
        ) : null}
        {l.estado === "parcial" || l.estado === "erro" ? (
          <button type="button" className="q-pil prim" data-acao="tentar-envio" onClick={() => m.tentarDeNovo(l.chave)}>
            <RotateCcw size={13} aria-hidden /> Tentar de novo
          </button>
        ) : null}
        {ativo && !confirmar ? (
          <button type="button" className="q-pil" data-acao="cancelar-envio" onClick={() => setConfirmar(true)}>
            <X size={13} aria-hidden /> Cancelar
          </button>
        ) : null}
        {FINAIS.has(l.estado) && l.estado !== "parcial" && l.estado !== "erro" ? (
          <button type="button" className="q-pil" data-acao="limpar-envio" onClick={() => m.limparConcluidos()}>
            Limpar
          </button>
        ) : null}
      </div>
      {confirmar ? (
        <div className="q-envio-painel">
          <p style={{ margin: 0, fontSize: 12.5 }}>Cancelar este envio? O que já chegou fica no Drive.</p>
          <div className="q-acoes">
            <button
              type="button"
              className="q-pil perigo"
              data-acao="confirmar-cancelar-envio"
              onClick={() => {
                setConfirmar(false);
                m.cancelar(l.chave);
              }}
            >
              Cancelar envio
            </button>
            <button type="button" className="q-pil" onClick={() => setConfirmar(false)}>
              Voltar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A fila do card, logo abaixo das pastas. Avisos de rede valem para a fila inteira. */
export function FilaDaPeca({ cardId }: { cardId: string }) {
  const { foto, motor: m } = useEnvioPauta();
  const lotes = lotesDe(foto, cardId);
  const [dispensados, setDispensados] = useState<string[]>([]);
  const salvos: Salvo = typeof window === "undefined" ? {} : lerSalvos();

  // Lote com número do servidor: o aparelho anota de que card ele é (retomada depois de recarregar).
  useEffect(() => {
    for (const l of lotes) {
      const meta = lotesDoCard.get(l.chave);
      if (l.loteId && meta) salvar(l.loteId, meta.cardId, meta.destino);
    }
  });

  const naFila = new Set(foto.lotes.map((l) => l.loteId).filter(Boolean));
  const parados = foto.retomaveis.filter((r) => salvos[r.loteId]?.cardId === cardId && !naFila.has(r.loteId) && !dispensados.includes(r.loteId));
  const ativo = lotes.some((l) => !FINAIS.has(l.estado));
  if (!lotes.length && !parados.length) return null;

  return (
    <div className="q-envio-fila" aria-live="polite">
      {ativo && foto.semInternet ? (
        <p className="q-envio-aviso">
          <WifiOff size={14} aria-hidden /> Sem internet. Continua sozinho quando a conexão voltar.
        </p>
      ) : null}
      {ativo && foto.aviso ? <p className="q-envio-aviso">{foto.aviso}</p> : null}
      {foto.precisaEntrar ? (
        <p className="q-envio-aviso">
          Sua sessão expirou. Entre de novo em outra aba e toque em Continuar.{" "}
          <button type="button" className="q-pil" onClick={() => m().continuar()}>
            Continuar
          </button>
        </p>
      ) : null}
      {parados.map((r) => (
        <div key={r.loteId} className="q-envio-aviso">
          <span>
            Um envio para {salvos[r.loteId]?.destino ?? "o Drive"} parou em {porcento(r.enviados, r.bytes)}%. Toque em Enviar aqui e escolha os mesmos
            arquivos: continua de onde parou.
          </span>
          <button type="button" className="q-pil" onClick={() => setDispensados((d) => [...d, r.loteId])}>
            Dispensar
          </button>
        </div>
      ))}
      {lotes.map((l) => (
        <LoteDoCard key={l.chave} l={l} foto={foto} m={m()} />
      ))}
      {ativo ? (
        <p className="q-mut" style={{ margin: 0, fontSize: 12 }}>
          Pode fechar a ficha: o envio continua enquanto a Pauta estiver aberta.
        </p>
      ) : null}
    </div>
  );
}
