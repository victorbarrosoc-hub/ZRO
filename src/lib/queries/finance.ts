import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FINANCE_CATEGORIES, type EntryStatus, type FinanceKind } from "@/lib/domain";
import { entryStatus, todayISO } from "@/lib/format";
import { getSetting } from "@/lib/settings";

const { financeEntries, financePayments, projects, clients, freelancers } = schema;

/* ============================== Meses ============================== */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-09" válido? */
export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function monthOf(iso: string) {
  return iso.slice(0, 7);
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro e último dia de um mês, em "AAAA-MM-DD". */
export function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

/** Soma meses a uma data, segurando o dia no fim do mês (31/01 + 1 → 28/02). */
export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Vencimento do DAS: dia 20 do mês seguinte à competência. */
export function dasDueDate(competence: string) {
  return `${shiftMonth(competence, 1)}-20`;
}

/* ============================== Totais ============================== */

export type KindTotals = {
  /** Já baixado (recebido ou pago). */
  paid: number;
  /** Ainda em aberto (a receber ou a pagar). */
  open: number;
  /** Parte do aberto que já venceu. */
  overdue: number;
  /** paid + open */
  total: number;
  count: number;
};

const emptyTotals = (): KindTotals => ({ paid: 0, open: 0, overdue: 0, total: 0, count: 0 });

export function summarize(list: { kind: string; amount: number; paidAmount: number; dueDate: string }[], today = todayISO()) {
  const byKind: Record<FinanceKind, KindTotals> = { entrada: emptyTotals(), saida: emptyTotals(), imposto: emptyTotals() };
  for (const e of list) {
    const t = byKind[e.kind as FinanceKind];
    if (!t) continue;
    const open = Math.max(0, e.amount - e.paidAmount);
    t.count += 1;
    t.paid += e.paidAmount;
    t.open += open;
    if (open > 0 && e.dueDate < today) t.overdue += open;
  }
  for (const t of Object.values(byKind)) t.total = t.paid + t.open;
  const out = byKind.saida.total + byKind.imposto.total;
  return {
    ...byKind,
    saldoRealizado: byKind.entrada.paid - byKind.saida.paid - byKind.imposto.paid,
    saldoPrevisto: byKind.entrada.total - out,
  };
}

export type FinanceSummary = ReturnType<typeof summarize>;

/* ============================== Lançamentos ============================== */

export type EntryFilters = {
  /** "AAAA-MM"; null = todos os meses. */
  month: string | null;
  kind?: FinanceKind;
  status?: EntryStatus;
  /** id do projeto, ou "sem" para os lançamentos sem projeto. */
  project?: string;
  q?: string;
};

export type EntryPayment = { id: string; amount: number; date: string; method: string | null; notes: string | null };

/** Tira acento e caixa, para a busca achar "livia" em "Lívia". */
function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const KIND_ORDER: Record<string, number> = { entrada: 0, saida: 1, imposto: 2 };

/**
 * Lançamentos do recorte (pelo vencimento), com baixas, contagens para os
 * filtros e o resumo. Mês, projeto e busca definem a base; tipo e status
 * filtram em cima dela, para as contagens dos botões baterem com a lista.
 */
export async function listEntries(filters: EntryFilters, today = todayISO()) {
  const where: SQL[] = [];
  if (filters.month) {
    const { start, end } = monthBounds(filters.month);
    where.push(gte(financeEntries.dueDate, start), lte(financeEntries.dueDate, end));
  }
  if (filters.project === "sem") where.push(isNull(financeEntries.projectId));
  else if (filters.project) where.push(eq(financeEntries.projectId, filters.project));

  const rows = await db
    .select({
      id: financeEntries.id,
      kind: financeEntries.kind,
      category: financeEntries.category,
      description: financeEntries.description,
      amount: financeEntries.amount,
      paidAmount: financeEntries.paidAmount,
      dueDate: financeEntries.dueDate,
      paidAt: financeEntries.paidAt,
      competence: financeEntries.competence,
      installment: financeEntries.installment,
      notes: financeEntries.notes,
      projectId: financeEntries.projectId,
      clientId: financeEntries.clientId,
      freelancerId: financeEntries.freelancerId,
      projectCode: projects.code,
      projectTitle: projects.title,
      clientName: clients.name,
      freelancerName: freelancers.name,
    })
    .from(financeEntries)
    .leftJoin(projects, eq(financeEntries.projectId, projects.id))
    .leftJoin(clients, eq(financeEntries.clientId, clients.id))
    .leftJoin(freelancers, eq(financeEntries.freelancerId, freelancers.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(financeEntries.dueDate), asc(financeEntries.createdAt));

  const needle = filters.q ? fold(filters.q.trim()) : "";
  const base = rows
    .map((r) => ({ ...r, status: entryStatus(r, today), open: Math.max(0, r.amount - r.paidAmount) }))
    .filter((r) => {
      if (!needle) return true;
      const category = FINANCE_CATEGORIES.find((c) => c.key === r.category)?.label ?? "";
      const hay = [r.description, r.projectCode, r.projectTitle, r.clientName, r.freelancerName, r.installment, r.notes, category]
        .filter(Boolean)
        .join(" ");
      return fold(hay).includes(needle);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));

  const kindCounts: Record<string, number> = { todos: 0, entrada: 0, saida: 0, imposto: 0 };
  const statusCounts: Record<string, number> = { todos: 0, pendente: 0, parcial: 0, atrasado: 0, pago: 0 };
  for (const r of base) {
    if (!filters.status || r.status === filters.status) {
      kindCounts.todos += 1;
      kindCounts[r.kind] = (kindCounts[r.kind] ?? 0) + 1;
    }
    if (!filters.kind || r.kind === filters.kind) {
      statusCounts.todos += 1;
      statusCounts[r.status] += 1;
    }
  }

  const list = base.filter((r) => (!filters.kind || r.kind === filters.kind) && (!filters.status || r.status === filters.status));

  const payments = new Map<string, EntryPayment[]>();
  const ids = list.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const found = await db
      .select({
        id: financePayments.id,
        entryId: financePayments.entryId,
        amount: financePayments.amount,
        date: financePayments.date,
        method: financePayments.method,
        notes: financePayments.notes,
      })
      .from(financePayments)
      .where(inArray(financePayments.entryId, chunk))
      .orderBy(asc(financePayments.date), asc(financePayments.createdAt));
    for (const { entryId, ...p } of found) {
      const bucket = payments.get(entryId) ?? [];
      bucket.push(p);
      payments.set(entryId, bucket);
    }
  }

  return {
    entries: list.map((r) => ({ ...r, payments: payments.get(r.id) ?? [] })),
    summary: summarize(list, today),
    kindCounts,
    statusCounts,
  };
}

export type FinanceEntryRow = Awaited<ReturnType<typeof listEntries>>["entries"][number];

/** Opções dos formulários e filtros: projetos, clientes e freelas. */
export async function financeOptions() {
  const [projectRows, clientRows, freelaRows] = await Promise.all([
    db
      .select({ id: projects.id, code: projects.code, title: projects.title, status: projects.status, clientId: projects.clientId })
      .from(projects)
      .orderBy(sql`${projects.code} desc`),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    db
      .select({ id: freelancers.id, name: freelancers.name, active: freelancers.active })
      .from(freelancers)
      .orderBy(asc(freelancers.name)),
  ]);
  return { projects: projectRows, clients: clientRows, freelancers: freelaRows };
}

export type FinanceOptions = Awaited<ReturnType<typeof financeOptions>>;

/* ============================== Resultado por projeto ============================== */

export type ProjectResult = {
  id: string;
  code: string;
  title: string;
  status: string;
  clientName: string | null;
  /** Valor contratado (0 quando o projeto ainda não tem valor). */
  value: number;
  /** Base do resultado: o contratado, ou as entradas lançadas quando não há valor. */
  revenue: number;
  received: number;
  toReceive: number;
  /** Parte do contratado que ainda não virou lançamento de entrada. */
  unscheduled: number;
  costs: number;
  costsOpen: number;
  tax: number;
  margin: number;
  /** Margem sobre a receita, de 0 a 1 (null sem receita). */
  marginPct: number | null;
};

/** Receita − custos − imposto estimado, projeto a projeto. */
export async function projectResults() {
  const [projectRows, entryRows, taxes] = await Promise.all([
    db
      .select({
        id: projects.id,
        code: projects.code,
        title: projects.title,
        status: projects.status,
        value: projects.value,
        clientName: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id)),
    db
      .select({
        projectId: financeEntries.projectId,
        kind: financeEntries.kind,
        amount: financeEntries.amount,
        paidAmount: financeEntries.paidAmount,
      })
      .from(financeEntries)
      .where(isNotNull(financeEntries.projectId)),
    getSetting("taxes"),
  ]);

  const rate = Number(taxes.rate) || 0;
  const results: ProjectResult[] = [];
  for (const p of projectRows) {
    const mine = entryRows.filter((e) => e.projectId === p.id);
    if (!mine.length && p.value <= 0) continue;
    let received = 0;
    let toReceive = 0;
    let costsPaid = 0;
    let costsOpen = 0;
    for (const e of mine) {
      const open = Math.max(0, e.amount - e.paidAmount);
      if (e.kind === "entrada") {
        received += e.paidAmount;
        toReceive += open;
      } else if (e.kind === "saida") {
        costsPaid += e.paidAmount;
        costsOpen += open;
      }
    }
    const scheduled = received + toReceive;
    const revenue = p.value > 0 ? p.value : scheduled;
    const tax = Math.round((revenue * rate) / 100);
    const costs = costsPaid + costsOpen;
    const margin = revenue - costs - tax;
    results.push({
      id: p.id,
      code: p.code,
      title: p.title,
      status: p.status,
      clientName: p.clientName,
      value: p.value,
      revenue,
      received,
      toReceive,
      unscheduled: Math.max(0, p.value - scheduled),
      costs,
      costsOpen,
      tax,
      margin,
      marginPct: revenue > 0 ? margin / revenue : null,
    });
  }

  const statusOrder: Record<string, number> = { ativo: 0, pausado: 1, concluido: 2, cancelado: 3 };
  results.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || b.code.localeCompare(a.code));

  const totals = results.reduce(
    (acc, r) => ({
      value: acc.value + r.value,
      revenue: acc.revenue + r.revenue,
      received: acc.received + r.received,
      toReceive: acc.toReceive + r.toReceive,
      costs: acc.costs + r.costs,
      tax: acc.tax + r.tax,
      margin: acc.margin + r.margin,
    }),
    { value: 0, revenue: 0, received: 0, toReceive: 0, costs: 0, tax: 0, margin: 0 },
  );

  return {
    rate,
    projects: results,
    totals: { ...totals, marginPct: totals.revenue > 0 ? totals.margin / totals.revenue : null },
    hiddenCount: projectRows.length - results.length,
  };
}

/* ============================== Freelas ============================== */

/** Pagamentos a freelas em aberto, agrupados por pessoa (de qualquer mês). */
export async function freelasToPay(today = todayISO()) {
  const rows = await db
    .select({
      id: financeEntries.id,
      kind: financeEntries.kind,
      description: financeEntries.description,
      amount: financeEntries.amount,
      paidAmount: financeEntries.paidAmount,
      dueDate: financeEntries.dueDate,
      freelancerId: financeEntries.freelancerId,
      freelancerName: freelancers.name,
      photoId: freelancers.photoId,
      projectId: financeEntries.projectId,
      projectCode: projects.code,
    })
    .from(financeEntries)
    .leftJoin(freelancers, eq(financeEntries.freelancerId, freelancers.id))
    .leftJoin(projects, eq(financeEntries.projectId, projects.id))
    .where(
      and(
        eq(financeEntries.kind, "saida"),
        sql`${financeEntries.amount} > ${financeEntries.paidAmount}`,
        or(isNotNull(financeEntries.freelancerId), eq(financeEntries.category, "freela")),
      ),
    )
    .orderBy(asc(financeEntries.dueDate));

  type Group = {
    key: string;
    freelancerId: string | null;
    name: string;
    photoId: string | null;
    open: number;
    nextDue: string;
    overdue: boolean;
    entries: (typeof rows[number] & { open: number; status: EntryStatus })[];
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = r.freelancerId ?? "sem-cadastro";
    const open = Math.max(0, r.amount - r.paidAmount);
    const g: Group = groups.get(key) ?? {
      key,
      freelancerId: r.freelancerId,
      name: r.freelancerName ?? "Sem cadastro no banco",
      photoId: r.photoId,
      open: 0,
      nextDue: r.dueDate,
      overdue: false,
      entries: [],
    };
    g.open += open;
    if (r.dueDate < g.nextDue) g.nextDue = r.dueDate;
    if (r.dueDate < today) g.overdue = true;
    g.entries.push({ ...r, open, status: entryStatus(r, today) });
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.name.localeCompare(b.name));
  return { groups: list, total: list.reduce((s, g) => s + g.open, 0), count: rows.length };
}

/** Baixas de pagamentos a freelas feitas no mês (pela data da baixa). */
export async function paidToFreelas(month: string) {
  const { start, end } = monthBounds(month);
  const rows = await db
    .select({
      id: financePayments.id,
      amount: financePayments.amount,
      date: financePayments.date,
      method: financePayments.method,
      description: financeEntries.description,
      freelancerId: financeEntries.freelancerId,
      freelancerName: freelancers.name,
      projectCode: projects.code,
    })
    .from(financePayments)
    .innerJoin(financeEntries, eq(financePayments.entryId, financeEntries.id))
    .leftJoin(freelancers, eq(financeEntries.freelancerId, freelancers.id))
    .leftJoin(projects, eq(financeEntries.projectId, projects.id))
    .where(
      and(
        eq(financeEntries.kind, "saida"),
        or(isNotNull(financeEntries.freelancerId), eq(financeEntries.category, "freela")),
        gte(financePayments.date, start),
        lte(financePayments.date, end),
      ),
    )
    .orderBy(sql`${financePayments.date} desc`);
  return { payments: rows, total: rows.reduce((s, p) => s + p.amount, 0) };
}

/* ============================== Impostos ============================== */

/** Soma do que entrou (baixas de entradas) num mês. */
export async function revenueInMonth(month: string) {
  const { start, end } = monthBounds(month);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${financePayments.amount}), 0)`.mapWith(Number) })
    .from(financePayments)
    .innerJoin(financeEntries, eq(financePayments.entryId, financeEntries.id))
    .where(and(eq(financeEntries.kind, "entrada"), gte(financePayments.date, start), lte(financePayments.date, end)));
  return Number(row?.total ?? 0);
}

/** Lançamentos de DAS de uma competência. */
export async function dasEntriesFor(competence: string) {
  return db
    .select({ id: financeEntries.id })
    .from(financeEntries)
    .where(and(eq(financeEntries.kind, "imposto"), eq(financeEntries.category, "das"), eq(financeEntries.competence, competence)));
}

export type DasStatus = EntryStatus | "nao-lancado" | "sem-receita";

/**
 * Simples Nacional mês a mês (do mês de referência para trás): receita
 * recebida, DAS estimado pela alíquota de Ajustes e DAS lançado.
 */
export async function taxesByMonth(ref: string, count = 7, today = todayISO()) {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(ref, -i));
  const start = monthBounds(months[months.length - 1]).start;
  const end = monthBounds(ref).end;

  const [received, das, taxes] = await Promise.all([
    db
      .select({ amount: financePayments.amount, date: financePayments.date })
      .from(financePayments)
      .innerJoin(financeEntries, eq(financePayments.entryId, financeEntries.id))
      .where(and(eq(financeEntries.kind, "entrada"), gte(financePayments.date, start), lte(financePayments.date, end))),
    db
      .select({
        id: financeEntries.id,
        kind: financeEntries.kind,
        description: financeEntries.description,
        amount: financeEntries.amount,
        paidAmount: financeEntries.paidAmount,
        dueDate: financeEntries.dueDate,
        competence: financeEntries.competence,
      })
      .from(financeEntries)
      .where(
        and(eq(financeEntries.kind, "imposto"), eq(financeEntries.category, "das"), inArray(financeEntries.competence, months)),
      )
      .orderBy(asc(financeEntries.dueDate)),
    getSetting("taxes"),
  ]);

  const rate = Number(taxes.rate) || 0;
  const currentMonth = monthOf(today);
  const rank: Record<EntryStatus, number> = { atrasado: 3, parcial: 2, pendente: 1, pago: 0 };

  const rows = months.map((month) => {
    const revenue = received.filter((p) => monthOf(p.date) === month).reduce((s, p) => s + p.amount, 0);
    const estimated = Math.round((revenue * rate) / 100);
    const entries = das.filter((e) => e.competence === month).map((e) => ({ ...e, status: entryStatus(e, today) }));
    const launched = entries.reduce((s, e) => s + e.amount, 0);
    const paid = entries.reduce((s, e) => s + e.paidAmount, 0);
    let status: DasStatus;
    if (entries.length) {
      status = entries.reduce<EntryStatus>((worst, e) => (rank[e.status] > rank[worst] ? e.status : worst), "pago");
    } else {
      status = revenue > 0 ? "nao-lancado" : "sem-receita";
    }
    const openEntry = entries.find((e) => e.status !== "pago");
    return {
      month,
      revenue,
      rate,
      estimated,
      launched,
      paid,
      entries,
      openEntry: openEntry ?? null,
      dueDate: entries[0]?.dueDate ?? dasDueDate(month),
      status,
      /** Mês ainda em andamento: a receita pode crescer. */
      inProgress: month >= currentMonth,
    };
  });

  return { rate, months: rows };
}

/** Totais de impostos: em aberto (qualquer mês), pagos no ano e outros impostos a pagar. */
export async function taxOverview(year: string, today = todayISO()) {
  const [openRows, paidRow] = await Promise.all([
    db
      .select({
        id: financeEntries.id,
        kind: financeEntries.kind,
        category: financeEntries.category,
        description: financeEntries.description,
        amount: financeEntries.amount,
        paidAmount: financeEntries.paidAmount,
        dueDate: financeEntries.dueDate,
        competence: financeEntries.competence,
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.kind, "imposto"), sql`${financeEntries.amount} > ${financeEntries.paidAmount}`))
      .orderBy(asc(financeEntries.dueDate)),
    db
      .select({ total: sql<number>`coalesce(sum(${financePayments.amount}), 0)`.mapWith(Number) })
      .from(financePayments)
      .innerJoin(financeEntries, eq(financePayments.entryId, financeEntries.id))
      .where(
        and(eq(financeEntries.kind, "imposto"), gte(financePayments.date, `${year}-01-01`), lte(financePayments.date, `${year}-12-31`)),
      ),
  ]);

  const open = openRows.map((e) => ({ ...e, open: Math.max(0, e.amount - e.paidAmount), status: entryStatus(e, today) }));
  return {
    openTotal: open.reduce((s, e) => s + e.open, 0),
    openCount: open.length,
    overdueTotal: open.filter((e) => e.status === "atrasado").reduce((s, e) => s + e.open, 0),
    nextDue: open[0]?.dueDate ?? null,
    paidInYear: Number(paidRow[0]?.total ?? 0),
    /** ISS e outros impostos em aberto (o DAS tem a tabela própria). */
    others: open.filter((e) => e.category !== "das"),
  };
}
