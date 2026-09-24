/**
 * Entende o link do vídeo (Vimeo, YouTube ou arquivo .mp4) e devolve
 * o endereço certo para tocar no site.
 */
export type ParsedVideo =
  | { kind: "file"; src: string }
  | { kind: "vimeo"; id: string; hash?: string; embed: string }
  | { kind: "youtube"; id: string; embed: string };

export function parseVideo(url: string | null | undefined): ParsedVideo | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;

  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(value) || value.startsWith("/")) {
    return { kind: "file", src: value };
  }

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?(?:[?#].*)?$/i);
  if (vimeo) {
    const [, id, pathHash] = vimeo;
    const queryHash = value.match(/[?&]h=([a-z0-9]+)/i)?.[1];
    const hash = pathHash ?? queryHash;
    const params = new URLSearchParams({ autoplay: "1", title: "0", byline: "0", portrait: "0", dnt: "1" });
    if (hash) params.set("h", hash);
    return { kind: "vimeo", id, hash, embed: `https://player.vimeo.com/video/${id}?${params}` };
  }

  const yt =
    value.match(/youtu\.be\/([\w-]{11})/) ??
    value.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)([\w-]{11})/);
  if (yt) {
    const id = yt[1];
    const params = new URLSearchParams({ autoplay: "1", rel: "0", modestbranding: "1", playsinline: "1" });
    return { kind: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?${params}` };
  }

  return null;
}
