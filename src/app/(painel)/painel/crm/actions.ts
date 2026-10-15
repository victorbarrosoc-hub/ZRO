"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { bool, fail, fromZod, list, money, ok, str, type ActionResult } from "@/lib/actions";
import type { ClientRecurring } from "@/lib/db/schema";
import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
  LEAD_SOURCES,
  LEAD_STAGE_KEYS,
} from "@/lib/domain";
import { formatPhone, instagramHandle } from "@/lib/format";
import { ensureClientForLead } from "@/lib/services/clients";
import { deleteImages, readImageField, resolveImageField } from "@/lib/services/images";
import { ACTIVITY_TYPES, STAGE_ACTIVITY, keysOf, stageLabel } from "./crm-options";

const { leads, clients, activities } = schema;

/* ---------------- Validação ---------------- */

const text = (max: number) => z.string().max(max, `Use no máximo ${max} caracteres.`).optional();
const option = <T extends readonly { key: string }[]>(list: T) =>
  z.enum(keysOf(list), { message: "Escolha uma opção da lista." }).optional();
const phone = z
  .string()
  .max(30, "Confira o número.")
  .optional()
  .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Confira o número com DDD.");
const email = z.email("E-mail inválido.").max(120, "E-mail longo demais.").optional();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .optional();
const cents = z
  .number({ message: "Valor inválido." })
  .int()
  .min(0, "Valor inválido.")
  .max(100_000_000_000, "Valor alto demais.")
  .optional();
const source = z.enum(keysOf(LEAD_SOURCES), { message: "Escolha a origem." });

const leadContact = {
  name: z.string({ message: "Digite o nome." }).min(2, "Digite o nome.").max(120, "Nome longo demais."),
  company: text(120),
  segment: text(80),
  phone,
  email,
  source,
};

const leadBrief = {
  projectType: option(FUNNEL_PROJECT_TYPES),
  budget: option(FUNNEL_BUDGETS),
  idea: text(2000),
  timing: text(80),
  city: text(80),
  days: option(FUNNEL_DAYS),
  videos: option(FUNNEL_VIDEOS),
  format: option(FUNNEL_FORMATS),
  extras: z.array(z.enum(keysOf(FUNNEL_EXTRAS), { message: "Extra inválido." })).max(10),
};

const leadControl = {
  estimatedValue: cents,
  followUpAt: isoDate,
  notes: text(2000),
};

const NewLeadSchema = z.object({
  ...leadContact,
  projectType: leadBrief.projectType,
  budget: leadBrief.budget,
  ...leadControl,
});
const LeadSchema = z.object({ ...leadContact, ...leadBrief, ...leadControl });
const LeadControlSchema = z.object(leadControl);

function readContact(fd: FormData) {
  return {
    name: str(fd, "name"),
    company: str(fd, "company"),
    segment: str(fd, "segment"),
    phone: formatPhone(str(fd, "phone")) ?? undefined,
    email: str(fd, "email"),
    source: str(fd, "source") ?? "outro",
  };
}

function readBrief(fd: FormData) {
  return {
    projectType: str(fd, "projectType"),
    budget: str(fd, "budget"),
    idea: str(fd, "idea"),
    timing: str(fd, "timing"),
    city: str(fd, "city"),
    days: str(fd, "days"),
    videos: str(fd, "videos"),
    format: str(fd, "format"),
    extras: list(fd, "extras"),
  };
}

function readControl(fd: FormData) {
  return {
    estimatedValue: money(fd, "estimatedValue"),
    followUpAt: str(fd, "followUpAt"),
    notes: str(fd, "notes"),
  };
}

/** No update, campo apagado precisa virar null: o Drizzle ignora `undefined`. */
function orNull<T extends Record<string, unknown>>(data: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v === undefined ? null : v;
  return out as { [K in keyof T]: T[K] | null };
}

/* ---------------- Revalidação ---------------- */

/** Lead mudou: quadro, ficha, painel (leads em aberto) e a ficha do cliente ligado. */
function revalidateLead(id: string, clientId?: string | null) {
  revalidatePath("/painel/crm");
  revalidatePath(`/painel/crm/${id}`);
  revalidatePath("/painel");
  if (clientId) revalidatePath(`/painel/crm/clientes/${clientId}`);
}

/** Cliente mudou: o nome aparece também em leads, projetos, orçamentos e financeiro. */
function revalidateClient(id?: string) {
  revalidatePath("/painel/crm/clientes");
  if (id) revalidatePath(`/painel/crm/clientes/${id}`);
  revalidatePath("/painel/crm");
  revalidatePath("/(painel)/painel/crm/[id]", "page");
  revalidatePath("/painel");
  revalidatePath("/painel/projetos");
  revalidatePath("/painel/orcamentos");
  revalidatePath("/painel/financeiro");
}

/* ---------------- Leads ---------------- */

/** Lead cadastrado à mão (veio por WhatsApp, Instagram, indicação...). Sem consentimento do site. */
export async function createLead(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = NewLeadSchema.safeParse({
    ...readContact(fd),
    projectType: str(fd, "projectType"),
    budget: str(fd, "budget"),
    ...readControl(fd),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db
    .insert(leads)
    .values({ ...parsed.data, stage: "novo", consentAt: null })
    .returning({ id: leads.id });
  revalidatePath("/painel/crm");
  revalidatePath("/painel");
  return ok("Lead cadastrado.", row.id);
}

export async function updateLead(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Lead não encontrado.");
  const parsed = LeadSchema.safeParse({ ...readContact(fd), ...readBrief(fd), ...readControl(fd) });
  if (!parsed.success) return fromZod(parsed.error);
  const { name, source: src, extras, ...rest } = parsed.data;
  const [row] = await db
    .update(leads)
    .set({ name, source: src, extras, ...orNull(rest) })
    .where(eq(leads.id, id))
    .returning({ clientId: leads.clientId });
  if (!row) return fail("Lead não encontrado.");
  revalidateLead(id, row.clientId);
  return ok("Lead atualizado.");
}

/** Valor estimado, data de retorno e observações (cartão "Controle"). */
export async function updateLeadControl(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Lead não encontrado.");
  const parsed = LeadControlSchema.safeParse(readControl(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db.update(leads).set(orNull(parsed.data)).where(eq(leads.id, id)).returning({ clientId: leads.clientId });
  if (!row) return fail("Lead não encontrado.");
  revalidateLead(id, row.clientId);
  return ok("Controle atualizado.");
}

const MoveSchema = z
  .object({
    id: z.string({ message: "Lead não encontrado." }).min(1, "Lead não encontrado."),
    stage: z.enum(LEAD_STAGE_KEYS, { message: "Etapa inválida." }),
    lostReason: z.string().max(500, "Use no máximo 500 caracteres.").optional(),
  })
  .refine((d) => d.stage !== "perdido" || (d.lostReason?.length ?? 0) >= 3, {
    message: "Conte o motivo da perda.",
    path: ["lostReason"],
  });

/**
 * Registra a mudança de etapa no histórico. Se a última atividade do lead
 * também foi uma mudança de etapa há poucos minutos, só atualiza (evita ruído
 * de cartão arrastado para o lugar errado e trazido de volta).
 */
async function logStageChange(leadId: string, authorId: string, content: string) {
  const [last] = await db
    .select({ id: activities.id, type: activities.type, createdAt: activities.createdAt })
    .from(activities)
    .where(eq(activities.leadId, leadId))
    .orderBy(desc(activities.createdAt))
    .limit(1);
  if (last && last.type === STAGE_ACTIVITY && Date.now() - last.createdAt.getTime() < 10 * 60_000) {
    await db.update(activities).set({ content, authorId, createdAt: new Date() }).where(eq(activities.id, last.id));
  } else {
    await db.insert(activities).values({ leadId, type: STAGE_ACTIVITY, content, authorId });
  }
}

/** Muda a etapa do funil (quadro, menu do cartão e ficha). "Perdido" exige o motivo. */
export async function moveLeadStage(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = MoveSchema.safeParse({ id: str(fd, "id"), stage: str(fd, "stage"), lostReason: str(fd, "lostReason") });
  if (!parsed.success) return fromZod(parsed.error);
  const { id, stage, lostReason } = parsed.data;
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    columns: { stage: true, clientId: true, lostReason: true },
  });
  if (!lead) return fail("Lead não encontrado.");
  const reason = stage === "perdido" ? (lostReason ?? null) : null;
  if (lead.stage === stage && lead.lostReason === reason) return ok();

  await db.update(leads).set({ stage, lostReason: reason }).where(eq(leads.id, id));
  await logStageChange(id, user.id, stage === "perdido" ? `Perdido: ${reason}` : `Moveu para ${stageLabel(stage)}.`);
  revalidateLead(id, lead.clientId);
  return ok(stage === "perdido" ? "Lead marcado como perdido." : `Movido para ${stageLabel(stage)}.`);
}

/** Cadastra o lead como cliente (ou liga a um cliente que já existe). */
export async function convertLeadToClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Lead não encontrado.");
  const existingId = str(fd, "clientId");
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id), columns: { clientId: true } });
  if (!lead) return fail("Lead não encontrado.");
  if (lead.clientId && !existingId) {
    revalidateLead(id, lead.clientId);
    return ok("Este lead já é cliente.", lead.clientId);
  }
  let clientId: string;
  try {
    if (existingId) {
      const client = await db.query.clients.findFirst({ where: eq(clients.id, existingId), columns: { id: true } });
      if (!client) return fail("Cliente não encontrado.");
      const [row] = await db.update(leads).set({ clientId: existingId }).where(eq(leads.id, id)).returning({ id: leads.id });
      if (!row) return fail("Lead não encontrado.");
      clientId = existingId;
    } else {
      clientId = await ensureClientForLead(id);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível cadastrar o cliente.");
  }
  revalidateLead(id, clientId);
  revalidatePath("/painel/crm/clientes");
  return ok(existingId ? "Lead ligado ao cliente." : "Cliente cadastrado.", clientId);
}

export async function deleteLead(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Lead não encontrado.");
  const [row] = await db.delete(leads).where(eq(leads.id, id)).returning({ clientId: leads.clientId });
  revalidatePath("/painel/crm");
  revalidatePath("/painel");
  revalidatePath("/painel/orcamentos");
  if (row?.clientId) revalidatePath(`/painel/crm/clientes/${row.clientId}`);
  // Do quadro ou da lista, continua onde estava; da ficha, volta para o CRM.
  if (str(fd, "ficar") === "1") return ok("Lead excluído.");
  redirect("/painel/crm");
}

/* ---------------- Histórico ---------------- */

const ActivitySchema = z.object({
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  type: z.enum(keysOf(ACTIVITY_TYPES), { message: "Escolha o tipo." }),
  content: z.string({ message: "Escreva o que aconteceu." }).min(2, "Escreva o que aconteceu.").max(4000, "Texto longo demais."),
});

export async function addActivity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ActivitySchema.safeParse({
    leadId: str(fd, "leadId"),
    clientId: str(fd, "clientId"),
    type: str(fd, "type") ?? "nota",
    content: str(fd, "content"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const { leadId, clientId } = parsed.data;
  if (!leadId && !clientId) return fail("Atividade sem lead ou cliente.");

  let leadClientId: string | null = null;
  if (leadId) {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), columns: { clientId: true } });
    if (!lead) return fail("Lead não encontrado.");
    leadClientId = lead.clientId;
  }
  if (clientId) {
    const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { id: true } });
    if (!client) return fail("Cliente não encontrado.");
  }

  await db.insert(activities).values({ ...parsed.data, authorId: user.id });
  if (leadId) revalidatePath(`/painel/crm/${leadId}`);
  for (const c of new Set([clientId, leadClientId])) if (c) revalidatePath(`/painel/crm/clientes/${c}`);
  return ok("Atividade registrada.");
}

export async function deleteActivity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Atividade não encontrada.");
  const [row] = await db
    .delete(activities)
    .where(eq(activities.id, id))
    .returning({ leadId: activities.leadId, clientId: activities.clientId });
  if (!row) return fail("Atividade não encontrada.");
  let leadClientId: string | null = null;
  if (row.leadId) {
    revalidatePath(`/painel/crm/${row.leadId}`);
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, row.leadId), columns: { clientId: true } });
    leadClientId = lead?.clientId ?? null;
  }
  for (const c of new Set([row.clientId, leadClientId])) if (c) revalidatePath(`/painel/crm/clientes/${c}`);
  return ok("Atividade apagada.");
}

/* ---------------- Clientes ---------------- */

const ClientSchema = z.object({
  name: z.string({ message: "Digite o nome do cliente." }).min(2, "Digite o nome do cliente.").max(120, "Nome longo demais."),
  segment: text(80),
  city: text(80),
  document: z
    .string()
    .max(30, "Confira o CNPJ ou CPF.")
    .optional()
    .refine((v) => !v || [11, 14].includes(v.replace(/\D/g, "").length), "Confira o CNPJ ou CPF."),
  contactName: text(120),
  email,
  phone,
  instagram: text(60),
  source,
  notes: text(2000),
});

function readClient(fd: FormData) {
  return ClientSchema.safeParse({
    name: str(fd, "name"),
    segment: str(fd, "segment"),
    city: str(fd, "city"),
    document: str(fd, "document"),
    contactName: str(fd, "contactName"),
    email: str(fd, "email"),
    phone: formatPhone(str(fd, "phone")) ?? undefined,
    instagram: instagramHandle(str(fd, "instagram")),
    source: str(fd, "source") ?? "outro",
    notes: str(fd, "notes"),
  });
}

/**
 * Projeto recorrente (contrato mensal). Caixa desmarcada = sem contrato fixo (null).
 * Os campos chegam do formulário como texto; aqui viram números e a lista de entregas.
 */
function readRecurring(fd: FormData): { value: ClientRecurring | null } | { error: ActionResult } {
  if (!bool(fd, "recurring")) return { value: null };
  const inteiro = (k: string) => {
    const v = str(fd, k);
    return v === undefined ? undefined : Number(v);
  };
  const days = inteiro("recurringDays");
  if (days === undefined || !Number.isInteger(days) || days < 0 || days > 31)
    return { error: fail("Quantas diárias de captação por mês? (de 0 a 31)", { recurringDays: ["Diga quantas diárias por mês, de 0 a 31."] }) };
  const value = money(fd, "recurringValue");
  if (value === undefined || value < 0 || value > 100_000_000_000)
    return { error: fail("Qual é o valor fixo por mês?", { recurringValue: ["Digite o valor fixo por mês."] }) };
  const payDay = inteiro("recurringPayDay");
  if (payDay !== undefined && (!Number.isInteger(payDay) || payDay < 1 || payDay > 31))
    return { error: fail("O dia do pagamento vai de 1 a 31.", { recurringPayDay: ["Use um dia de 1 a 31."] }) };
  const startMonth = str(fd, "recurringStart");
  if (startMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth))
    return { error: fail("Confira o mês de início.", { recurringStart: ["Escolha o mês."] }) };
  let lista: unknown = [];
  try {
    lista = JSON.parse(String(fd.get("recurringDeliverables") ?? "[]") || "[]");
  } catch {
    lista = null;
  }
  const entregas = z
    .array(z.object({ title: z.string().trim().min(1).max(120), qty: z.number().int().min(1).max(999) }))
    .max(30, "Até 30 entregas por mês.")
    .safeParse(lista);
  if (!entregas.success)
    return { error: fail("Confira as entregas do mês.", { recurringDeliverables: ["Cada entrega precisa de nome e quantidade (até 30)."] }) };
  return { value: { days, value, deliverables: entregas.data, payDay: payDay ?? null, startMonth: startMonth ?? null } };
}

export async function createClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readClient(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const recorrente = readRecurring(fd);
  if ("error" in recorrente) return recorrente.error;
  const logo = readImageField(fd, "logo");
  if ("error" in logo) return fail(logo.error, { logo: [logo.error] });
  const logoId = await resolveImageField(logo, null);
  const [row] = await db
    .insert(clients)
    .values({ ...parsed.data, logoId, recurring: recorrente.value })
    .returning({ id: clients.id });
  revalidatePath("/painel/crm/clientes");
  return ok("Cliente cadastrado.", row.id);
}

export async function updateClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Cliente não encontrado.");
  const parsed = readClient(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const recorrente = readRecurring(fd);
  if ("error" in recorrente) return recorrente.error;
  const logo = readImageField(fd, "logo");
  if ("error" in logo) return fail(logo.error, { logo: [logo.error] });
  const current = await db.query.clients.findFirst({ where: eq(clients.id, id), columns: { logoId: true } });
  if (!current) return fail("Cliente não encontrado.");
  const logoId = await resolveImageField(logo, current.logoId);
  const { name, source: src, ...rest } = parsed.data;
  const [row] = await db
    .update(clients)
    .set({ name, source: src, ...orNull(rest), logoId, recurring: recorrente.value })
    .where(eq(clients.id, id))
    .returning({ id: clients.id });
  if (!row) return fail("Cliente não encontrado.");
  if (current.logoId !== logoId) await deleteImages([current.logoId]);
  revalidateClient(id);
  return ok("Cliente atualizado.");
}

export async function deleteClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Cliente não encontrado.");
  const [row] = await db.delete(clients).where(eq(clients.id, id)).returning({ logoId: clients.logoId });
  await deleteImages([row?.logoId]);
  revalidateClient();
  if (str(fd, "ficar") === "1") return ok("Cliente excluído.");
  redirect("/painel/crm/clientes");
}
