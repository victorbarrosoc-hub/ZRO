"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { whatsappDigits } from "@/lib/format";
import { CHAVES_DESTINO } from "@/lib/services/drive-card";
import {
  definirValidade,
  desativarLink,
  linkDoCard,
  textoWhatsAppCard,
  trocarDestinoDoCard,
  trocarLink,
  type EstadoLinkCard,
} from "@/lib/services/drive-links";

/**
 * Link de envio de um card da Pauta (docs/dev/drive.md §15), chamadas diretas da ficha (aba Peça e
 * "Mandar para o freela"). Todas: requireUser primeiro, zod, o serviço da BASE (drive-links) e, nas
 * mudanças, revalidatePath do projeto e de Arquivos (a Pauta não guarda o link no cfg: a ficha pede
 * o estado de novo).
 */

export type LinkDoCardTela =
  | ({
      ok: true;
      /** Texto pronto do WhatsApp (só com link ativo). */
      texto: string | null;
      /** wa.me do freela responsável, já com o texto (só com link ativo e telefone). */
      whatsapp: string | null;
      mensagem?: string;
    } & EstadoLinkCard)
  | { ok: false; mensagem: string };

const IdCard = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/);
const Destino = z.enum(CHAVES_DESTINO);

async function montar(cardId: string, userId: string, criar?: { destino: (typeof CHAVES_DESTINO)[number] }, mensagem?: string): Promise<LinkDoCardTela> {
  const r = await linkDoCard(cardId, { userId, criar });
  if (!r.ok) return r;
  const url = r.link?.estado === "ativo" ? r.link.url : null;
  const texto = url ? textoWhatsAppCard({ nome: r.freela?.nome ?? null, titulo: r.titulo, url, destino: r.link?.destinoRotulo ?? null }) : null;
  const digitos = whatsappDigits(r.freela?.telefone ?? null);
  return {
    ...r,
    texto,
    whatsapp: texto && digitos ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : null,
    ...(mensagem ? { mensagem } : {}),
  };
}

function revalidar(projectId: string | null | undefined) {
  if (projectId) revalidatePath(`/painel/projetos/${projectId}`);
  revalidatePath("/painel/arquivos");
}

/** O card tem link? (ao abrir a aba Peça ou a ficha de um card com freela). */
export async function estadoLinkDoCard(cardId: string): Promise<LinkDoCardTela> {
  const user = await requireUser();
  const id = IdCard.safeParse(cardId);
  if (!id.success) return { ok: false, mensagem: "Card não encontrado." };
  return montar(id.data, user.id);
}

/** "Link para o freela": gera um ativo para o destino escolhido (ou devolve o que já existe). */
export async function gerarLinkDoCard(cardId: string, destino: string): Promise<LinkDoCardTela> {
  const user = await requireUser();
  const id = IdCard.safeParse(cardId);
  const d = Destino.safeParse(destino);
  if (!id.success) return { ok: false, mensagem: "Card não encontrado." };
  if (!d.success) return { ok: false, mensagem: "Escolha onde a peça vai cair." };
  const r = await montar(id.data, user.id, { destino: d.data }, "Link gerado.");
  if (r.ok) revalidar(r.projeto?.id);
  return r;
}

/** O link ativo do card (as mudanças valem só para ele). */
async function linkAtivo(cardId: string) {
  const id = IdCard.safeParse(cardId);
  if (!id.success) return null;
  const { driveLinks } = schema;
  const r = await db.query.driveLinks.findFirst({
    where: and(eq(driveLinks.cardId, id.data), eq(driveLinks.tipo, "freela-card"), isNull(driveLinks.revogadoEm)),
  });
  return r ?? null;
}

/** "Trocar destino": o mesmo link passa a mandar para outra pasta do projeto do card. */
export async function destinoLinkDoCard(cardId: string, destino: string): Promise<LinkDoCardTela> {
  const user = await requireUser();
  const d = Destino.safeParse(destino);
  if (!d.success) return { ok: false, mensagem: "Escolha onde a peça vai cair." };
  const link = await linkAtivo(cardId);
  if (!link) return { ok: false, mensagem: "Este card não tem link ativo." };
  const r = await trocarDestinoDoCard(link.id, d.data);
  if (!r.ok) return r;
  revalidar(link.projectId);
  return montar(link.cardId!, user.id, undefined, "Destino trocado. O link continua o mesmo.");
}

/** "Trocar link": outro endereço, o antigo para de funcionar (envios já iniciados terminam). */
export async function trocarLinkDoCard(cardId: string): Promise<LinkDoCardTela> {
  const user = await requireUser();
  const link = await linkAtivo(cardId);
  if (!link) return { ok: false, mensagem: "Este card não tem link ativo." };
  try {
    await trocarLink(link.id, user.id);
  } catch {
    return { ok: false, mensagem: "Não deu para trocar o link. Tente de novo." };
  }
  revalidar(link.projectId);
  return montar(link.cardId!, user.id, undefined, "Link trocado. O antigo parou de funcionar.");
}

/** "Desativar": o link para (nunca é apagado); o que já chegou fica. */
export async function desativarLinkDoCard(cardId: string): Promise<LinkDoCardTela> {
  const user = await requireUser();
  const link = await linkAtivo(cardId);
  if (!link) return { ok: false, mensagem: "Este card não tem link ativo." };
  await desativarLink(link.id, { userId: user.id, cancelarEnvios: false });
  revalidar(link.projectId);
  return montar(link.cardId!, user.id, undefined, "Link desativado.");
}

/** "Vale até": fim do dia escolhido, em Natal. */
export async function validadeLinkDoCard(cardId: string, ate: string): Promise<LinkDoCardTela> {
  const user = await requireUser();
  const v = z.iso.date().safeParse(ate);
  if (!v.success) return { ok: false, mensagem: "Escolha a data." };
  const expiraEm = new Date(`${v.data}T23:59:59-03:00`);
  if (expiraEm <= new Date()) return { ok: false, mensagem: "Escolha hoje ou uma data depois." };
  const link = await linkAtivo(cardId);
  if (!link) return { ok: false, mensagem: "Este card não tem link ativo." };
  await definirValidade(link.id, expiraEm);
  revalidar(link.projectId);
  return montar(link.cardId!, user.id, undefined, "Validade mudada.");
}
