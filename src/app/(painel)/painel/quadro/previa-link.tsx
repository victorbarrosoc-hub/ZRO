"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, File, FileText, Film, Folder, Image as Imagem, Layers, Link2, Music, Play, type LucideIcon } from "lucide-react";
import { linkSeguro } from "./metodo";
import { ROTULO, entenderLink, nomeDoArquivo, tipoDaExt, type PreviaServidor, type TipoPeca } from "./previa";

const ICONE: Record<TipoPeca, LucideIcon> = {
  video: Film,
  foto: Imagem,
  audio: Music,
  design: Layers,
  pdf: FileText,
  doc: FileText,
  pasta: Folder,
  arquivo: File,
  pagina: Link2,
};

/** Uma pergunta por link enquanto a página estiver aberta (o servidor ainda guarda por 1 h). */
const perguntas = new Map<string, Promise<PreviaServidor | null>>();

function perguntar(url: string) {
  let p = perguntas.get(url);
  if (!p) {
    p = fetch("/painel/quadro/banco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "previa", url }),
      cache: "no-store",
      redirect: "manual",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((r: ({ ok: boolean } & PreviaServidor) | null) => (r?.ok ? r : null))
      .catch(() => null);
    perguntas.set(url, p);
  }
  return p;
}

function tipoDoMime(mime?: string): TipoPeca | null {
  if (!mime) return null;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/vnd.adobe.photoshop")) return "design";
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/zip") return "arquivo";
  return null;
}

/**
 * A peça como prévia: vídeo e áudio tocam ali mesmo, foto aparece, PSD e outros
 * arquivos mostram o tipo; links de página trazem título e capa.
 */
export function PreviaLink({ url: bruto, nome, onTirar }: { url: string; nome?: string; onTirar: () => void }) {
  const url = linkSeguro(bruto);
  const e = useMemo(() => (url ? entenderLink(url) : null), [url]);
  const [srv, setSrv] = useState<PreviaServidor | null | undefined>(e?.servidor ? undefined : null);
  const [tocando, setTocando] = useState(false);
  const [capaFalhou, setCapaFalhou] = useState(false);
  const [diretoFalhou, setDiretoFalhou] = useState(false);

  useEffect(() => {
    if (!e?.servidor) return;
    let vivo = true;
    perguntar(e.url).then((r) => vivo && setSrv(r));
    return () => {
      vivo = false;
    };
  }, [e]);

  if (!url || !e) {
    return (
      <div className="q-previa">
        <div className="q-previa-info">
          <span className="q-previa-txt">
            <b>{nome || "link"}</b>
          </span>
          <button type="button" className="q-x" data-acao="link-x" aria-label="Tirar link" onClick={onTirar}>
            ×
          </button>
        </div>
      </div>
    );
  }

  const extTitulo = srv?.titulo ? nomeDoArquivo(srv.titulo).ext : null;
  const tipo: TipoPeca =
    e.tipo !== "pagina" && e.tipo !== "arquivo"
      ? e.tipo
      : (tipoDaExt(extTitulo) ?? tipoDoMime(srv?.mime) ?? (e.player && e.fonte === "Google Drive" ? "arquivo" : e.tipo));
  const ext = e.ext ?? (tipoDaExt(extTitulo) ? extTitulo : null);
  const titulo = (nome && nome !== bruto && nome !== url ? nome : null) ?? srv?.titulo ?? e.arquivo ?? e.fonte;
  const capa = (!capaFalhou && e.capa) || (srv?.imagem && linkSeguro(srv.imagem)) || null;
  const Icone = ICONE[tipo];
  const carregando = srv === undefined && !e.capa && !e.direto;
  const direto = !diretoFalhou ? e.direto : null;
  const quadro = tipo === "pasta" ? "q-previa-midia alta" : "q-previa-midia";

  let midia: React.ReactNode = null;
  if (tocando && e.player) {
    midia = (
      <div className={quadro}>
        <iframe
          src={e.player}
          title={titulo}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  } else if (direto && tipo === "video") {
    midia = (
      <div className={quadro}>
        <video src={`${direto}#t=0.1`} controls playsInline preload="metadata" onError={() => setDiretoFalhou(true)} />
      </div>
    );
  } else if (direto && tipo === "foto") {
    midia = (
      <a className={quadro} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${titulo}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem de qualquer endereço, sem otimizar */}
        <img src={direto} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setDiretoFalhou(true)} />
      </a>
    );
  } else if (direto && tipo === "audio") {
    midia = (
      <div className="q-previa-audio">
        <span className="q-previa-ext" aria-hidden>
          <Music size={18} />
        </span>
        <audio src={direto} controls preload="metadata" onError={() => setDiretoFalhou(true)} />
      </div>
    );
  } else if (capa) {
    const conteudo = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- capa de outro site, sem otimizar */}
        <img
          src={capa}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => (capa === e.capa ? setCapaFalhou(true) : setSrv((s) => (s ? { ...s, imagem: undefined } : s)))}
        />
        {e.player ? (
          <span className="q-previa-play" aria-hidden>
            {tipo === "video" ? <Play size={22} fill="currentColor" /> : <Eye size={20} />}
          </span>
        ) : null}
      </>
    );
    midia = e.player ? (
      <button type="button" className={quadro} onClick={() => setTocando(true)} aria-label={tipo === "video" ? `Tocar ${titulo}` : `Ver ${titulo} aqui`}>
        {conteudo}
      </button>
    ) : (
      <a className={quadro} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${titulo}`}>
        {conteudo}
      </a>
    );
  } else if (carregando) {
    midia = <div className={`${quadro} carregando`} aria-hidden />;
  } else {
    // sem capa: o tipo do arquivo grande (PSD, PDF, ZIP...) e, se der, "ver aqui"
    midia = (
      <div className="q-previa-tipo">
        <span className="q-previa-ext">{ext ? ext.toUpperCase() : <Icone size={20} />}</span>
        <span className="q-previa-tipo-txt">
          {srv?.privado ? "Só abre para quem tem acesso" : ROTULO[tipo]}
          {e.player && !srv?.privado ? (
            <button type="button" className="q-pil" onClick={() => setTocando(true)}>
              <Eye size={14} /> Ver aqui
            </button>
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div className="q-previa">
      {midia}
      <div className="q-previa-info">
        <span className="q-previa-ico" aria-hidden>
          <Icone size={15} />
        </span>
        <span className="q-previa-txt">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {titulo}
          </a>
          <small>
            {ROTULO[tipo]}
            {ext && tipo !== "pagina" ? ` ${ext.toUpperCase()}` : ""} · {srv?.site && tipo === "pagina" ? srv.site : e.fonte}
            {srv?.privado ? " · pede acesso" : ""}
          </small>
        </span>
        <a className="q-x" href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir em outra aba">
          <ExternalLink size={14} />
        </a>
        <button type="button" className="q-x" data-acao="link-x" aria-label="Tirar link" onClick={onTirar}>
          ×
        </button>
      </div>
    </div>
  );
}
