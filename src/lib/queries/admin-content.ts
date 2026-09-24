/**
 * Leituras das áreas Processos, Site e Ajustes do painel.
 * (Modelos de projeto, kits, filmes, equipe, clientes do site, perguntas,
 * catálogo de preços e dados de exemplo.)
 */
import "server-only";
import { asc, eq, like, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CATALOG_GROUPS, STAGES } from "@/lib/domain";

const {
  projectTemplates,
  equipmentKits,
  films,
  teamMembers,
  showcaseClients,
  faqs,
  catalogItems,
  quoteItems,
  users,
} = schema;

/* ============================== Processos ============================== */

export type TemplateTask = { stage: string; title: string };

/**
 * Modelos na ordem em que foram criados (rowid): é a mesma ordem em que o
 * createProject acha "o primeiro modelo da categoria".
 */
export async function listTemplates() {
  const rows = await db.select().from(projectTemplates).orderBy(sql`rowid`);
  return rows.map((t) => ({
    ...t,
    total: t.tasks.length,
    perStage: STAGES.map((s) => ({ ...s, count: t.tasks.filter((task) => task.stage === s.key).length })),
  }));
}

export async function getTemplate(id: string) {
  return (await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, id) })) ?? null;
}

export async function listKits() {
  const rows = await db.select().from(equipmentKits).orderBy(sql`rowid`);
  return rows.map((k) => ({ ...k, pieces: k.items.reduce((s, i) => s + (Number(i.qty) || 0), 0) }));
}

export async function countProcessos() {
  const [[t], [k]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(projectTemplates),
    db.select({ n: sql<number>`count(*)` }).from(equipmentKits),
  ]);
  return { templates: Number(t?.n ?? 0), kits: Number(k?.n ?? 0) };
}

/* ============================== Site ============================== */

export type AdminFilm = typeof films.$inferSelect;

/** Todos os filmes (publicados ou não), na ordem do site. */
export async function listFilmsAdmin() {
  return db.select().from(films).orderBy(asc(films.sortOrder), asc(films.createdAt));
}

export async function getFilmAdmin(id: string) {
  return (await db.query.films.findFirst({ where: eq(films.id, id) })) ?? null;
}

export async function listTeamAdmin() {
  return db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder), asc(teamMembers.createdAt));
}

export async function listShowcaseClientsAdmin() {
  return db.select().from(showcaseClients).orderBy(asc(showcaseClients.sortOrder), asc(showcaseClients.createdAt));
}

export async function listFaqsAdmin() {
  return db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.createdAt));
}

/* ============================== Ajustes ============================== */

/** Catálogo agrupado na ordem de CATALOG_GROUPS, com quantos orçamentos usam cada item. */
export async function listCatalogAdmin() {
  const [items, usage] = await Promise.all([
    db.select().from(catalogItems).orderBy(asc(catalogItems.sortOrder), asc(catalogItems.createdAt)),
    db
      .select({ id: quoteItems.catalogItemId, n: sql<number>`count(distinct ${quoteItems.quoteId})` })
      .from(quoteItems)
      .where(sql`${quoteItems.catalogItemId} is not null`)
      .groupBy(quoteItems.catalogItemId),
  ]);
  const used = new Map(usage.map((u) => [u.id, Number(u.n)]));
  const withUsage = items.map((i) => ({ ...i, quotes: used.get(i.id) ?? 0 }));
  const known = new Set<string>(CATALOG_GROUPS.map((g) => g.key));
  const groups: { key: string; label: string; items: typeof withUsage }[] = CATALOG_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: withUsage.filter((i) => i.group === g.key),
  }));
  // Grupo fora do vocabulário (dado antigo): aparece no fim, para poder corrigir.
  const orphans = withUsage.filter((i) => !known.has(i.group));
  if (orphans.length) groups.push({ key: "__outros", label: "Outros", items: orphans });
  return { total: items.length, active: items.filter((i) => i.active).length, groups };
}

export async function getAccount(id: string) {
  return (
    (await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true, name: true, email: true, lastLoginAt: true },
    })) ?? null
  );
}

/**
 * Quantos registros de exemplo (id começando com "demo-") existem em cada tabela
 * que a limpeza apaga. Tabela sem nenhum fica fora da lista.
 */
export async function countDemoData() {
  const tables = [
    { label: ["lançamento financeiro", "lançamentos financeiros"], table: schema.financeEntries, id: schema.financeEntries.id },
    { label: ["baixa de pagamento", "baixas de pagamento"], table: schema.financePayments, id: schema.financePayments.id },
    { label: ["projeto", "projetos"], table: schema.projects, id: schema.projects.id },
    { label: ["tarefa de projeto", "tarefas de projeto"], table: schema.projectTasks, id: schema.projectTasks.id },
    { label: ["entrega", "entregas"], table: schema.projectDeliverables, id: schema.projectDeliverables.id },
    { label: ["pessoa escalada", "pessoas escaladas"], table: schema.projectCrew, id: schema.projectCrew.id },
    { label: ["evento da agenda", "eventos da agenda"], table: schema.events, id: schema.events.id },
    { label: ["escala de diária", "escalas de diária"], table: schema.eventCrew, id: schema.eventCrew.id },
    { label: ["ordem do dia", "ordens do dia"], table: schema.callSheets, id: schema.callSheets.id },
    { label: ["checklist", "checklists"], table: schema.projectChecklists, id: schema.projectChecklists.id },
    { label: ["roteiro ou shot list", "roteiros e shot lists"], table: schema.scripts, id: schema.scripts.id },
    { label: ["orçamento", "orçamentos"], table: schema.quotes, id: schema.quotes.id },
    { label: ["item de orçamento", "itens de orçamento"], table: schema.quoteItems, id: schema.quoteItems.id },
    { label: ["lead", "leads"], table: schema.leads, id: schema.leads.id },
    { label: ["interação", "interações"], table: schema.activities, id: schema.activities.id },
    { label: ["cliente", "clientes"], table: schema.clients, id: schema.clients.id },
    { label: ["freela", "freelas"], table: schema.freelancers, id: schema.freelancers.id },
    { label: ["valor de freela", "valores de freela"], table: schema.freelancerRates, id: schema.freelancerRates.id },
    { label: ["cliente no site", "clientes no site"], table: schema.showcaseClients, id: schema.showcaseClients.id },
  ] as const;
  const counts = await Promise.all(
    tables.map(async (t) => {
      const [row] = await db.select({ n: sql<number>`count(*)` }).from(t.table).where(like(t.id, "demo-%"));
      const count = Number(row?.n ?? 0);
      return { label: count === 1 ? t.label[0] : t.label[1], count };
    }),
  );
  const present = counts.filter((c) => c.count > 0);
  return { total: present.reduce((s, c) => s + c.count, 0), tables: present };
}
