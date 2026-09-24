import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

type ServerAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * Mostra o aviso de sucesso assim que a action responde, antes de a tela mudar.
 *
 * O ActionForm compartilhado avisa num efeito depois do render. Quando a própria resposta
 * tira o botão da tela (excluir a linha, quitar o lançamento, o primeiro item de uma lista
 * vazia), o componente desmonta junto e o aviso se perde. Com isto, não.
 * Não usar em actions que terminam em redirect().
 */
export function toastFirst(action: ServerAction): ServerAction {
  return async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok && result.message) toast.success(result.message);
    return result.ok ? { ...result, message: undefined } : result;
  };
}
