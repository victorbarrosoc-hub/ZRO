/**
 * Limpeza dos dados de exemplo (tudo com id começando com "demo-").
 *
 * SQL puro (Postgres), sem "server-only", para poder ser testado com um script
 * contra uma cópia do banco. Roda numa transação só.
 *
 * 1. Registros de verdade que apontam para exemplos perdem o vínculo (o que o
 *    banco faria com ON DELETE SET NULL). Assim o resultado não depende das
 *    regras de chave estrangeira do banco.
 * 2. Apaga dos filhos para os pais. Filhos de verdade pendurados num exemplo
 *    (ex.: tarefa criada num projeto de exemplo) saem junto, como no
 *    ON DELETE CASCADE.
 *
 * Não mexe em filmes, equipe, perguntas, modelos, kits, catálogo, usuários
 * nem configurações.
 */

const D = "'demo-%'";
/** Eventos que saem: os de exemplo e os de projetos de exemplo. */
const EVENTS_OUT = `select id from events where id like ${D} or project_id like ${D}`;
/** Escalas que saem: as de exemplo e as de projetos de exemplo. */
const CREW_OUT = `select id from project_crew where id like ${D} or project_id like ${D}`;

export type CleanupStatement = { sql: string; table?: string };

export const DEMO_CLEANUP: CleanupStatement[] = [
  /* 1. Solta vínculos de registros de verdade */
  { sql: `update leads set client_id = null where client_id like ${D} and id not like ${D}` },
  { sql: `update projects set client_id = null where client_id like ${D} and id not like ${D}` },
  { sql: `update projects set lead_id = null where lead_id like ${D} and id not like ${D}` },
  { sql: `update projects set quote_id = null where quote_id like ${D} and id not like ${D}` },
  { sql: `update quotes set client_id = null where client_id like ${D} and id not like ${D}` },
  { sql: `update quotes set lead_id = null where lead_id like ${D} and id not like ${D}` },
  { sql: `update quotes set project_id = null where project_id like ${D} and id not like ${D}` },
  {
    sql: `update project_crew set freelancer_id = null where freelancer_id like ${D} and id not like ${D} and project_id not like ${D}`,
  },
  { sql: `update finance_entries set project_id = null where project_id like ${D} and id not like ${D}` },
  { sql: `update finance_entries set client_id = null where client_id like ${D} and id not like ${D}` },
  { sql: `update finance_entries set freelancer_id = null where freelancer_id like ${D} and id not like ${D}` },
  { sql: `update finance_entries set quote_id = null where quote_id like ${D} and id not like ${D}` },
  { sql: `update finance_entries set crew_id = null where crew_id in (${CREW_OUT}) and id not like ${D}` },
  {
    sql: `update call_sheets set event_id = null where event_id in (${EVENTS_OUT}) and id not like ${D} and project_id not like ${D}`,
  },
  /* Drive (docs/dev/drive.md §3): os exemplos não criam linhas drive_*; um link que leve a exemplo para
     de funcionar e todo vínculo com exemplo vira null. Nada é apagado (o que chegou fica registrado). */
  {
    sql: `update drive_links set revogado_em = now() where revogado_em is null and (project_id like ${D} or client_id like ${D} or event_id in (${EVENTS_OUT}))`,
  },
  { sql: `update drive_projetos set project_id = null where project_id like ${D}` },
  { sql: `update drive_projetos set client_id = null where client_id like ${D}` },
  { sql: `update drive_diarias set event_id = null where event_id in (${EVENTS_OUT})` },
  { sql: `update drive_diarias set project_id = null where project_id like ${D}` },
  { sql: `update drive_links set event_id = null where event_id in (${EVENTS_OUT})` },
  { sql: `update drive_links set project_id = null where project_id like ${D}` },
  { sql: `update drive_links set client_id = null where client_id like ${D}` },
  { sql: `update drive_lotes set project_id = null where project_id like ${D}` },
  { sql: `update drive_lotes set client_id = null where client_id like ${D}` },
  { sql: `update drive_lotes set event_id = null where event_id in (${EVENTS_OUT})` },
  { sql: `update drive_lotes set freelancer_id = null where freelancer_id like ${D}` },
  { sql: `update drive_compartilhamentos set project_id = null where project_id like ${D}` },
  { sql: `update drive_compartilhamentos set client_id = null where client_id like ${D}` },

  /* 2. Apaga, dos filhos para os pais */
  { table: "finance_payments", sql: `delete from finance_payments where id like ${D} or entry_id like ${D}` },
  { table: "finance_entries", sql: `delete from finance_entries where id like ${D}` },
  {
    table: "event_crew",
    sql: `delete from event_crew where id like ${D} or freelancer_id like ${D} or event_id in (${EVENTS_OUT})`,
  },
  { table: "events", sql: `delete from events where id like ${D} or project_id like ${D}` },
  { table: "call_sheets", sql: `delete from call_sheets where id like ${D} or project_id like ${D}` },
  { table: "project_checklists", sql: `delete from project_checklists where id like ${D} or project_id like ${D}` },
  { table: "scripts", sql: `delete from scripts where id like ${D} or project_id like ${D}` },
  { table: "project_crew", sql: `delete from project_crew where id like ${D} or project_id like ${D}` },
  { table: "project_tasks", sql: `delete from project_tasks where id like ${D} or project_id like ${D}` },
  { table: "project_deliverables", sql: `delete from project_deliverables where id like ${D} or project_id like ${D}` },
  {
    table: "activities",
    sql: `delete from activities where id like ${D} or lead_id like ${D} or client_id like ${D} or project_id like ${D}`,
  },
  { table: "quote_items", sql: `delete from quote_items where id like ${D} or quote_id like ${D}` },
  { table: "quotes", sql: `delete from quotes where id like ${D}` },
  { table: "projects", sql: `delete from projects where id like ${D}` },
  { table: "leads", sql: `delete from leads where id like ${D}` },
  { table: "freelancer_rates", sql: `delete from freelancer_rates where id like ${D} or freelancer_id like ${D}` },
  { table: "freelancers", sql: `delete from freelancers where id like ${D}` },
  { table: "clients", sql: `delete from clients where id like ${D}` },
  { table: "showcase_clients", sql: `delete from showcase_clients where id like ${D}` },
];
