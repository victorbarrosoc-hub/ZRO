"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, str, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/dal";
import { GB } from "@/lib/drive/bytes";
import { linkPorId } from "@/lib/queries/drive-painel";
import { areaDoCliente, definirLimite, definirSenha, desativarLink, trocarLink } from "@/lib/services/drive-links";

/**
 * Área do cliente (docs/dev/drive.md §7.4): um link por cliente, com senha opcional e limite de envio
 * por dia. Toda mudança confere que o link é a área DESTE cliente antes de mexer.
 */

const Id = z.string().trim().min(1).max(100);
const SENHA_CURTA = "A senha precisa de pelo menos 6 caracteres.";

function revalidarArea(clientId: string) {
  revalidatePath(`/painel/crm/clientes/${clientId}`);
}

/** Limite em GB por dia: em branco = sem limite; aceita vírgula. */
function lerLimite(fd: FormData): { ok: true; gb: number | null } | { ok: false } {
  const bruto = str(fd, "limite");
  if (!bruto) return { ok: true, gb: null };
  const n = Number(bruto.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return { ok: false };
  return { ok: true, gb: n };
}

/** A área ativa deste cliente (o id vem do formulário, mas só vale se for dele). */
async function areaDe(fd: FormData) {
  const clientId = Id.safeParse(str(fd, "clientId"));
  const linkId = Id.safeParse(str(fd, "linkId"));
  if (!clientId.success || !linkId.success) return null;
  const l = await linkPorId(linkId.data);
  if (!l || l.tipo !== "cliente-area" || l.clientId !== clientId.data || l.revogadoEm) return null;
  return { id: l.id, clientId: clientId.data };
}

export async function criarAreaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const clientId = Id.safeParse(str(fd, "clientId"));
  if (!clientId.success) return fail("Cliente não encontrado.");
  const senha = String(fd.get("senha") ?? "");
  if (senha && senha.length < 6) return fail(SENHA_CURTA, { senha: [SENHA_CURTA] });
  if (senha.length > 200) return fail("Senha longa demais.", { senha: ["Senha longa demais."] });
  const limite = lerLimite(fd);
  if (!limite.ok) return fail("Digite o limite em GB.", { limite: ["Digite o limite em GB (ex.: 20)."] });
  const r = await areaDoCliente(clientId.data, { criar: true, userId: user.id, senha: senha || null, limiteDiarioGB: limite.gb });
  if (!r.ok) return fail(r.mensagem);
  revalidarArea(clientId.data);
  return ok("Área do cliente criada.");
}

/** Definir ou trocar a senha (em branco tira). Quem já entrou precisa digitar de novo. */
export async function senhaAreaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const area = await areaDe(fd);
  if (!area) return fail("Área não encontrada.");
  const senha = String(fd.get("senha") ?? "");
  const tirar = fd.get("tirar") === "1";
  if (!tirar && senha.length < 6) return fail(SENHA_CURTA, { senha: [SENHA_CURTA] });
  if (senha.length > 200) return fail("Senha longa demais.", { senha: ["Senha longa demais."] });
  await definirSenha(area.id, tirar ? null : senha);
  revalidarArea(area.clientId);
  return ok(tirar ? "Senha tirada. A área abre só com o link." : "Senha salva. Quem já tinha entrado digita de novo.");
}

export async function limiteAreaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const area = await areaDe(fd);
  if (!area) return fail("Área não encontrada.");
  const limite = lerLimite(fd);
  if (!limite.ok) return fail("Digite o limite em GB.", { limite: ["Digite o limite em GB (ex.: 20)."] });
  await definirLimite(area.id, limite.gb == null ? null : limite.gb * GB);
  revalidarArea(area.clientId);
  return ok(limite.gb == null ? "Envio sem limite por dia." : "Limite salvo.");
}

export async function trocarLinkAreaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const area = await areaDe(fd);
  if (!area) return fail("Área não encontrada.");
  try {
    await trocarLink(area.id, user.id);
  } catch {
    return fail("Não deu para trocar o link. Tente de novo.");
  }
  revalidarArea(area.clientId);
  return ok("Link trocado. O antigo parou de funcionar.");
}

export async function desativarAreaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const area = await areaDe(fd);
  if (!area) return fail("Área não encontrada.");
  const r = await desativarLink(area.id, { userId: user.id, cancelarEnvios: fd.get("cancelarEnvios") === "on" });
  revalidarArea(area.clientId);
  return ok(
    r.cancelados
      ? `Área desativada. ${r.cancelados === 1 ? "1 envio cancelado" : `${r.cancelados} envios cancelados`}.`
      : "Área desativada.",
  );
}
