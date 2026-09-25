import "server-only";
import { db, schema } from "@/lib/db";
import { databaseConfig, databaseLabel } from "@/lib/db/config";
import { databaseSummary } from "@/lib/db/summary";

const s = schema;

/**
 * Tabelas do backup, na ordem em que uma restauração precisaria gravar
 * (quem é referenciado vem antes de quem referencia).
 * Fora: senhas (users.passwordHash) e tentativas de login.
 */
const TABLES = {
  settings: s.settings,
  films: s.films,
  teamMembers: s.teamMembers,
  showcaseClients: s.showcaseClients,
  faqs: s.faqs,
  catalogItems: s.catalogItems,
  projectTemplates: s.projectTemplates,
  equipmentKits: s.equipmentKits,
  clients: s.clients,
  leads: s.leads,
  freelancers: s.freelancers,
  freelancerRates: s.freelancerRates,
  quotes: s.quotes,
  quoteItems: s.quoteItems,
  projects: s.projects,
  projectDeliverables: s.projectDeliverables,
  projectTasks: s.projectTasks,
  projectCrew: s.projectCrew,
  events: s.events,
  eventCrew: s.eventCrew,
  activities: s.activities,
  financeEntries: s.financeEntries,
  financePayments: s.financePayments,
  projectChecklists: s.projectChecklists,
  callSheets: s.callSheets,
  scripts: s.scripts,
} as const;

/** Tudo o que a ZRO guardou, num objeto só (para baixar como .json). */
export async function exportAll() {
  const summary = await databaseSummary(db);
  const tables: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(TABLES)) {
    tables[name] = await db.select().from(table);
  }
  tables.users = await db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      role: s.users.role,
      lastLoginAt: s.users.lastLoginAt,
      createdAt: s.users.createdAt,
    })
    .from(s.users);

  return {
    formato: "zro-backup",
    versao: 1,
    geradoEm: new Date().toISOString(),
    banco: { nome: databaseLabel(databaseConfig().url), id: summary.identity?.id ?? null },
    tabelas: tables,
  };
}
