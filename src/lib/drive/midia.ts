/**
 * Mídia dos arquivos do Drive (puro: navegador e servidor). Tipo de cada arquivo, o que o navegador toca,
 * proxy de câmera (mesmo nome-base em .mp4/.mov), tamanhos de miniatura e duração.
 * Prévia e miniaturas: docs/dev/drive.md §16.
 */

export type TipoMidia = "pasta" | "video" | "audio" | "imagem" | "pdf" | "legenda" | "doc" | "compactado" | "outro";

/** Dados de mídia que a grade e a prévia usam (vêm do Drive: hasThumbnail, videoMediaMetadata, imageMediaMetadata). */
export type InfoMidia = {
  /** O Drive tem miniatura deste arquivo (a rota do servidor busca). */
  miniatura: boolean;
  duracaoMs: number | null;
  largura: number | null;
  altura: number | null;
};

const PASTA = "application/vnd.google-apps.folder";
const GOOGLE = "application/vnd.google-apps.";

/** Brutos de câmera e contêineres profissionais: o navegador não toca (procura o proxy). */
export const BRUTOS = new Set(["braw", "r3d", "ari", "arx", "mxf", "crm", "cine", "avi", "mts", "m2ts", "mpg", "mpeg", "wmv", "flv", "dv", "vob"]);
const VIDEO = new Set(["mp4", "m4v", "mov", "webm", "mkv", "ogv", "3gp", "hevc", ...BRUTOS]);
const AUDIO = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "aif", "aiff", "bwf", "wma"]);
const AUDIO_NAO_TOCA = new Set(["aif", "aiff", "bwf", "wma"]);
const IMAGEM = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif", "tif", "tiff", "bmp", "dng", "cr2", "cr3", "nef", "arw", "raf", "exr", "psd", "svg"]);
/** Foto que abre direto no navegador (o original, depois da miniatura alta). */
export const FOTO_DIRETA = new Set(["jpg", "jpeg", "png", "webp"]);
const LEGENDA = new Set(["srt", "vtt", "scc", "stl", "ass", "ssa", "ttml", "dfxp"]);
const COMPACTADO = new Set(["zip", "rar", "7z", "tar", "gz", "tgz"]);
const DOC = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "key", "pages", "numbers", "txt", "rtf", "csv", "xml", "json", "prproj", "drp", "aep", "fcpxml"]);

/** Extensões de proxy, na ordem de preferência. */
export const EXT_PROXY = ["mp4", "mov", "m4v"] as const;
/** Subpastas onde as câmeras gravam o proxy (comparação sem maiúsculas). */
export const PASTAS_PROXY = ["proxy", "proxies"] as const;

/** Acima disso, o celular avisa antes de baixar. */
export const DOWNLOAD_GRANDE = 1_000_000_000;
/** Foto sem miniatura abre o próprio arquivo até este tamanho. */
export const FOTO_DIRETA_MAX = 40_000_000;

export function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i > 0 && i < nome.length - 1 ? nome.slice(i + 1).toLowerCase() : "";
}

/** "A001_C003.BRAW" → "a001_c003" (NFC, sem maiúsculas, sem a extensão). */
export function nomeBase(nome: string): string {
  const i = nome.lastIndexOf(".");
  return (i > 0 ? nome.slice(0, i) : nome).normalize("NFC").toLowerCase();
}

export function tipoDeMidia(a: { nome: string; tipo?: string | null; pasta?: boolean }): TipoMidia {
  const mime = (a.tipo ?? "").toLowerCase();
  if (a.pasta || mime === PASTA) return "pasta";
  const ext = extensao(a.nome);
  if (LEGENDA.has(ext)) return "legenda";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith(GOOGLE)) return "doc";
  if (VIDEO.has(ext) || mime.startsWith("video/") || mime === "application/mxf") return "video";
  if (AUDIO.has(ext) || mime.startsWith("audio/")) return "audio";
  if (IMAGEM.has(ext) || mime.startsWith("image/")) return "imagem";
  if (COMPACTADO.has(ext) || mime === "application/zip") return "compactado";
  if (DOC.has(ext) || mime.startsWith("text/")) return "doc";
  return "outro";
}

/**
 * O navegador pode tocar? "nao" = bruto de câmera (BRAW, R3D, ARRI, MXF…) ou áudio profissional.
 * "talvez" = .mov (H.264 toca; ProRes não, e só o próprio player descobre). O resto de vídeo e áudio: "sim".
 */
export function podeTocar(a: { nome: string; tipo?: string | null }): "sim" | "talvez" | "nao" {
  const t = tipoDeMidia(a);
  const ext = extensao(a.nome);
  if (t === "video") {
    if (BRUTOS.has(ext)) return "nao";
    return ext === "mov" || ext === "mkv" || ext === "hevc" ? "talvez" : "sim";
  }
  if (t === "audio") return AUDIO_NAO_TOCA.has(ext) ? "nao" : "sim";
  return "nao";
}

/** Vale procurar proxy? Bruto de câmera, ou um vídeo que tentou tocar e o navegador recusou (ProRes). */
export function precisaDeProxy(a: { nome: string; tipo?: string | null }, falhou = false): boolean {
  return tipoDeMidia(a) === "video" && (falhou || podeTocar(a) === "nao");
}

/** `cand` serve de proxy para `orig`? Mesmo nome-base, outro arquivo, .mp4/.mov/.m4v. */
export function ehProxyDe(cand: { id: string; nome: string; pasta?: boolean }, orig: { id: string; nome: string }): boolean {
  return (
    cand.id !== orig.id &&
    !cand.pasta &&
    (EXT_PROXY as readonly string[]).includes(extensao(cand.nome)) &&
    nomeBase(cand.nome) === nomeBase(orig.nome)
  );
}

/** O melhor proxy da lista (mp4 antes de mov antes de m4v), ou null. */
export function escolherProxy<T extends { id: string; nome: string; pasta?: boolean }>(candidatos: T[], orig: { id: string; nome: string }): T | null {
  const ordem = (n: string) => (EXT_PROXY as readonly string[]).indexOf(extensao(n));
  return candidatos.filter((c) => ehProxyDe(c, orig)).sort((a, b) => ordem(a.nome) - ordem(b.nome))[0] ?? null;
}

export function ehPastaDeProxy(nome: string): boolean {
  return (PASTAS_PROXY as readonly string[]).includes(nome.trim().toLowerCase());
}

/** Tamanhos de miniatura servidos (o resto arredonda para cima): cache melhor e nada de tamanho arbitrário. */
export const TAMANHOS_MINIATURA = [160, 320, 640, 1280, 2000] as const;

export function tamanhoMiniatura(px: number): number {
  const n = Number.isFinite(px) ? px : 320;
  return TAMANHOS_MINIATURA.find((t) => t >= n) ?? 2000;
}

/** Troca o "=s220" do fim do thumbnailLink pelo tamanho pedido (ou o "sz=w220" das miniaturas antigas). */
export function linkComTamanho(link: string, px: number): string {
  if (/=s\d+(-[\w-]+)?$/.test(link)) return link.replace(/=s\d+(-[\w-]+)?$/, `=s${px}`);
  if (/[?&]sz=w\d+/.test(link)) return link.replace(/([?&]sz=)w\d+/, `$1w${px}`);
  return link;
}

/** 83 → "1:23"; 3723 → "1:02:03". */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function duracaoBR(ms: number | null | undefined): string | null {
  return ms && ms > 0 ? relogio(ms / 1000) : null;
}

/** Os campos de mídia de um arquivo do Drive (JSON da API) no formato da ZRO. */
export function infoDeMidia(j: {
  hasThumbnail?: boolean;
  thumbnailLink?: string;
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string | number };
  imageMediaMetadata?: { width?: number; height?: number };
}): InfoMidia {
  const v = j.videoMediaMetadata;
  const im = j.imageMediaMetadata;
  const dur = v?.durationMillis != null ? Number(v.durationMillis) : null;
  return {
    miniatura: Boolean(j.hasThumbnail && j.thumbnailLink),
    duracaoMs: dur != null && Number.isFinite(dur) && dur > 0 ? dur : null,
    largura: v?.width ?? im?.width ?? null,
    altura: v?.height ?? im?.height ?? null,
  };
}

/* ------------------------------ vídeo pesado demais para a rede ------------------------------ */

/** Acima disso (Mb/s médios do arquivo), o original não chega em tempo real: no celular e no computador. */
export const TAXA_MAX_CELULAR_MBPS = 60;
export const TAXA_MAX_COMPUTADOR_MBPS = 400;
/** Em espera (ou o tempo andando sem quadro novo) por mais que isso: o player para e oferece o Drive. */
export const ESPERA_MAX_MS = 4000;

/** Taxa média do arquivo em Mb/s (tamanho × 8 / duração). null sem tamanho ou sem duração. */
export function taxaMbps(a: { tamanho: number | null; duracaoMs: number | null }): number | null {
  if (!a.tamanho || !a.duracaoMs || a.duracaoMs <= 0) return null;
  return (a.tamanho * 8) / (a.duracaoMs / 1000) / 1_000_000;
}

/**
 * Pesado demais para tocar pela rede? (ProRes 4K de 1,2 GB em 10 s ≈ 1 Gb/s congela no iPhone; o Drive toca
 * porque usa uma cópia leve que a API não entrega.) Sem duração conhecida: não dá para saber, tenta tocar
 * (o vigia de espera do player cobre).
 */
export function pesadoDemais(a: { tamanho: number | null; duracaoMs: number | null }, celular: boolean): boolean {
  const t = taxaMbps(a);
  return t != null && t > (celular ? TAXA_MAX_CELULAR_MBPS : TAXA_MAX_COMPUTADOR_MBPS);
}

/** Endereço do arquivo no Google Drive (no iPhone, abre o app do Drive). */
export function linkNoDrive(id: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
}

/** Player do próprio Drive (cópia leve do Google), para embutir em <iframe>. Só com link público. */
export function linkPreviaDoDrive(id: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
}
