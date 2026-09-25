import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { todayISO } from "@/lib/format";

const { leads, clients, activities, users, quotes, quoteItems, projects, financeEntries } = schema;

/* ---------------- Busca ---------------- */

/** Minúsculas e sem acento, para a busca achar "clinica" em "Clínica". */
function normalize(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Todas as palavras da busca aparecem em algum campo (telefone também só pelos dígitos). */
function matches(q: string | undefined, fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const haystack = fields.map(normalize).join(" \u0000 ");
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  if (terms.every((t) => haystack.includes(t))) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length >= 4 && fields.some((f) => (f ?? "").replace(/\D/g, "").includes(digits));
}

/* ---------------- Leads ---------------- */

/** Todos os leads, do mais novo para o mais antigo (o filtro é feito em `filterLeads`). */
export async function listLeads() {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      segment: leads.segment,
      email: leads.email,
      phone: leads.phone,
      projectType: leads.projectType,
      budget: leads.budget,
      stage: leads.stage,
      source: leads.source,
      estimatedValue: leads.estimatedValue,
      followUpAt: leads.followUpAt,
      lostReason: leads.lostReason,
      clientId: leads.clientId,
      clientName: clients.name,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(clients, eq(leads.clientId, clients.id))
    .orderBy(desc(leads.createdAt));
}

export type LeadRow = Awaited<ReturnType<typeof listLeads>>[number];

export function filterLeads(rows: LeadRow[], filters: { q?: string; origem?: string }) {
  return rows.filter(
    (l) =>
      (!filters.origem || l.source === filters.origem) && matches(filters.q, [l.name, l.company, l.email, l.phone, l.clientName]),
  );
}

/** Ficha completa do lead: cliente ligado, histórico, orçamentos e projeto. */
export const getLead = cache(async (id: string) => {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!lead) return null;
  const [client, history, leadQuotes, leadProjects] = await Promise.all([
    lead.clientId
      ? db.query.clients.findFirst({ where: eq(clients.id, lead.clientId), columns: { id: true, name: true } })
      : Promise.resolve(undefined),
    activitiesWhere(eq(activities.leadId, id)),
    quotesWhere(eq(quotes.leadId, id)),
    projectsWhere(eq(projects.leadId, id)),
  ]);
  return { ...lead, client: client ?? null, activities: history, quotes: leadQuotes, projects: leadProjects };
});

/* ---------------- Clientes ---------------- */

/** Clientes com número de projetos e total recebido (entradas pagas). */
export async function listClients() {
  const [rows, projectCounts, received] = await Promise.all([
    db.select().from(clients),
    db
      .select({ clientId: projects.clientId, n: sql<number>`count(*)` })
      .from(projects)
      .groupBy(projects.clientId),
    db
      .select({ clientId: financeEntries.clientId, paid: sql<number>`coalesce(sum(${financeEntries.paidAmount}), 0)` })
      .from(financeEntries)
      .where(eq(financeEntries.kind, "entrada"))
      .groupBy(financeEntries.clientId),
  ]);
  return rows
    .map((c) => ({
      ...c,
      projectCount: Number(projectCounts.find((p) => p.clientId === c.id)?.n ?? 0),
      received: Number(received.find((r) => r.clientId === c.id)?.paid ?? 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

export function filterClients(rows: ClientRow[], q?: string) {
  return rows.filter((c) => matches(q, [c.name, c.segment, c.city, c.contactName, c.email, c.phone, c.document, c.instagram]));
}

/** Para escolher um cliente existente (ex.: ligar um lead). */
export async function listClientOptions() {
  const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name));
  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

/**
 * Ficha do cliente. Projetos, orçamentos e histórico incluem o que veio
 * dos leads ligados a ele (ex.: orçamento feito antes de virar cliente).
 */
export const getClient = cache(async (id: string) => {
  const client = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!client) return null;

  const clientLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      stage: leads.stage,
      projectType: leads.projectType,
      estimatedValue: leads.estimatedValue,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(eq(leads.clientId, id))
    .orderBy(desc(leads.createdAt));
  const leadIds = clientLeads.map((l) => l.id);
  const withLeads = (byClient: SQL, byLead: () => SQL) => (leadIds.length ? or(byClient, byLead()) : byClient);

  const [clientProjects, clientQuotes, entries, history] = await Promise.all([
    projectsWhere(withLeads(eq(projects.clientId, id), () => inArray(projects.leadId, leadIds))),
    quotesWhere(withLeads(eq(quotes.clientId, id), () => inArray(quotes.leadId, leadIds))),
    db
      .select({
        id: financeEntries.id,
        description: financeEntries.description,
        amount: financeEntries.amount,
        paidAmount: financeEntries.paidAmount,
        dueDate: financeEntries.dueDate,
        installment: financeEntries.installment,
        projectId: financeEntries.projectId,
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.clientId, id), eq(financeEntries.kind, "entrada")))
      .orderBy(desc(financeEntries.dueDate)),
    activitiesWhere(withLeads(eq(activities.clientId, id), () => inArray(activities.leadId, leadIds))),
  ]);

  const today = todayISO();
  const open = (e: { amount: number; paidAmount: number }) => Math.max(0, e.amount - e.paidAmount);

  // Agenda dos projetos do cliente, daqui pra frente.
  const projectIds = clientProjects.map((p) => p.id);
  const upcoming = projectIds.length
    ? await db
        .select({
          id: schema.events.id,
          type: schema.events.type,
          title: schema.events.title,
          date: schema.events.date,
          endDate: schema.events.endDate,
          startTime: schema.events.startTime,
          location: schema.events.location,
          projectId: schema.events.projectId,
        })
        .from(schema.events)
        .where(
          and(
            inArray(schema.events.projectId, projectIds),
            gte(sql`coalesce(${schema.events.endDate}, ${schema.events.date})`, today),
          ),
        )
        .orderBy(asc(schema.events.date))
        .limit(8)
    : [];

  return {
    ...client,
    upcoming,
    leads: clientLeads,
    projects: clientProjects,
    quotes: clientQuotes,
    entries,
    received: entries.reduce((s, e) => s + e.paidAmount, 0),
    toReceive: entries.reduce((s, e) => s + open(e), 0),
    late: entries.filter((e) => e.dueDate < today).reduce((s, e) => s + open(e), 0),
    activities: history,
  };
});

/* ---------------- Peças comuns ---------------- */

async function activitiesWhere(where: SQL | undefined) {
  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      content: activities.content,
      createdAt: activities.createdAt,
      leadId: activities.leadId,
      clientId: activities.clientId,
      authorName: users.name,
      leadName: leads.name,
      leadCompany: leads.company,
    })
    .from(activities)
    .leftJoin(users, eq(activities.authorId, users.id))
    .leftJoin(leads, eq(activities.leadId, leads.id))
    .where(where)
    .orderBy(desc(activities.createdAt));
  return rows;
}

export type ActivityRow = Awaited<ReturnType<typeof activitiesWhere>>[number];

/** Orçamentos com o valor (itens menos desconto). */
async function quotesWhere(where: SQL | undefined) {
  const rows = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      version: quotes.version,
      title: quotes.title,
      status: quotes.status,
      issueDate: quotes.issueDate,
      discount: quotes.discount,
    })
    .from(quotes)
    .where(where)
    .orderBy(desc(quotes.issueDate), desc(quotes.number), desc(quotes.version));
  if (!rows.length) return [];
  const totals = await db
    .select({ quoteId: quoteItems.quoteId, total: sql<number>`sum(round(${quoteItems.quantity} * ${quoteItems.unitPrice}))` })
    .from(quoteItems)
    .where(
      inArray(
        quoteItems.quoteId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(quoteItems.quoteId);
  return rows.map((r) => {
    const items = Math.round(Number(totals.find((t) => t.quoteId === r.id)?.total ?? 0));
    return { ...r, total: Math.max(0, items - r.discount) };
  });
}

export type QuoteRow = Awaited<ReturnType<typeof quotesWhere>>[number];

async function projectsWhere(where: SQL | undefined) {
  return db
    .select({
      id: projects.id,
      code: projects.code,
      title: projects.title,
      stage: projects.stage,
      status: projects.status,
      value: projects.value,
      dueDate: projects.dueDate,
    })
    .from(projects)
    .where(where)
    .orderBy(desc(projects.createdAt));
}

export type ProjectRow = Awaited<ReturnType<typeof projectsWhere>>[number];
