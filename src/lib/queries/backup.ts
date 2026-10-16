import "server-only";
import { getTableColumns } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { databaseConfig, databaseLabel } from "@/lib/db/config";
import { databaseSummary } from "@/lib/db/summary";

const s = schema;

/**
 * Tabelas do backup, na ordem em que uma restauração precisaria gravar
 * (quem é referenciado vem antes de quem referencia).
 * Fora: senhas, tentativas de login e os segredos do Google (refresh token, token cifrado dos links,
 * senha dos links, URI das sessões).
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
  images: s.images,
  clients: s.clients,
  leads: s.leads,
  freelancers: s.freelancers,
  freelancerRates: s.freelancerRates,
  equipment: s.equipment,
  freelancerEquipment: s.freelancerEquipment,
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
  recurringRuns: s.recurringRuns,
  projectChecklists: s.projectChecklists,
  callSheets: s.callSheets,
  scripts: s.scripts,
  quadroCards: s.quadroCards,
  quadroHistorico: s.quadroHistorico,
} as const;

/** Drive sem segredo nenhum, na ordem das referências (os links e os envios saem à parte, sem as colunas secretas). */
const TABLES_DRIVE = {
  drivePastas: s.drivePastas,
  driveProjetos: s.driveProjetos,
  driveDiarias: s.driveDiarias,
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
      photoId: s.users.photoId,
      lastLoginAt: s.users.lastLoginAt,
      createdAt: s.users.createdAt,
    })
    .from(s.users);

  // Google Drive (docs/dev/drive.md §3): depois de projetos, eventos, clientes, freelas e usuários.
  // As três com segredo saem sem as colunas secretas; tokenHash fica (é só o hash, e é NOT NULL).
  const { refreshTokenEnc: _refresh, ...conexao } = getTableColumns(s.driveConexao);
  tables.driveConexao = await db.select(conexao).from(s.driveConexao);
  for (const [name, table] of Object.entries(TABLES_DRIVE)) {
    tables[name] = await db.select().from(table);
  }
  const { tokenEnc: _token, senhaHash: _senha, ...links } = getTableColumns(s.driveLinks);
  tables.driveLinks = await db.select(links).from(s.driveLinks);
  tables.driveLotes = await db.select().from(s.driveLotes);
  const { sessaoEnc: _sessao, ...envios } = getTableColumns(s.driveEnvios);
  tables.driveEnvios = await db.select(envios).from(s.driveEnvios);
  tables.driveCompartilhamentos = await db.select().from(s.driveCompartilhamentos);

  return {
    formato: "zro-backup",
    versao: 1,
    geradoEm: new Date().toISOString(),
    banco: { nome: databaseLabel(databaseConfig().url), id: summary.identity?.id ?? null },
    tabelas: tables,
  };
}
