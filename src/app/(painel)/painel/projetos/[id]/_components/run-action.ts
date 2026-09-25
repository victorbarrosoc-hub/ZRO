import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

type ServerAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

const UNAVAILABLE = "Não deu para salvar agora. Tente de novo em instantes.";

/**
 * Chama uma action fora de formulário (checkbox, select, botões de etapa).
 * Um erro inesperado (rede, banco ocupado) vira aviso em vez de derrubar a página;
 * redirect() e notFound() seguem para o Next.
 */
export async function callAction(action: ServerAction, fields: Record<string, string>): Promise<ActionResult> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    return (await action(null, fd)) ?? { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: UNAVAILABLE };
  }
}

/**
 * Para FormModal/ConfirmAction: mostra o aviso de sucesso assim que a action responde,
 * antes de a tela mudar. O ActionForm compartilhado avisa num efeito depois do render;
 * quando a própria resposta tira o botão da tela (excluir a linha, quitar o lançamento,
 * o primeiro item de uma lista vazia), o componente desmonta junto e o aviso se perde.
 * Também troca erro inesperado por um aviso. Não usar em actions que terminam em redirect().
 */
export function toastFirst(action: ServerAction): ServerAction {
  return async (prev, fd) => {
    let result: ActionResult;
    try {
      result = (await action(prev, fd)) ?? { ok: true };
    } catch (error) {
      unstable_rethrow(error);
      return { ok: false, error: UNAVAILABLE };
    }
    if (result.ok && result.message) toast.success(result.message);
    return result.ok ? { ...result, message: undefined } : result;
  };
}
