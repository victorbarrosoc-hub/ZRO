/**
 * Conversa com a rota de envio da ZRO (/painel/arquivos/api, /enviar/<token>/api, /cliente/<token>/api).
 * fetch JSON com credentials "same-origin". Resposta que não é JSON (ou que veio de um redirecionamento,
 * como o do login) vira { erro: "sem_acesso" }: a tela pede para entrar de novo sem perder a fila.
 * Queda de rede lança FalhaDeRede (o motor espera e tenta de novo).
 */
import {
  MENSAGENS,
  type PedidoCancelar,
  type PedidoConferir,
  type PedidoDiagnostico,
  type PedidoFecharLote,
  type PedidoIniciar,
  type PedidoLote,
  type RespCancelar,
  type RespConferir,
  type RespDiagnostico,
  type RespErro,
  type RespFecharLote,
  type RespIniciar,
  type RespLote,
} from "../protocolo";

export interface Transporte {
  lote(p: PedidoLote): Promise<RespLote | RespErro>;
  iniciar(p: PedidoIniciar): Promise<RespIniciar | RespErro>;
  conferir(p: PedidoConferir): Promise<RespConferir | RespErro>;
  cancelar(p: PedidoCancelar): Promise<RespCancelar | RespErro>;
  fecharLote(p: PedidoFecharLote): Promise<RespFecharLote | RespErro>;
  diagnostico?(p: PedidoDiagnostico): Promise<RespDiagnostico | RespErro>;
  // pedaco(envioId, inicio, corpo): relay, reservado e não implementado (docs/dev/drive.md §5)
}

export class FalhaDeRede extends Error {
  constructor() {
    super("Sem conexão com a ZRO.");
    this.name = "FalhaDeRede";
  }
}

const PRECISA_ENTRAR: RespErro = { ok: false, erro: "sem_acesso", mensagem: "Entre de novo para continuar." };

export function transporteDaRota(url: string, o: { fetch?: typeof fetch } = {}): Transporte {
  const f = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  async function chamar<T>(corpo: object): Promise<T | RespErro> {
    let res: Response;
    try {
      res = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      throw new FalhaDeRede();
    }
    const tipo = res.headers.get("content-type") ?? "";
    if (res.redirected || !tipo.includes("application/json")) return PRECISA_ENTRAR;
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (res.status >= 500) return { ok: false, erro: "google", mensagem: MENSAGENS.publico.google };
      return PRECISA_ENTRAR;
    }
    if (!json || typeof json !== "object" || !("ok" in json)) return { ok: false, erro: "google", mensagem: MENSAGENS.publico.google };
    return json as T | RespErro;
  }
  return {
    lote: (p) => chamar<RespLote>(p),
    iniciar: (p) => chamar<RespIniciar>(p),
    conferir: (p) => chamar<RespConferir>(p),
    cancelar: (p) => chamar<RespCancelar>(p),
    fecharLote: (p) => chamar<RespFecharLote>(p),
    diagnostico: (p) => chamar<RespDiagnostico>(p),
  };
}
