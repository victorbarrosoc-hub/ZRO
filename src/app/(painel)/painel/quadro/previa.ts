/**
 * Prévia do link da peça: entende o que é cada link colado na aba "Peça"
 * (vídeo, foto, áudio, PSD, pasta do Drive...) e de onde vem.
 * Só monta endereços de player a partir de ids conferidos: nunca põe num iframe o link cru.
 */

export type TipoPeca = "video" | "foto" | "audio" | "design" | "pdf" | "doc" | "pasta" | "arquivo" | "pagina";

export type LinkEntendido = {
  url: string;
  /** De onde vem: "YouTube", "Google Drive", "Dropbox", "Frame.io" ou o domínio. */
  fonte: string;
  tipo: TipoPeca;
  /** Extensão do arquivo (PSD, MP4...), quando dá para saber pelo endereço. */
  ext: string | null;
  /** Nome do arquivo tirado do endereço. */
  arquivo: string | null;
  /** Capa conhecida sem perguntar ao servidor (YouTube, Drive). */
  capa: string | null;
  /** Player para tocar dentro da ficha (YouTube, Vimeo, Drive). */
  player: string | null;
  /** Endereço direto do arquivo, para <img>, <video> ou <audio>. */
  direto: string | null;
  /** Vale perguntar ao servidor (título, capa da página). */
  servidor: boolean;
};

const EXT: Record<string, TipoPeca> = {};
for (const e of ["mp4", "mov", "m4v", "webm", "mkv", "avi", "mxf", "prores"]) EXT[e] = "video";
for (const e of ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "tif", "tiff", "bmp", "raw", "cr2", "cr3", "arw", "nef", "dng"]) EXT[e] = "foto";
for (const e of ["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "aif", "aiff", "opus"]) EXT[e] = "audio";
for (const e of ["psd", "psb", "ai", "eps", "svg", "indd", "idml", "fig", "xd", "sketch", "aep", "prproj", "drp", "drt", "cdr", "afdesign", "afphoto"]) EXT[e] = "design";
EXT.pdf = "pdf";
for (const e of ["doc", "docx", "ppt", "pptx", "key", "xls", "xlsx", "numbers", "pages", "txt", "rtf", "srt", "csv"]) EXT[e] = "doc";
for (const e of ["zip", "rar", "7z"]) EXT[e] = "arquivo";

/** O navegador toca/mostra estes direto (o resto vira só o cartão com o tipo). */
const TOCA = new Set(["mp4", "m4v", "webm", "mov", "jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "opus"]);

export const ROTULO: Record<TipoPeca, string> = {
  video: "Vídeo",
  foto: "Foto",
  audio: "Áudio",
  design: "Arquivo de design",
  pdf: "PDF",
  doc: "Documento",
  pasta: "Pasta",
  arquivo: "Arquivo",
  pagina: "Link",
};

/** "video.final.MP4?x=1" → { nome: "video.final.MP4", ext: "mp4" } */
export function nomeDoArquivo(caminho: string) {
  const ultimo = caminho.split("/").filter(Boolean).pop() ?? "";
  let nome = ultimo;
  try {
    nome = decodeURIComponent(ultimo);
  } catch {
    /* endereço com % solto: fica como veio */
  }
  const m = nome.match(/\.([a-z0-9]{2,8})$/i);
  return { nome: nome || null, ext: m ? m[1].toLowerCase() : null };
}

export const tipoDaExt = (ext: string | null | undefined): TipoPeca | null => (ext ? (EXT[ext.toLowerCase()] ?? null) : null);

function base(url: string, fonte: string, extra: Partial<LinkEntendido> = {}): LinkEntendido {
  return { url, fonte, tipo: "pagina", ext: null, arquivo: null, capa: null, player: null, direto: null, servidor: true, ...extra };
}

export function entenderLink(bruto: string): LinkEntendido | null {
  let u: URL;
  try {
    u = new URL(bruto);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const url = u.href;

  // YouTube: capa e player sem perguntar a ninguém
  const yt =
    (host === "youtu.be" && u.pathname.match(/^\/([\w-]{11})/)?.[1]) ||
    (/(^|\.)youtube\.com$/.test(host) && (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]));
  if (yt && /^[\w-]{11}$/.test(yt)) {
    return base(url, "YouTube", {
      tipo: "video",
      capa: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      player: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`,
      servidor: true,
    });
  }

  // Vimeo: o player sai do id; a capa vem do servidor (oEmbed)
  if (/(^|\.)vimeo\.com$/.test(host)) {
    const m = u.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i);
    if (m) {
      const hash = m[2] ?? u.searchParams.get("h");
      const p = new URLSearchParams({ autoplay: "1", title: "0", byline: "0", portrait: "0", dnt: "1" });
      if (hash && /^[a-z0-9]+$/i.test(hash)) p.set("h", hash);
      return base(url, "Vimeo", { tipo: "video", player: `https://player.vimeo.com/video/${m[1]}?${p}` });
    }
    return base(url, "Vimeo");
  }

  // Google Drive e Docs: a capa e o "ver aqui" funcionam para arquivo compartilhado por link
  if (host === "drive.google.com" || host === "docs.google.com") {
    const pasta = u.pathname.match(/\/folders\/([\w-]{10,})/)?.[1];
    if (pasta) {
      return base(url, "Google Drive", { tipo: "pasta", player: `https://drive.google.com/embeddedfolderview?id=${pasta}#grid`, servidor: true });
    }
    const id = u.pathname.match(/\/d\/([\w-]{10,})/)?.[1] ?? u.searchParams.get("id");
    if (id && /^[\w-]{10,}$/.test(id)) {
      const doc = host === "docs.google.com" ? (u.pathname.split("/")[1] ?? "") : "";
      const tipo: TipoPeca = doc ? "doc" : "arquivo";
      const fonte = doc === "presentation" ? "Google Apresentações" : doc === "spreadsheets" ? "Google Planilhas" : doc === "document" ? "Google Docs" : "Google Drive";
      return base(url, fonte, {
        tipo,
        capa: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
        player: doc ? `https://docs.google.com/${doc}/d/${id}/preview` : `https://drive.google.com/file/d/${id}/preview`,
        servidor: true,
      });
    }
    return base(url, "Google Drive");
  }

  // Dropbox: troca o "baixar" pelo arquivo direto (raw=1) e decide pelo tipo
  if (/(^|\.)dropbox\.com$/.test(host) || host === "dropboxusercontent.com" || host.endsWith(".dropboxusercontent.com")) {
    const { nome, ext } = nomeDoArquivo(u.pathname);
    const tipo = tipoDaExt(ext);
    if (u.pathname.startsWith("/s/") || u.pathname.startsWith("/scl/fi/")) {
      const d = new URL(url);
      d.searchParams.delete("dl");
      d.searchParams.set("raw", "1");
      return base(url, "Dropbox", { tipo: tipo ?? "arquivo", ext, arquivo: nome, direto: ext && TOCA.has(ext) ? d.href : null, servidor: !tipo });
    }
    return base(url, "Dropbox", { tipo: tipo ?? "pagina", ext, arquivo: tipo ? nome : null });
  }

  const fonte =
    host === "f.io" || /(^|\.)frame\.io$/.test(host)
      ? "Frame.io"
      : host === "we.tl" || /(^|\.)wetransfer\.com$/.test(host)
        ? "WeTransfer"
        : /(^|\.)instagram\.com$/.test(host)
          ? "Instagram"
          : /(^|\.)tiktok\.com$/.test(host)
            ? "TikTok"
            : /(^|\.)behance\.net$/.test(host)
              ? "Behance"
              : /(^|\.)figma\.com$/.test(host)
                ? "Figma"
                : host;

  // Arquivo direto (termina em .mp4, .jpg, .psd...)
  const { nome, ext } = nomeDoArquivo(u.pathname);
  const tipo = tipoDaExt(ext);
  if (tipo) {
    return base(url, fonte, { tipo, ext, arquivo: nome, direto: ext && TOCA.has(ext) ? url : null, servidor: false });
  }
  if (fonte === "Figma") return base(url, fonte, { tipo: "design" });
  return base(url, fonte);
}

/** O que o servidor devolve sobre um link (título e capa da página, ou o tipo do arquivo). */
export type PreviaServidor = {
  titulo?: string;
  descricao?: string;
  imagem?: string;
  site?: string;
  /** Tipo do arquivo pelo cabeçalho (quando o link já é o arquivo). */
  mime?: string;
  /** O link pede login (Drive privado, por exemplo). */
  privado?: boolean;
};
