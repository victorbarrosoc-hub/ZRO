import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FUNCTIONS } from "@/lib/domain";

const { freelancers, freelancerRates, projectCrew, projects, financeEntries, equipment, freelancerEquipment } = schema;

export async function listFreelancers(filters: { q?: string; funcao?: string; ativos?: boolean } = {}) {
  const where = [];
  if (filters.q) {
    const q = `%${filters.q}%`;
    // Também acha pelo equipamento: "fx3", "drone", "lapela".
    const byEquipment = db
      .select({ id: freelancerEquipment.freelancerId })
      .from(freelancerEquipment)
      .innerJoin(equipment, eq(freelancerEquipment.equipmentId, equipment.id))
      .where(ilike(equipment.name, q));
    where.push(or(ilike(freelancers.name, q), ilike(freelancers.city, q), inArray(freelancers.id, byEquipment)));
  }
  if (filters.ativos !== false) where.push(eq(freelancers.active, true));
  const rows = await db
    .select()
    .from(freelancers)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(freelancers.name));

  const filtered = filters.funcao ? rows.filter((f) => f.functions.includes(filters.funcao!)) : rows;
  if (!filtered.length) return [];

  const [rates, open, jobs] = await Promise.all([
    db.select().from(freelancerRates).orderBy(asc(freelancerRates.amount)),
    db
      .select({
        freelancerId: financeEntries.freelancerId,
        open: sql<number>`sum(${financeEntries.amount} - ${financeEntries.paidAmount})`.mapWith(Number),
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.kind, "saida"), sql`${financeEntries.amount} > ${financeEntries.paidAmount}`))
      .groupBy(financeEntries.freelancerId),
    db
      .select({ freelancerId: projectCrew.freelancerId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(projectCrew)
      .groupBy(projectCrew.freelancerId),
  ]);

  return filtered.map((f) => ({
    ...f,
    rates: rates.filter((r) => r.freelancerId === f.id),
    openAmount: Number(open.find((o) => o.freelancerId === f.id)?.open ?? 0),
    jobs: Number(jobs.find((j) => j.freelancerId === f.id)?.n ?? 0),
  }));
}

export type EquipmentItem = { id: string; name: string; category: string };

/** Banco de equipamentos inteiro (para o seletor do cadastro), em ordem alfabética. */
export async function listEquipmentCatalog(): Promise<EquipmentItem[]> {
  return db
    .select({ id: equipment.id, name: equipment.name, category: equipment.category })
    .from(equipment)
    .orderBy(asc(sql`lower(${equipment.name})`));
}

/** Equipamento de um freela. */
export async function listFreelancerEquipment(freelancerId: string): Promise<EquipmentItem[]> {
  return db
    .select({ id: equipment.id, name: equipment.name, category: equipment.category })
    .from(freelancerEquipment)
    .innerJoin(equipment, eq(freelancerEquipment.equipmentId, equipment.id))
    .where(eq(freelancerEquipment.freelancerId, freelancerId))
    .orderBy(asc(sql`lower(${equipment.name})`));
}

/** Banco de equipamentos com quem tem cada um (página Equipamentos). */
export async function listEquipmentWithOwners(q?: string) {
  const [items, links] = await Promise.all([
    db
      .select({ id: equipment.id, name: equipment.name, category: equipment.category })
      .from(equipment)
      .where(q ? ilike(equipment.name, `%${q}%`) : undefined)
      .orderBy(asc(sql`lower(${equipment.name})`)),
    db
      .select({
        equipmentId: freelancerEquipment.equipmentId,
        id: freelancers.id,
        name: freelancers.name,
        photoId: freelancers.photoId,
      })
      .from(freelancerEquipment)
      .innerJoin(freelancers, eq(freelancerEquipment.freelancerId, freelancers.id))
      .where(eq(freelancers.active, true))
      .orderBy(asc(freelancers.name)),
  ]);
  return items.map((item) => ({ ...item, owners: links.filter((l) => l.equipmentId === item.id) }));
}

/** Funções criadas nos cadastros dos freelas (fora da lista padrão), em ordem alfabética. */
export async function listCustomFunctions() {
  const rows = await db.select({ functions: freelancers.functions }).from(freelancers);
  const known = new Set<string>(FUNCTIONS.map((f) => f.key));
  return [...new Set(rows.flatMap((r) => r.functions).filter((k) => !known.has(k)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getFreelancer(id: string) {
  const freela = await db.query.freelancers.findFirst({ where: eq(freelancers.id, id) });
  if (!freela) return null;
  const [rates, crew, entries] = await Promise.all([
    db.select().from(freelancerRates).where(eq(freelancerRates.freelancerId, id)).orderBy(asc(freelancerRates.function)),
    db
      .select({
        id: projectCrew.id,
        function: projectCrew.function,
        work: projectCrew.work,
        amount: projectCrew.amount,
        startDate: projectCrew.startDate,
        dueDate: projectCrew.dueDate,
        deliveredAt: projectCrew.deliveredAt,
        projectId: projects.id,
        projectTitle: projects.title,
        projectCode: projects.code,
      })
      .from(projectCrew)
      .innerJoin(projects, eq(projectCrew.projectId, projects.id))
      .where(eq(projectCrew.freelancerId, id))
      .orderBy(desc(projectCrew.startDate)),
    db
      .select()
      .from(financeEntries)
      .where(eq(financeEntries.freelancerId, id))
      .orderBy(desc(financeEntries.dueDate)),
  ]);
  const gear = await listFreelancerEquipment(id);
  return { ...freela, rates, crew, entries, gear };
}

/** Valor padrão de um freela para uma função (e tipo de job, se houver). */
export async function defaultRate(freelancerId: string, fn: string, category?: string | null) {
  const rates = await db
    .select()
    .from(freelancerRates)
    .where(and(eq(freelancerRates.freelancerId, freelancerId), eq(freelancerRates.function, fn)));
  return rates.find((r) => r.category && r.category === category) ?? rates.find((r) => !r.category) ?? rates[0] ?? null;
}
