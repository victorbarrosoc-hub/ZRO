import "server-only";
import { and, asc, desc, eq, inArray, like, ne, notInArray } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { effectiveQuoteStatus, lineTotal, quoteTotals, type QuoteTotals } from "@/lib/services/quotes";

const { quotes, quoteItems, clients, leads, projects, catalogItems, financeEntries } = schema;

/* ------------------------------ Numeração ------------------------------ */

/** Próximo número do ano: 2026-015 (a versão começa em 1). */
export async function nextQuoteNumber(year = todayISO().slice(0, 4)) {
  const prefix = `${year}-`;
  const rows = await db.select({ number: quotes.number }).from(quotes).where(like(quotes.number, `${prefix}%`));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.number.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/* ------------------------------ Lista ------------------------------ */

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type QuoteListRow = {
  id: string;
  number: string;
  version: number;
  versions: number;
  title: string;
  status: string;
  effectiveStatus: string;
  issueDate: string;
  validUntil: string | null;
  decidedAt: Date | null;
  who: string;
  clientId: string | null;
  leadId: string | null;
  projectId: string | null;
  totals: QuoteTotals;
};

/**
 * Orçamentos para a lista: só a versão mais recente de cada número,
 * com totais calculados pelas mesmas contas do editor.
 */
export async function listQuotes(today = todayISO()): Promise<QuoteListRow[]> {
  const rows = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      version: quotes.version,
      title: quotes.title,
      status: quotes.status,
      issueDate: quotes.issueDate,
      validUntil: quotes.validUntil,
      decidedAt: quotes.decidedAt,
      discount: quotes.discount,
      taxRate: quotes.taxRate,
      clientId: quotes.clientId,
      leadId: quotes.leadId,
      projectId: quotes.projectId,
      clientName: clients.name,
      leadCompany: leads.company,
      leadName: leads.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(leads, eq(quotes.leadId, leads.id))
    .orderBy(desc(quotes.issueDate), desc(quotes.number), desc(quotes.version));

  const latest = new Map<string, (typeof rows)[number]>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.number, (counts.get(r.number) ?? 0) + 1);
    const cur = latest.get(r.number);
    if (!cur || r.version > cur.version) latest.set(r.number, r);
  }
  const picked = [...latest.values()];
  if (!picked.length) return [];

  const items = await db
    .select({ quoteId: quoteItems.quoteId, quantity: quoteItems.quantity, unitPrice: quoteItems.unitPrice, unitCost: quoteItems.unitCost })
    .from(quoteItems)
    .where(inArray(quoteItems.quoteId, picked.map((r) => r.id)));
  const byQuote = new Map<string, typeof items>();
  for (const it of items) {
    const list = byQuote.get(it.quoteId) ?? [];
    list.push(it);
    byQuote.set(it.quoteId, list);
  }

  return picked
    .map((r) => ({
      id: r.id,
      number: r.number,
      version: r.version,
      versions: counts.get(r.number) ?? 1,
      title: r.title,
      status: r.status,
      effectiveStatus: effectiveQuoteStatus(r, today),
      issueDate: r.issueDate,
      validUntil: r.validUntil,
      decidedAt: r.decidedAt,
      who: r.clientName ?? r.leadCompany ?? r.leadName ?? "Sem cliente",
      clientId: r.clientId,
      leadId: r.leadId,
      projectId: r.projectId,
      totals: quoteTotals(byQuote.get(r.id) ?? [], r.discount, r.taxRate),
    }))
    .sort((a, b) => (a.issueDate === b.issueDate ? b.number.localeCompare(a.number) : b.issueDate.localeCompare(a.issueDate)));
}

export function filterQuotes(rows: QuoteListRow[], filters: { status?: string; q?: string }) {
  let out = rows;
  if (filters.status) out = out.filter((r) => r.effectiveStatus === filters.status);
  if (filters.q) {
    const q = normalize(filters.q.trim());
    out = out.filter((r) => normalize(`${r.number} ${r.title} ${r.who}`).includes(q));
  }
  return out;
}

/** Números do topo da lista. */
export function summarizeQuotes(rows: QuoteListRow[], today = todayISO()) {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const open = rows.filter((r) => r.effectiveStatus === "enviado");
  const approvedMonth = rows.filter((r) => r.status === "aprovado" && r.decidedAt && todayISO(r.decidedAt).startsWith(month));
  const decided = rows.filter(
    (r) => r.issueDate.startsWith(year) && ["aprovado", "recusado", "expirado"].includes(r.effectiveStatus),
  );
  const approvedYear = decided.filter((r) => r.effectiveStatus === "aprovado").length;
  return {
    openTotal: open.reduce((s, r) => s + r.totals.total, 0),
    openCount: open.length,
    approvedMonthTotal: approvedMonth.reduce((s, r) => s + r.totals.total, 0),
    approvedMonthCount: approvedMonth.length,
    approvalRate: decided.length ? approvedYear / decided.length : null,
    approvedYear,
    decidedYear: decided.length,
    year,
  };
}

/* ------------------------------ Detalhe (editor) ------------------------------ */

export const getQuote = cache(async (id: string) => {
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
  if (!quote) return null;
  const [items, client, lead, project, versions, entries] = await Promise.all([
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder)),
    quote.clientId ? db.query.clients.findFirst({ where: eq(clients.id, quote.clientId) }) : null,
    quote.leadId ? db.query.leads.findFirst({ where: eq(leads.id, quote.leadId) }) : null,
    quote.projectId
      ? db.query.projects.findFirst({
          where: eq(projects.id, quote.projectId),
          columns: { id: true, code: true, title: true, stage: true, status: true },
        })
      : null,
    db
      .select({ id: quotes.id, version: quotes.version, status: quotes.status, validUntil: quotes.validUntil })
      .from(quotes)
      .where(eq(quotes.number, quote.number))
      .orderBy(asc(quotes.version)),
    db.select().from(financeEntries).where(eq(financeEntries.quoteId, id)).orderBy(asc(financeEntries.dueDate)),
  ]);
  return { quote, items, client: client ?? null, lead: lead ?? null, project: project ?? null, versions, entries };
});

export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

/** Outros orçamentos do mesmo lead ainda em jogo (rascunho, enviado ou aprovado). */
export async function otherOpenQuotesForLead(leadId: string, number: string) {
  const today = todayISO();
  const rows = await db
    .select({ id: quotes.id, number: quotes.number, status: quotes.status, validUntil: quotes.validUntil })
    .from(quotes)
    .where(and(eq(quotes.leadId, leadId), ne(quotes.number, number)));
  return rows.filter((r) => {
    const s = effectiveQuoteStatus(r, today);
    return s === "rascunho" || s === "enviado" || s === "aprovado";
  });
}

/** Opções do editor e do formulário de novo orçamento. */
export async function getQuoteFormOptions() {
  const [clientRows, catalog, openLeads] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    db
      .select({
        id: catalogItems.id,
        name: catalogItems.name,
        description: catalogItems.description,
        group: catalogItems.group,
        unit: catalogItems.unit,
        price: catalogItems.price,
        cost: catalogItems.cost,
      })
      .from(catalogItems)
      .where(eq(catalogItems.active, true))
      .orderBy(asc(catalogItems.sortOrder), asc(catalogItems.name)),
    db
      .select({ id: leads.id, name: leads.name, company: leads.company, stage: leads.stage })
      .from(leads)
      .where(notInArray(leads.stage, ["ganho", "perdido"]))
      .orderBy(desc(leads.createdAt)),
  ]);
  return { clients: clientRows, catalog, openLeads };
}

export type CatalogOption = Awaited<ReturnType<typeof getQuoteFormOptions>>["catalog"][number];

export async function getLeadForQuote(id: string) {
  return (await db.query.leads.findFirst({ where: eq(leads.id, id) })) ?? null;
}

export async function getClientForQuote(id: string) {
  return (await db.query.clients.findFirst({ where: eq(clients.id, id) })) ?? null;
}

/** Categoria do último orçamento ou projeto do cliente (para sugerir no novo). */
export async function lastCategoryForClient(clientId: string) {
  const [q] = await db
    .select({ category: quotes.category })
    .from(quotes)
    .where(eq(quotes.clientId, clientId))
    .orderBy(desc(quotes.issueDate))
    .limit(1);
  if (q?.category) return q.category;
  const [p] = await db
    .select({ category: projects.category })
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(desc(projects.startDate))
    .limit(1);
  return p?.category ?? null;
}

/* ------------------------------ Timbrado e PDF ------------------------------ */

export type QuoteDocumentData = {
  number: string;
  version: number;
  title: string;
  status: string;
  issueDate: string;
  validUntil: string | null;
  period: string | null;
  scope: string | null;
  paymentTerms: string | null;
  conditions: string | null;
  recipient: { name: string; contact: string | null; city: string | null; document: string | null } | null;
  /** Só o que o cliente vê: nada de custo ou margem. */
  items: { description: string; detail: string | null; quantity: number; unit: string | null; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  company: {
    legalName: string;
    brand: string;
    cnpj: string;
    address: string;
    email: string;
    phone: string;
    instagram: string;
    website: string;
  };
};

/** Dados do timbrado (HTML e PDF). Custos e margem ficam de fora aqui, de propósito. */
export const getQuoteDocument = cache(async (id: string): Promise<QuoteDocumentData | null> => {
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
  if (!quote) return null;
  const [items, client, lead, company] = await Promise.all([
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder)),
    quote.clientId ? db.query.clients.findFirst({ where: eq(clients.id, quote.clientId) }) : null,
    quote.leadId ? db.query.leads.findFirst({ where: eq(leads.id, quote.leadId) }) : null,
    getSetting("company"),
  ]);
  const totals = quoteTotals(items, quote.discount, quote.taxRate);
  const recipient = client
    ? { name: client.name, contact: client.contactName, city: client.city, document: client.document }
    : lead
      ? { name: lead.company || lead.name, contact: lead.company ? lead.name : null, city: lead.city, document: null }
      : null;
  return {
    number: quote.number,
    version: quote.version,
    title: quote.title,
    status: quote.status,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    period: quote.period,
    scope: quote.scope,
    paymentTerms: quote.paymentTerms,
    conditions: quote.conditions,
    recipient,
    items: items.map((i) => ({
      description: i.description,
      detail: i.detail,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      total: lineTotal(i),
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    company: {
      legalName: company.legalName,
      brand: company.brand,
      cnpj: company.cnpj,
      address: company.address,
      email: company.email,
      phone: company.phone,
      instagram: company.instagram,
      website: company.website,
    },
  };
});
