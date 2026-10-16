/**
 * Prévia no painel pelo service worker de /painel/stream/ (docs/dev/drive.md §16). Só no navegador.
 *
 * O SW tem escopo restrito: ele só cuida de quem está dentro de /painel/stream/. Por isso o vídeo toca dentro de
 * um quadro (/painel/stream/quadro), e as leituras que a página precisa fazer pelo SW (a foto original, o
 * "por que não tocou") também passam por um quadro escondido. Downloads são navegações para
 * /painel/stream/arquivo/<id>?baixar=1: o navegador entrega ao SW pelo endereço, e sem SW a rota do servidor
 * manda para o próprio Google.
 */

export const ESCOPO = "/painel/stream/";
export const QUADRO = "/painel/stream/quadro";
const SCRIPT = "/painel/stream/sw.js";

export type ArquivoStream = { id: string; nome: string; tipo: string; tamanho: number | null };

/** Endereço servido pelo SW. `baixar` = Content-Disposition: attachment. */
export function urlDeStream(a: ArquivoStream, baixar = false): string {
  const p = new URLSearchParams();
  if (a.tamanho != null) p.set("s", String(a.tamanho));
  if (a.tipo) p.set("t", a.tipo);
  p.set("n", a.nome || "arquivo");
  if (baixar) p.set("baixar", "1");
  return `${ESCOPO}arquivo/${encodeURIComponent(a.id)}?${p}`;
}

export function temServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && window.isSecureContext;
}

let preparo: Promise<boolean> | null = null;

/** Registra (uma vez) e espera o SW ficar ativo. false = sem SW (navegador antigo, modo privado do Firefox…). */
export function prepararStream(): Promise<boolean> {
  if (!temServiceWorker()) return Promise.resolve(false);
  if (!preparo) {
    preparo = (async () => {
      try {
        const reg = await navigator.serviceWorker.register(SCRIPT, { scope: ESCOPO, updateViaCache: "none" });
        const sw = reg.active ?? reg.waiting ?? reg.installing;
        if (!sw) return false;
        if (sw.state === "activated") return true;
        return await new Promise<boolean>((ok) => {
          const t = setTimeout(() => ok(reg.active?.state === "activated"), 8000);
          const ver = () => {
            if (sw.state === "activated") {
              clearTimeout(t);
              ok(true);
            } else if (sw.state === "redundant") {
              clearTimeout(t);
              ok(Boolean(reg.active));
            }
          };
          sw.addEventListener("statechange", ver);
          ver();
        });
      } catch {
        return false;
      }
    })().then((ok) => {
      if (!ok) preparo = null; // tenta de novo na próxima prévia
      return ok;
    });
  }
  return preparo;
}

/** O quadro está sob o SW? (um recarregar forçado, por exemplo, abre sem ele). */
export function quadroControlado(f: HTMLIFrameElement | null): boolean {
  try {
    const w = f?.contentWindow;
    return Boolean(w && w.location.pathname === QUADRO && w.navigator.serviceWorker?.controller);
  } catch {
    return false;
  }
}

let ponte: Promise<HTMLIFrameElement | null> | null = null;

/** Quadro escondido sob o SW, para a página ler pelo stream (foto original, diagnóstico). */
function quadroPonte(): Promise<HTMLIFrameElement | null> {
  if (!ponte) {
    ponte = prepararStream().then(
      (ok) =>
        new Promise<HTMLIFrameElement | null>((resolve) => {
          if (!ok) return resolve(null);
          const f = document.createElement("iframe");
          f.src = QUADRO;
          f.title = "";
          f.setAttribute("aria-hidden", "true");
          f.tabIndex = -1;
          f.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-10px;top:-10px";
          let tentou = false;
          f.addEventListener("load", () => {
            if (quadroControlado(f)) return resolve(f);
            if (!tentou) {
              tentou = true;
              f.src = `${QUADRO}?r=${Date.now()}`;
              return;
            }
            resolve(null);
          });
          document.body.appendChild(f);
        }),
    );
    ponte.then((f) => {
      if (!f) ponte = null;
    });
  }
  return ponte;
}

/** fetch pelo SW (dentro do quadro). null = sem SW. */
export async function buscarPeloStream(url: string, init?: RequestInit): Promise<Response | null> {
  const f = await quadroPonte();
  const w = f?.contentWindow as (Window & typeof globalThis) | null | undefined;
  if (!w) return null;
  return w.fetch(url, init);
}

/** Por que o vídeo não tocou: formato, sessão, Google ou rede (pergunta ao SW com 2 bytes). */
export async function porQueFalhou(a: ArquivoStream): Promise<"formato" | "sessao" | "reconectar" | "sumiu" | "rede"> {
  try {
    const r = await buscarPeloStream(urlDeStream(a), { headers: { Range: "bytes=0-1" }, cache: "no-store" });
    if (!r) return "rede";
    if (r.ok) return "formato";
    if (r.status === 401) return "sessao";
    if (r.status === 409) return "reconectar";
    if (r.status === 404 || r.status === 403) return "sumiu";
    return "rede";
  } catch {
    return "rede";
  }
}

/** Baixa pelo SW (navegação para o endereço com ?baixar=1: a página continua onde está). */
export function baixarPeloStream(a: ArquivoStream): void {
  const link = document.createElement("a");
  link.href = urlDeStream(a, true);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
