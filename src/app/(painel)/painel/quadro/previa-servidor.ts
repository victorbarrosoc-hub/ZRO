import "server-only";

/**
 * Prévia de link para a aba "Peça": o servidor abre o link e lê o título e a capa
 * (og:title, og:image...) ou, se o link já é o arquivo, o tipo dele.
 * Proteções: só http/https, nunca endereço interno (conferido em cada redirecionamento),
 * tempo curto, lê no máximo 512 KB e guarda a resposta por 1 h.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { PreviaServidor } from "./previa";

type Res = ({ ok: true } & PreviaServidor) | { ok: false; erro: string };

const MAX_BYTES = 512 * 1024;
const MAX_SALTOS = 4;
const TEMPO_MS = 6000;
const GUARDA_MS = 60 * 60 * 1000;
const guardado = new Map<string, { em: number; r: Res }>();

/** Endereços que não são da internet aberta (rede interna, a própria máquina, nuvem). */
function ipInterno(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  const mapeado = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return ipInterno(mapeado[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

async function enderecoAberto(u: URL) {
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return false;
  if (u.port && !["80", "443"].includes(u.port)) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (isIP(host)) return !ipInterno(host);
  try {
    const ips = await lookup(host, { all: true, verbatim: true });
    return ips.length > 0 && ips.every((x) => !ipInterno(x.address));
  } catch {
    return false;
  }
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function texto(v: string | undefined, max = 300) {
  if (!v) return undefined;
  const t = v
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : undefined;
}

/** Lê as metatags da página (og:, twitter: e <title>). */
function metatags(html: string) {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const chave = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const valor = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
    if (chave && valor !== undefined && !(chave in meta)) meta[chave] = valor;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return { meta, title };
}

function absoluto(v: string | undefined, onde: URL) {
  if (!v) return undefined;
  try {
    const u = new URL(texto(v, 2000) ?? "", onde);
    return /^https?:$/.test(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

async function lerAte(res: Response, max: number) {
  const leitor = res.body?.getReader();
  if (!leitor) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await leitor.read();
    if (done || !value) break;
    partes.push(value);
    total += value.byteLength;
  }
  await leitor.cancel().catch(() => {});
  const tudo = new Uint8Array(Math.min(total, max));
  let pos = 0;
  for (const p of partes) {
    const pedaco = p.subarray(0, Math.max(0, tudo.length - pos));
    tudo.set(pedaco, pos);
    pos += pedaco.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(tudo);
}

const CABECALHOS = {
  "User-Agent": "Mozilla/5.0 (compatible; ZRO-Previa/1.0; +https://zrofilmes.vercel.app)",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
};

async function abrir(inicio: URL): Promise<{ res: Response; final: URL } | null> {
  let atual = inicio;
  for (let i = 0; i <= MAX_SALTOS; i++) {
    if (!(await enderecoAberto(atual))) return null;
    const res = await fetch(atual, { headers: CABECALHOS, redirect: "manual", signal: AbortSignal.timeout(TEMPO_MS), cache: "no-store" });
    if (res.status >= 300 && res.status < 400) {
      const para = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!para) return null;
      atual = new URL(para, atual);
      continue;
    }
    return { res, final: atual };
  }
  return null;
}

/** YouTube e Vimeo: a capa e o título vêm do oEmbed (a página costuma pedir JavaScript ou consentimento). */
async function oembed(u: URL): Promise<Res | null> {
  const yt = /(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname);
  if (!yt && !/(^|\.)vimeo\.com$/.test(u.hostname)) return null;
  const api = new URL(yt ? "https://www.youtube.com/oembed" : "https://vimeo.com/api/oembed.json");
  api.searchParams.set("url", u.href);
  api.searchParams.set(yt ? "format" : "width", yt ? "json" : "1280");
  const res = await fetch(api, { headers: CABECALHOS, signal: AbortSignal.timeout(TEMPO_MS), cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json().catch(() => null)) as { title?: string; thumbnail_url?: string; author_name?: string } | null;
  if (!j) return null;
  return { ok: true, titulo: texto(j.title), imagem: absoluto(j.thumbnail_url, api), site: yt ? "YouTube" : "Vimeo", descricao: texto(j.author_name) };
}

export async function previaLink(bruto: unknown): Promise<Res> {
  if (typeof bruto !== "string" || bruto.length > 2000) return { ok: false, erro: "formato" };
  let u: URL;
  try {
    u = new URL(bruto);
  } catch {
    return { ok: false, erro: "formato" };
  }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, erro: "formato" };

  const chave = u.href;
  const g = guardado.get(chave);
  if (g && Date.now() - g.em < GUARDA_MS) return g.r;

  let r: Res;
  try {
    r = (await oembed(u)) ?? (await pagina(u));
  } catch {
    r = { ok: false, erro: "sem_resposta" };
  }
  if (guardado.size > 500) guardado.delete(guardado.keys().next().value as string);
  guardado.set(chave, { em: Date.now(), r });
  return r;
}

async function pagina(u: URL): Promise<Res> {
  const aberto = await abrir(u);
  if (!aberto) return { ok: false, erro: "sem_acesso" };
  const { res, final } = aberto;
  const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  // o link já é o arquivo: basta o tipo
  if (tipo && !tipo.includes("html") && !tipo.includes("xml")) {
    await res.body?.cancel().catch(() => {});
    return { ok: true, mime: tipo };
  }
  // pediu login (Drive privado, por exemplo)
  if (/(^|\.)accounts\.google\.com$/.test(final.hostname) || /\/(login|signin|sign_in)\b/i.test(final.pathname)) {
    await res.body?.cancel().catch(() => {});
    return { ok: true, privado: true };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, erro: `http_${res.status}` };
  }
  const html = await lerAte(res, MAX_BYTES);
  const { meta, title } = metatags(html);
  const titulo = texto(meta["og:title"] ?? meta["twitter:title"] ?? title);
  return {
    ok: true,
    titulo: titulo && /^(google drive|sign in|fazer login)/i.test(titulo) ? undefined : titulo,
    descricao: texto(meta["og:description"] ?? meta["twitter:description"] ?? meta.description, 240),
    imagem: absoluto(meta["og:image:secure_url"] ?? meta["og:image"] ?? meta["twitter:image"] ?? meta["twitter:image:src"], final),
    site: texto(meta["og:site_name"], 60),
  };
}
