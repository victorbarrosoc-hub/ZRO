import "server-only";
import { and, asc, eq, gte, inArray, lte, notInArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/format";

const { financeEntries, financePayments, projects, events, leads, clients } = schema;

export type MonthFlow = {
  key: string; // AAAA-MM
  entradasRealizado: number;
  entradasPrevisto: number;
  saidasRealizado: number;
  saidasPrevisto: number;
  saldo: number;
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(ym: string) {
  const start = `${ym}-01`;
  const next = shiftMonth(ym, 1);
  const end = addDaysISO(`${next}-01`, -1);
  return { start, end };
}

/** Fluxo de caixa mês a mês: realizado pelas baixas, previsto pelo que falta pagar/receber. */
export async function getCashFlow(fromOffset = -2, toOffset = 3, today = todayISO()) {
  const current = monthKey(today);
  const months = Array.from({ length: toOffset - fromOffset + 1 }, (_, i) => shiftMonth(current, fromOffset + i));
  const rangeStart = monthBounds(months[0]).start;
  const rangeEnd = monthBounds(months[months.length - 1]).end;

  const [entries, payments] = await Promise.all([
    db
      .select({
        id: financeEntries.id,
        kind: financeEntries.kind,
        amount: financeEntries.amount,
        paidAmount: financeEntries.paidAmount,
        dueDate: financeEntries.dueDate,
      })
      .from(financeEntries)
      .where(and(gte(financeEntries.dueDate, rangeStart), lte(financeEntries.dueDate, rangeEnd))),
    db
      .select({
        amount: financePayments.amount,
        date: financePayments.date,
        kind: financeEntries.kind,
      })
      .from(financePayments)
      .innerJoin(financeEntries, eq(financePayments.entryId, financeEntries.id))
      .where(and(gte(financePayments.date, rangeStart), lte(financePayments.date, rangeEnd))),
  ]);

  const map = new Map<string, MonthFlow>(
    months.map((key) => [key, { key, entradasRealizado: 0, entradasPrevisto: 0, saidasRealizado: 0, saidasPrevisto: 0, saldo: 0 }]),
  );

  for (const p of payments) {
    const m = map.get(monthKey(p.date));
    if (!m) continue;
    if (p.kind === "entrada") m.entradasRealizado += p.amount;
    else m.saidasRealizado += p.amount;
  }
  for (const e of entries) {
    const m = map.get(monthKey(e.dueDate));
    if (!m) continue;
    const open = Math.max(0, e.amount - e.paidAmount);
    if (e.kind === "entrada") m.entradasPrevisto += open;
    else m.saidasPrevisto += open;
  }
  for (const m of map.values()) {
    m.saldo = m.entradasRealizado + m.entradasPrevisto - m.saidasRealizado - m.saidasPrevisto;
  }
  return { months: [...map.values()], current };
}

export async function getDashboard(today = todayISO()) {
  const current = monthKey(today);
  const { start, end } = monthBounds(current);
  const weekEnd = addDaysISO(today, 7);

  const [monthEntries, monthPayments, overdue, activeProjects, upcoming, openLeads] = await Promise.all([
    db
      .select({ kind: financeEntries.kind, amount: financeEntries.amount, paidAmount: financeEntries.paidAmount })
      .from(financeEntries)
      .where(and(gte(financeEntries.dueDate, start), lte(financeEntries.dueDate, end))),
    db
      .select({ amount: financePayments.amount, kind: financeEntries.kind })
      .from(financePayments)
      .innerJoin(financeEntries, eq(financePayments.entryId, financeEntries.id))
      .where(and(gte(financePayments.date, start), lte(financePayments.date, end))),
    db
      .select({
        id: financeEntries.id,
        kind: financeEntries.kind,
        description: financeEntries.description,
        amount: financeEntries.amount,
        paidAmount: financeEntries.paidAmount,
        dueDate: financeEntries.dueDate,
      })
      .from(financeEntries)
      .where(lte(financeEntries.dueDate, addDaysISO(today, -1)))
      .orderBy(asc(financeEntries.dueDate)),
    db
      .select({ id: projects.id, stage: projects.stage, title: projects.title, code: projects.code, dueDate: projects.dueDate })
      .from(projects)
      .where(eq(projects.status, "ativo")),
    db
      .select({
        id: events.id,
        type: events.type,
        title: events.title,
        date: events.date,
        startTime: events.startTime,
        location: events.location,
        projectId: events.projectId,
        projectTitle: projects.title,
      })
      .from(events)
      .leftJoin(projects, eq(events.projectId, projects.id))
      .where(and(gte(events.date, today), lte(events.date, weekEnd)))
      .orderBy(asc(events.date), asc(events.startTime)),
    db
      .select({
        id: leads.id,
        name: leads.name,
        company: leads.company,
        stage: leads.stage,
        projectType: leads.projectType,
        budget: leads.budget,
        followUpAt: leads.followUpAt,
        createdAt: leads.createdAt,
        clientName: clients.name,
      })
      .from(leads)
      .leftJoin(clients, eq(leads.clientId, clients.id))
      .where(notInArray(leads.stage, ["ganho", "perdido"]))
      .orderBy(asc(leads.createdAt)),
  ]);

  let aReceber = 0;
  let aPagar = 0;
  for (const e of monthEntries) {
    const open = Math.max(0, e.amount - e.paidAmount);
    if (e.kind === "entrada") aReceber += open;
    else aPagar += open;
  }
  let recebido = 0;
  let pago = 0;
  for (const p of monthPayments) {
    if (p.kind === "entrada") recebido += p.amount;
    else pago += p.amount;
  }

  const late = overdue.filter((e) => e.paidAmount < e.amount);
  const lateIn = late.filter((e) => e.kind === "entrada");
  const lateOut = late.filter((e) => e.kind !== "entrada");

  const stageCounts = activeProjects.reduce<Record<string, number>>((acc, p) => {
    acc[p.stage] = (acc[p.stage] ?? 0) + 1;
    return acc;
  }, {});

  return {
    today,
    month: current,
    aReceber,
    recebido,
    aPagar,
    pago,
    saldoPrevisto: recebido + aReceber - pago - aPagar,
    activeProjects,
    stageCounts,
    upcoming,
    openLeads: openLeads.reverse(),
    newLeads: openLeads.filter((l) => l.stage === "novo").length,
    lateIn: { count: lateIn.length, total: lateIn.reduce((s, e) => s + e.amount - e.paidAmount, 0), items: lateIn.slice(0, 5) },
    lateOut: { count: lateOut.length, total: lateOut.reduce((s, e) => s + e.amount - e.paidAmount, 0), items: lateOut.slice(0, 5) },
  };
}

export async function getLeadCountByStage() {
  const rows = await db.select({ stage: leads.stage }).from(leads).where(inArray(leads.stage, ["novo", "conversa", "orcamento", "negociacao"]));
  return rows.length;
}
