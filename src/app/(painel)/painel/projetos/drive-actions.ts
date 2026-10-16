"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, str, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/dal";
import { whatsappDigits } from "@/lib/format";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { equipeDaDiaria, linkPorId } from "@/lib/queries/drive-painel";
import { liberarEntregas, recolherEntregas } from "@/lib/services/drive-entregas";
import {
  definirValidade,
  desativarLink,
  linkDaDiaria,
  textoWhatsAppDiaria,
  trocarLink,
  type LinkDTO,
} from "@/lib/services/drive-links";
import type { DiariaDTO } from "@/lib/services/drive-pastas";
import { logProjectActivity } from "@/lib/services/activity";
import { apagarPastaDoProjeto, garantirPastasDoProjeto } from "@/lib/services/drive-pastas";

/**
 * Drive do projeto (docs/dev/drive.md §7.2 e §7.3): pastas, link de envio de cada diária e entregas
 * para o cliente. Todas: requireUser primeiro, zod, serviço da BASE e revalidatePath de tudo que
 * mostra o dado (projeto, agenda, cliente e Arquivos).
 */

const { events, projects } = schema;

const Id = z.string().trim().min(1).max(100);

function revalidarDrive(projectId: string | null | undefined, clientId?: string | null) {
  if (projectId) revalidatePath(`/painel/projetos/${projectId}`);
  revalidatePath("/painel/agenda");
  revalidatePath("/painel/arquivos");
  if (clientId) revalidatePath(`/painel/crm/clientes/${clientId}`);
}

async function projetoDe(projectId: string | undefined) {
  const id = Id.safeParse(projectId);
  if (!id.success) return null;
  return (await db.query.projects.findFirst({ where: eq(projects.id, id.data), columns: { id: true, clientId: true, title: true } })) ?? null;
}

/* ============================== Pastas ============================== */

/**
 * "Criar pastas no Drive", "Tentar de novo", "Recriar o que falta" (confere cada pasta) e
 * "Criar na conta atual" (troca de conta). O serviço é idempotente: chamar de novo completa o que falta.
 */
export async function criarPastasAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const projeto = await projetoDe(str(fd, "projectId"));
  if (!projeto) return fail("Projeto não encontrado.");
  const modo = z.enum(["criar", "verificar", "contaAtual"]).catch("criar").parse(str(fd, "modo"));
  const r = await garantirPastasDoProjeto(projeto.id, {
    userId: user.id,
    verificar: modo === "verificar",
    ignorarLinkAntigo: modo === "contaAtual",
  });
  revalidarDrive(projeto.id, projeto.clientId);
  if (!r.ok) return fail(r.mensagem);
  if (modo === "verificar") return ok(r.criadas ? `Pastas conferidas. ${r.criadas === 1 ? "1 recriada" : `${r.criadas} recriadas`}.` : "Pastas conferidas. Nada faltava.");
  return ok(r.criadas ? "Pastas criadas no Drive." : "Pastas prontas no Drive.");
}

/**
 * "Apagar pasta do Drive": só a árvore vazia que a ZRO criou. Vai para a lixeira do Drive (30 dias
 * para recuperar). Entregas liberadas são recolhidas antes.
 */
export async function apagarPastaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const projeto = await projetoDe(str(fd, "projectId"));
  if (!projeto) return fail("Projeto não encontrado.");
  const r = await apagarPastaDoProjeto(projeto.id, async (dp) => {
    if (!dp.entregasLiberadasEm) return { ok: true };
    const recolhidas = await recolherEntregas(projeto.id, user.id);
    return recolhidas.ok ? { ok: true } : recolhidas;
  });
  revalidarDrive(projeto.id, projeto.clientId);
  if (!r.ok) return fail(r.mensagem);
  await logProjectActivity(projeto.id, "arquivos", "Pasta do Drive movida para a lixeira.", user.id);
  return ok("Pasta movida para a lixeira do Drive.");
}

/* ============================== Link de envio da diária ============================== */

export type EnvioDaDiaria =
  | {
      ok: true;
      link: LinkDTO | null;
      diaria: DiariaDTO | null;
      rolos: number;
      projectId: string;
      /** Texto pronto para o WhatsApp (só com link ativo). */
      texto: string | null;
      /** Quem está escalado, com o atalho do WhatsApp já com o texto (só quem tem telefone). */
      equipe: { id: string; nome: string; whatsapp: string | null }[];
    }
  | { ok: false; mensagem: string };

/**
 * O link de envio da diária (chamada direta, com startTransition). `criar`: gera um ativo se não houver
 * (ou se o último expirou ou foi desativado).
 */
export async function envioDaDiaria(eventId: string, criar: boolean): Promise<EnvioDaDiaria> {
  const user = await requireUser();
  const id = Id.safeParse(eventId);
  if (!id.success || typeof criar !== "boolean") return { ok: false, mensagem: "Diária não encontrada." };
  const evento = await db.query.events.findFirst({
    where: eq(events.id, id.data),
    columns: { id: true, type: true, date: true, projectId: true },
  });
  if (!evento || evento.type !== "diaria") return { ok: false, mensagem: "Diária não encontrada." };
  if (!evento.projectId) return { ok: false, mensagem: "Esta diária não tem projeto." };
  const projeto = await db.query.projects.findFirst({ where: eq(projects.id, evento.projectId), columns: { id: true, title: true, clientId: true } });
  if (!projeto) return { ok: false, mensagem: "Esta diária não tem projeto." };

  const r = await linkDaDiaria(evento.id, { criar, userId: user.id });
  if (!r.ok) return r;
  if (criar) revalidarDrive(projeto.id, projeto.clientId);

  const url = r.link?.estado === "ativo" ? r.link.url : null;
  const texto = url ? textoWhatsAppDiaria({ data: evento.date, projeto: projeto.title, url }) : null;
  const equipe = (await equipeDaDiaria(evento.id)).map((p) => {
    const digitos = whatsappDigits(p.telefone);
    return {
      id: p.id,
      nome: p.nome,
      whatsapp: texto && digitos ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : null,
    };
  });
  return { ok: true, link: r.link, diaria: r.diaria, rolos: r.rolos, projectId: projeto.id, texto, equipe };
}

/** Link de diária existente (as mudanças valem só para esse tipo). */
async function linkDaDiariaPorId(linkId: string | undefined) {
  const id = Id.safeParse(linkId);
  if (!id.success) return null;
  const l = await linkPorId(id.data);
  return l && l.tipo === "freela-diaria" ? l : null;
}

/** "Mudar validade": até o fim do dia escolhido (em Natal). Em branco: sem validade. */
export async function validadeLinkAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const link = await linkDaDiariaPorId(str(fd, "linkId"));
  if (!link) return fail("Link não encontrado.");
  if (link.revogadoEm) return fail("Este link está desativado. Gere um novo.");
  const data = str(fd, "ate");
  let expiraEm: Date | null = null;
  if (data) {
    const v = z.iso.date().safeParse(data);
    if (!v.success) return fail("Escolha a data.", { ate: ["Escolha a data."] });
    expiraEm = new Date(`${v.data}T23:59:59-03:00`);
    if (expiraEm <= new Date()) return fail("Escolha hoje ou uma data depois.", { ate: ["Escolha hoje ou uma data depois."] });
  }
  await definirValidade(link.id, expiraEm);
  revalidarDrive(link.projectId, link.clientId);
  return ok(expiraEm ? "Validade do link mudada." : "O link vale sem data para expirar.");
}

/** Gera outro endereço: o antigo para de funcionar (envios já iniciados terminam). */
export async function trocarLinkAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const link = await linkDaDiariaPorId(str(fd, "linkId"));
  if (!link) return fail("Link não encontrado.");
  if (link.revogadoEm) return fail("Este link está desativado. Gere um novo.");
  try {
    await trocarLink(link.id, user.id);
  } catch {
    return fail("Não deu para trocar o link. Tente de novo.");
  }
  revalidarDrive(link.projectId, link.clientId);
  return ok("Link trocado. O antigo parou de funcionar.");
}

export async function desativarLinkAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const link = await linkDaDiariaPorId(str(fd, "linkId"));
  if (!link) return fail("Link não encontrado.");
  const cancelar = fd.get("cancelarEnvios") === "on";
  const r = await desativarLink(link.id, { userId: user.id, cancelarEnvios: cancelar });
  revalidarDrive(link.projectId, link.clientId);
  return ok(
    r.cancelados
      ? `Link desativado. ${r.cancelados === 1 ? "1 envio cancelado" : `${r.cancelados} envios cancelados`}.`
      : "Link desativado.",
  );
}

/* ============================== Entregas para o cliente ============================== */

export async function liberarEntregasAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const projeto = await projetoDe(str(fd, "projectId"));
  if (!projeto) return fail("Projeto não encontrado.");
  const r = await liberarEntregas(projeto.id, user.id);
  revalidarDrive(projeto.id, projeto.clientId);
  if (!r.ok) return fail(r.mensagem);
  const partes = ["Entregas liberadas."];
  if (r.emailAvisado) partes.push(`${r.emailAvisado} avisado pelo Google.`);
  if (r.areaCriada) partes.push("Área do cliente criada.");
  return ok(partes.join(" "));
}

export async function recolherEntregasAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const projeto = await projetoDe(str(fd, "projectId"));
  if (!projeto) return fail("Projeto não encontrado.");
  const r = await recolherEntregas(projeto.id, user.id);
  revalidarDrive(projeto.id, projeto.clientId);
  if (!r.ok) return fail(r.mensagem);
  return ok("Entregas recolhidas. Os arquivos continuam no Drive.");
}
