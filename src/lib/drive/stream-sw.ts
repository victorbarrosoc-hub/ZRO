/**
 * Service worker da prévia do painel (docs/dev/drive.md §16), servido em /painel/stream/sw.js com escopo
 * /painel/stream/ (só isso: o resto do painel, a Pauta e os envios nunca passam por ele).
 *
 * <video>, <audio> e <img> não mandam Authorization. A página toca o vídeo dentro de um quadro em
 * /painel/stream/quadro (que este SW controla) apontando para /painel/stream/arquivo/<id>; aqui o pedido vai
 * direto para o Google (files/<id>?alt=media) com o token de acesso e o Range repassado, e volta em streaming.
 * Nada é guardado. O token vem de /painel/arquivos/token (sessão do painel) e fica só na memória deste SW.
 * Download (?baixar=1): a mesma leitura, com Content-Disposition: attachment.
 *
 * Texto puro (sem import): o navegador baixa este arquivo como está.
 */
export const VERSAO_SW = "zro-stream-v1";

export const CODIGO_SW = `// ${VERSAO_SW} · ZRO: prévia do Drive no painel (docs/dev/drive.md §16)
const ESCOPO = new URL("./", self.location).pathname; // "/painel/stream/"
const ARQUIVO = ESCOPO + "arquivo/";
const TOKEN = "/painel/arquivos/token";
const GOOGLE_API = "https://www.googleapis.com/drive/v3";
const LOCAL = new Set(["127.0.0.1", "localhost"]);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ARQUIVO)) return; // o resto segue direto
  event.respondWith(stream(event, url));
});

let acesso = null; // { token, api, expiraEm }: só em memória
let pedindo = null;

/** Só o Google (ou, no computador, um Google falso em 127.0.0.1/localhost). */
function apiPermitida(api) {
  if (api === GOOGLE_API) return true;
  try {
    const u = new URL(api);
    return LOCAL.has(self.location.hostname) && u.protocol === "http:" && LOCAL.has(u.hostname) && u.pathname === "/drive/v3";
  } catch {
    return false;
  }
}

async function pedirToken() {
  const r = await fetch(TOKEN, { headers: { "X-ZRO-Stream": "1" }, credentials: "same-origin", cache: "no-store", redirect: "manual" });
  if (r.type === "opaqueredirect") return { erro: "sessao" }; // sem sessão, o painel manda para /entrar
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) return { erro: r.status === 401 ? "sessao" : r.status === 409 ? "reconectar" : "google" };
  if (typeof j.token !== "string" || !apiPermitida(j.api)) return { erro: "google" };
  return { token: j.token, api: j.api, expiraEm: Number(j.expiraEm) || Date.now() + 5 * 60000 };
}

async function token(velho) {
  if (!velho && acesso && acesso.expiraEm - Date.now() > 30000) return acesso;
  if (velho && acesso && acesso.token !== velho) return acesso; // outro pedido já renovou
  acesso = null;
  if (!pedindo) pedindo = pedirToken().catch(() => ({ erro: "rede" })).finally(() => { pedindo = null; });
  const r = await pedindo;
  if (!r.erro) acesso = r;
  return r;
}

/** "bytes=a-b" | "bytes=a-" | "bytes=-n" → { inicio, fim } dentro do tamanho, ou null. */
function lerRange(cabecalho, tamanho) {
  const m = /^bytes=(\\d*)-(\\d*)$/.exec(String(cabecalho || "").trim());
  if (!m || (m[1] === "" && m[2] === "") || tamanho == null) return null;
  let inicio;
  let fim;
  if (m[1] === "") {
    inicio = Math.max(0, tamanho - Number(m[2]));
    fim = tamanho - 1;
  } else {
    inicio = Number(m[1]);
    fim = m[2] === "" ? tamanho - 1 : Math.min(Number(m[2]), tamanho - 1);
  }
  return inicio <= fim ? { inicio, fim } : null;
}

/** Content-Disposition com o nome em ASCII de reserva e o nome de verdade em UTF-8 (RFC 6266/5987). */
function disposicao(tipo, nome) {
  const ascii = nome.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^\\x20-\\x7e]|["\\\\%;]/g, "_") || "arquivo";
  const utf = encodeURIComponent(nome).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return tipo + '; filename="' + ascii + "\\"; filename*=UTF-8''" + utf;
}

function falha(status, texto) {
  return new Response(texto, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

async function stream(event, url) {
  let id = "";
  try {
    id = decodeURIComponent(url.pathname.slice(ARQUIVO.length));
  } catch {
    id = "";
  }
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(id)) return falha(404, "Arquivo não encontrado.");
  const p = url.searchParams;
  const tamanho = /^\\d+$/.test(p.get("s") || "") ? Number(p.get("s")) : null;
  const tipo = p.get("t") || "application/octet-stream";
  const nome = (p.get("n") || "arquivo").slice(0, 300);
  const baixar = p.get("baixar") === "1";
  const range = event.request.headers.get("Range");

  let velho = null;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const t = await token(velho);
    if (t.erro) {
      if (t.erro === "sessao") return falha(401, "Sua sessão expirou. Entre de novo.");
      if (t.erro === "reconectar") return falha(409, "A conexão com o Google expirou.");
      return falha(503, "O Google não respondeu.");
    }
    const cab = { Authorization: "Bearer " + t.token };
    if (range) cab.Range = range;
    let res;
    try {
      res = await fetch(t.api + "/files/" + encodeURIComponent(id) + "?alt=media&supportsAllDrives=true", {
        headers: cab,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        // Prévia: o player desistiu do pedaço (pulou para outro ponto), o pedido ao Google para junto.
        // Download não: o navegador passa o pedido para o gerenciador de downloads.
        signal: baixar ? undefined : event.request.signal,
      });
    } catch {
      return falha(504, "Sem conexão com o Google.");
    }
    if (res.status === 401 && tentativa === 0) {
      velho = t.token;
      continue;
    }
    if (!res.ok) {
      const h = { "Cache-Control": "no-store" };
      if (res.status === 416) h["Content-Range"] = res.headers.get("Content-Range") || (tamanho != null ? "bytes */" + tamanho : "bytes */*");
      return new Response(null, { status: res.status, headers: h });
    }
    const h = new Headers();
    h.set("Content-Type", res.headers.get("Content-Type") || tipo);
    h.set("Accept-Ranges", "bytes");
    h.set("Cache-Control", "no-store");
    h.set("X-Content-Type-Options", "nosniff");
    const len = res.headers.get("Content-Length");
    if (len) h.set("Content-Length", len);
    if (res.status === 206) {
      // Com CORS, o Content-Range do Google pode não ser legível: refaz pelo pedido e pelo tamanho do arquivo.
      let cr = res.headers.get("Content-Range");
      if (!cr) {
        const r = lerRange(range, tamanho);
        if (r) {
          const fim = len ? Math.min(r.fim, r.inicio + Number(len) - 1) : r.fim;
          cr = "bytes " + r.inicio + "-" + fim + "/" + tamanho;
          if (!len) h.set("Content-Length", String(fim - r.inicio + 1));
        }
      }
      if (cr) h.set("Content-Range", cr);
    } else if (!len && tamanho != null) {
      h.set("Content-Length", String(tamanho));
    }
    h.set("Content-Disposition", disposicao(baixar ? "attachment" : "inline", nome));
    return new Response(res.body, { status: res.status, statusText: res.status === 206 ? "Partial Content" : "OK", headers: h });
  }
  return falha(401, "O Google recusou o acesso.");
}
`;

/** Página mínima do quadro (o player põe o <video> aqui dentro). Sem script: quem mexe é a página do painel. */
export const HTML_QUADRO = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prévia</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video,audio{display:block;width:100%;height:100%;object-fit:contain;background:#000}</style>
</head><body></body></html>`;
