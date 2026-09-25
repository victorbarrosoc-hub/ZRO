import "server-only";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { STAGES } from "@/lib/domain";
import { getSetting } from "@/lib/settings";

const {
  projects,
  clients,
  projectTasks,
  projectDeliverables,
  projectCrew,
  freelancers,
  freelancerRates,
  financeEntries,
  projectTemplates,
} = schema;

export type ProjectStatusFilter = "ativos" | "concluidos" | "todos";

/** Quais status cada filtro da lista mostra. "Ativos" inclui os pausados. */
const STATUS_GROUPS: Record<ProjectStatusFilter, string[] | null> = {
  ativos: ["ativo", "pausado"],
  concluidos: ["concluido"],
  todos: null,
};

export function parseStatusFilter(value: unknown): ProjectStatusFilter {
  return value === "concluidos" || value === "todos" ? value : "ativos";
}

const stageIndex = (key: string) => {
  const i = STAGES.findIndex((s) => s.key === key);
  return i === -1 ? 0 : i;
};

/* ============================== Lista ============================== */

export async function listProjects(filters: { q?: string; status?: ProjectStatusFilter } = {}) {
  const status = filters.status ?? "ativos";
  const where = [];
  const group = STATUS_GROUPS[status];
  if (group) where.push(inArray(projects.status, group));
  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(like(projects.title, q), like(projects.code, q), like(clients.name, q)));
  }

  const rows = await db
    .select({
      id: projects.id,
      code: projects.code,
      title: projects.title,
      category: projects.category,
      stage: projects.stage,
      status: projects.status,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
      value: projects.value,
      clientId: projects.clientId,
      clientName: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      // Em "Todos", o que está andando vem antes do que já fechou.
      status === "todos"
        ? sql`case ${projects.status} when 'ativo' then 0 when 'pausado' then 1 when 'concluido' then 2 else 3 end`
        : sql`0`,
      sql`${projects.dueDate} is null`,
      status === "concluidos" ? desc(projects.dueDate) : asc(projects.dueDate),
      desc(projects.code),
    );
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [tasks, deliverables, crew] = await Promise.all([
    db
      .select({
        projectId: projectTasks.projectId,
        total: sql<number>`count(*)`,
        done: sql<number>`sum(case when ${projectTasks.done} = 1 then 1 else 0 end)`,
      })
      .from(projectTasks)
      .where(inArray(projectTasks.projectId, ids))
      .groupBy(projectTasks.projectId),
    db
      .select({
        projectId: projectDeliverables.projectId,
        total: sql<number>`count(*)`,
        delivered: sql<number>`sum(case when ${projectDeliverables.status} = 'entregue' then 1 else 0 end)`,
      })
      .from(projectDeliverables)
      .where(inArray(projectDeliverables.projectId, ids))
      .groupBy(projectDeliverables.projectId),
    db
      .select({
        projectId: projectCrew.projectId,
        freelancerId: projectCrew.freelancerId,
        name: sql<string | null>`coalesce(${freelancers.name}, ${projectCrew.name})`,
      })
      .from(projectCrew)
      .leftJoin(freelancers, eq(projectCrew.freelancerId, freelancers.id))
      .where(inArray(projectCrew.projectId, ids))
      .orderBy(asc(projectCrew.createdAt)),
  ]);

  return rows.map((p) => {
    const t = tasks.find((x) => x.projectId === p.id);
    const d = deliverables.find((x) => x.projectId === p.id);
    // Uma pessoa pode estar em duas funções: aparece uma vez só.
    const people = new Map<string, string>();
    for (const c of crew) {
      if (c.projectId !== p.id || !c.name) continue;
      people.set(c.freelancerId ?? `nome:${c.name}`, c.name);
    }
    return {
      ...p,
      tasksTotal: Number(t?.total ?? 0),
      tasksDone: Number(t?.done ?? 0),
      deliverablesTotal: Number(d?.total ?? 0),
      deliverablesDone: Number(d?.delivered ?? 0),
      crew: [...people.values()],
    };
  });
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

/** Quantos projetos há em cada filtro (para os chips da lista). */
export async function countProjectsByFilter(): Promise<Record<ProjectStatusFilter, number>> {
  const rows = await db
    .select({ status: projects.status, n: sql<number>`count(*)` })
    .from(projects)
    .groupBy(projects.status);
  const by = (list: string[]) => rows.filter((r) => list.includes(r.status)).reduce((s, r) => s + Number(r.n), 0);
  return {
    ativos: by(STATUS_GROUPS.ativos!),
    concluidos: by(STATUS_GROUPS.concluidos!),
    todos: rows.reduce((s, r) => s + Number(r.n), 0),
  };
}

/* ============================== Detalhe ============================== */

/** Projeto completo para a ficha. Em cache por requisição (metadata e página usam o mesmo). */
export const getProject = cache(async (id: string) => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { client: { columns: { id: true, name: true } } },
  });
  if (!project) return null;

  const [tasks, deliverables, crew] = await Promise.all([
    db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, id))
      .orderBy(asc(projectTasks.sortOrder), asc(projectTasks.createdAt)),
    db
      .select()
      .from(projectDeliverables)
      .where(eq(projectDeliverables.projectId, id))
      .orderBy(asc(projectDeliverables.sortOrder), asc(projectDeliverables.createdAt)),
    db
      .select({
        id: projectCrew.id,
        freelancerId: projectCrew.freelancerId,
        name: projectCrew.name,
        function: projectCrew.function,
        work: projectCrew.work,
        startDate: projectCrew.startDate,
        dueDate: projectCrew.dueDate,
        deliveredAt: projectCrew.deliveredAt,
        amount: projectCrew.amount,
        notes: projectCrew.notes,
        freelancerName: freelancers.name,
        freelancerPhone: freelancers.phone,
      })
      .from(projectCrew)
      .leftJoin(freelancers, eq(projectCrew.freelancerId, freelancers.id))
      .where(eq(projectCrew.projectId, id))
      .orderBy(asc(projectCrew.createdAt)),
  ]);

  // Lançamentos do projeto e também os ligados a alguém da equipe (mesmo sem o projectId).
  const crewIds = crew.map((c) => c.id);
  const entries = await db
    .select()
    .from(financeEntries)
    .where(
      crewIds.length
        ? or(eq(financeEntries.projectId, id), inArray(financeEntries.crewId, crewIds))
        : eq(financeEntries.projectId, id),
    )
    .orderBy(asc(financeEntries.dueDate), asc(financeEntries.createdAt));

  tasks.sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));

  return {
    ...project,
    tasks,
    deliverables,
    crew: crew.map((c) => ({ ...c, displayName: c.freelancerName ?? c.name ?? "Sem nome" })),
    entries,
  };
});

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type ProjectCrewMember = ProjectDetail["crew"][number];
export type ProjectEntry = ProjectDetail["entries"][number];

/** Soma dos lançamentos ligados a um membro da equipe (pode haver mais de um). */
export function crewPayment(member: { id: string }, entries: ProjectEntry[]) {
  const linked = entries.filter((e) => e.crewId === member.id);
  if (!linked.length) return null;
  const amount = linked.reduce((s, e) => s + e.amount, 0);
  const paid = linked.reduce((s, e) => s + e.paidAmount, 0);
  const open = linked.filter((e) => e.paidAmount < e.amount);
  // Vencimento que importa: o do primeiro lançamento ainda em aberto.
  const dueDate = open[0]?.dueDate ?? linked[linked.length - 1].dueDate;
  return { entries: linked, open, amount, paid, dueDate };
}

/**
 * Números do projeto: andamento, equipe e resultado.
 * Custos = saídas lançadas + equipe que ainda não virou lançamento (é compromisso também).
 * Imposto estimado = valor contratado × alíquota de Ajustes.
 */
export function summarizeProject(p: ProjectDetail, taxRate: number) {
  const tasksDone = p.tasks.filter((t) => t.done).length;
  const delivered = p.deliverables.filter((d) => d.status === "entregue").length;
  const withClient = p.deliverables.filter((d) => d.status === "revisao").length;

  const crewTotal = p.crew.reduce((s, c) => s + c.amount, 0);
  const crewWithoutEntry = p.crew.filter((c) => !p.entries.some((e) => e.crewId === c.id));
  const crewPending = crewWithoutEntry.reduce((s, c) => s + c.amount, 0);
  const people = new Set(p.crew.map((c) => c.freelancerId ?? `nome:${c.displayName}`)).size;

  const entradas = p.entries.filter((e) => e.kind === "entrada");
  const saidas = p.entries.filter((e) => e.kind === "saida");
  const impostos = p.entries.filter((e) => e.kind === "imposto");
  const sum = (list: ProjectEntry[], pick: (e: ProjectEntry) => number) => list.reduce((s, e) => s + pick(e), 0);

  const received = sum(entradas, (e) => e.paidAmount);
  const receivable = sum(entradas, (e) => Math.max(0, e.amount - e.paidAmount));
  const entradasTotal = sum(entradas, (e) => e.amount);
  const costsLaunched = sum(saidas, (e) => e.amount);
  const paidOut = sum(saidas, (e) => e.paidAmount);
  const payable = sum(saidas, (e) => Math.max(0, e.amount - e.paidAmount));
  const costs = costsLaunched + crewPending;
  const taxEstimated = Math.round((p.value * taxRate) / 100);
  const margin = p.value - costs - taxEstimated;

  return {
    tasks: { total: p.tasks.length, done: tasksDone, pct: p.tasks.length ? Math.round((tasksDone / p.tasks.length) * 100) : 0 },
    deliverables: { total: p.deliverables.length, delivered, withClient },
    crew: {
      total: crewTotal,
      people,
      pending: crewPending,
      pendingCount: crewWithoutEntry.length,
    },
    finance: {
      contracted: p.value,
      received,
      receivable,
      entradasTotal,
      notLaunched: Math.max(0, p.value - entradasTotal),
      costsLaunched,
      crewPending,
      costs,
      paidOut,
      payable,
      taxRate,
      taxEstimated,
      taxLaunched: sum(impostos, (e) => e.amount),
      margin,
      marginPct: p.value > 0 ? margin / p.value : null,
    },
  };
}

export type ProjectSummary = ReturnType<typeof summarizeProject>;

export async function getTaxRate() {
  const taxes = await getSetting("taxes");
  const rate = Number(taxes.rate);
  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

/* ============================== Opções de formulário ============================== */

/** Clientes e modelos para os formulários de projeto. */
export async function getProjectFormOptions() {
  const [clientRows, templateRows] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    // Mesma ordem em que createProject procura o "modelo da categoria" (o primeiro cadastrado).
    db
      .select({ id: projectTemplates.id, name: projectTemplates.name, category: projectTemplates.category, tasks: projectTemplates.tasks })
      .from(projectTemplates)
      .orderBy(sql`rowid`),
  ]);
  return {
    clients: clientRows,
    templates: templateRows.map((t) => ({ id: t.id, name: t.name, category: t.category, taskCount: t.tasks.length })),
  };
}

export type ProjectFormOptions = Awaited<ReturnType<typeof getProjectFormOptions>>;

/** Freelas ativos com os valores padrão, para montar a equipe (o valor entra preenchido). */
export async function listCrewOptions(includeIds: (string | null)[] = []) {
  const extra = includeIds.filter((x): x is string => Boolean(x));
  const rows = await db
    .select({ id: freelancers.id, name: freelancers.name, functions: freelancers.functions, active: freelancers.active })
    .from(freelancers)
    .where(extra.length ? or(eq(freelancers.active, true), inArray(freelancers.id, extra)) : eq(freelancers.active, true))
    .orderBy(asc(freelancers.name));
  if (!rows.length) return [];
  const rates = await db
    .select({
      freelancerId: freelancerRates.freelancerId,
      function: freelancerRates.function,
      category: freelancerRates.category,
      amount: freelancerRates.amount,
      unit: freelancerRates.unit,
    })
    .from(freelancerRates)
    .where(inArray(freelancerRates.freelancerId, rows.map((r) => r.id)));
  return rows.map((f) => ({ ...f, rates: rates.filter((r) => r.freelancerId === f.id) }));
}

export type CrewOption = Awaited<ReturnType<typeof listCrewOptions>>[number];
