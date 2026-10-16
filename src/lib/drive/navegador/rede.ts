/**
 * O PUT na sessão do Google, direto do navegador. Sem Authorization (a URI da sessão já autoriza) e
 * sem Content-Length (o navegador põe). status 0 = rede caiu ou o CORS escondeu a resposta.
 * A URI da sessão nunca vai para log, console ou tela.
 */
import { consultaRange, contentRange } from "../protocolo";

export type RespostaPut = { status: number; range: string | null; texto: string; travou?: boolean };

export type PedidoPut = {
  inicio: number;
  /** Exclusivo. */
  fim: number;
  total: number;
  /** null = consulta ("bytes *\/T"). */
  corpo: Blob | null;
  aoProgresso?: (enviados: number) => void;
  sinal?: AbortSignal;
  /** Sem progresso por tanto tempo: derruba (status 0, travou). Padrão 45 s. */
  vigiaMs?: number;
};

export interface Rede {
  put(url: string, p: PedidoPut): Promise<RespostaPut>;
}

/** Abortado de propósito (pausa, cancelamento, troca de página). */
export class Abortado extends Error {
  constructor() {
    super("abortado");
    this.name = "Abortado";
  }
}

/**
 * Lê um cabeçalho só se o CORS deixar. getAllResponseHeaders() lista apenas os expostos, então um
 * escondido vira null sem o aviso "Refused to get unsafe header" no console.
 */
function cabecalhoExposto(xhr: XMLHttpRequest, nome: string): string | null {
  try {
    const todos = xhr.getAllResponseHeaders() || "";
    const m = new RegExp(`^${nome}:[ \\t]*(.*)$`, "im").exec(todos);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/** Navegador: XMLHttpRequest (tem progresso de envio). */
export function redeXHR(): Rede {
  return {
    put(url, p) {
      return new Promise<RespostaPut>((resolve, reject) => {
        if (p.sinal?.aborted) return reject(new Abortado());
        const xhr = new XMLHttpRequest();
        let ultimo = Date.now();
        let travou = false;
        const vigia = setInterval(() => {
          if (Date.now() - ultimo > (p.vigiaMs ?? 45_000)) {
            travou = true;
            xhr.abort();
          }
        }, 5000);
        const aoAbortar = () => xhr.abort();
        const fim = () => {
          clearInterval(vigia);
          p.sinal?.removeEventListener("abort", aoAbortar);
        };
        p.sinal?.addEventListener("abort", aoAbortar, { once: true });
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Range", p.corpo ? contentRange(p.inicio, p.fim, p.total) : consultaRange(p.total));
        if (p.corpo) {
          xhr.upload.onprogress = (e) => {
            ultimo = Date.now();
            p.aoProgresso?.(Math.min(e.loaded, p.fim - p.inicio));
          };
        }
        xhr.onprogress = () => {
          ultimo = Date.now();
        };
        xhr.onload = () => {
          fim();
          resolve({ status: xhr.status, range: cabecalhoExposto(xhr, "Range"), texto: xhr.responseText || "" });
        };
        xhr.onerror = () => {
          fim();
          resolve({ status: 0, range: null, texto: "" });
        };
        xhr.ontimeout = () => {
          fim();
          resolve({ status: 0, range: null, texto: "", travou: true });
        };
        xhr.onabort = () => {
          fim();
          if (p.sinal?.aborted && !travou) reject(new Abortado());
          else resolve({ status: 0, range: null, texto: "", travou: true });
        };
        try {
          xhr.send(p.corpo);
        } catch {
          fim();
          resolve({ status: 0, range: null, texto: "" });
        }
      });
    },
  };
}

/**
 * Node (testes): fetch. Simula o que o CORS faz no navegador: `esconderRange` (Range não exposto) e
 * `finalSemCors` (a resposta final do Google pode vir sem CORS: o navegador vê status 0).
 */
export function redeFetch(o: { esconderRange?: boolean; finalSemCors?: boolean; fetch?: typeof fetch } = {}): Rede {
  const f = o.fetch ?? fetch;
  return {
    async put(url, p) {
      if (p.sinal?.aborted) throw new Abortado();
      const corpo = p.corpo ? new Uint8Array(await p.corpo.arrayBuffer()) : new Uint8Array(0);
      try {
        const res = await f(url, {
          method: "PUT",
          headers: { "Content-Range": p.corpo ? contentRange(p.inicio, p.fim, p.total) : consultaRange(p.total) },
          body: corpo,
          redirect: "manual",
          signal: p.sinal,
        });
        const texto = await res.text();
        if (p.corpo) p.aoProgresso?.(p.fim - p.inicio);
        if (o.finalSemCors && (res.status === 200 || res.status === 201)) return { status: 0, range: null, texto: "" };
        return { status: res.status, range: o.esconderRange ? null : res.headers.get("range"), texto };
      } catch {
        if (p.sinal?.aborted) throw new Abortado();
        return { status: 0, range: null, texto: "" };
      }
    },
  };
}
