/**
 * Identidade e tamanho do banco: quem ele é e quanto já tem dentro.
 * Aparece no log de cada deploy e em Ajustes → Dados e backup, para que
 * uma troca de banco nunca passe despercebida.
 * Sem "server-only": o script de deploy também usa.
 */
import { randomUUID } from "node:crypto";
import { count, eq, min } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DB } from "./client";
import * as s from "./schema";

export type DatabaseIdentity = {
  id: string;
  createdAt: string;
  /** Commits dos deploys que já rodaram neste banco (os mais recentes). */
  deploys?: string[];
};

/** Cria a identidade na primeira vez e devolve a que já existe nas outras. */
export async function ensureDatabaseIdentity(db: DB): Promise<DatabaseIdentity> {
  await db
    .insert(s.settings)
    .values({ key: "database", value: { id: randomUUID(), createdAt: new Date().toISOString() } })
    .onConflictDoNothing();
  const row = await db.query.settings.findFirst({ where: eq(s.settings.key, "database") });
  return row!.value as DatabaseIdentity;
}

/** Anota no banco que este deploy rodou nele (para o próximo conferir que é o mesmo banco). */
export async function recordDeploy(db: DB, sha: string) {
  const current = await ensureDatabaseIdentity(db);
  const deploys = [...(current.deploys ?? []).filter((d) => d !== sha), sha].slice(-30);
  await db
    .update(s.settings)
    .set({ value: { ...current, deploys }, updatedAt: new Date() })
    .where(eq(s.settings.key, "database"));
}

const COUNTED = [
  { key: "leads", label: "leads", table: s.leads },
  { key: "clients", label: "clientes", table: s.clients },
  { key: "quotes", label: "orçamentos", table: s.quotes },
  { key: "projects", label: "projetos", table: s.projects },
  { key: "finance", label: "lançamentos", table: s.financeEntries },
  { key: "freelancers", label: "freelas", table: s.freelancers },
] as const satisfies readonly { key: string; label: string; table: PgTable }[];

export type DatabaseSummary = {
  identity: DatabaseIdentity | null;
  /** Quando o banco recebeu as primeiras contas (a criação dele, na prática). */
  firstSetupAt: Date | null;
  counts: { key: (typeof COUNTED)[number]["key"]; label: string; value: number }[];
};

export async function databaseSummary(db: DB): Promise<DatabaseSummary> {
  const [identityRow, [firstUser], ...totals] = await Promise.all([
    db.query.settings.findFirst({ where: eq(s.settings.key, "database") }),
    db.select({ at: min(s.users.createdAt) }).from(s.users),
    ...COUNTED.map((c) => db.select({ n: count() }).from(c.table)),
  ]);
  return {
    identity: (identityRow?.value as DatabaseIdentity | undefined) ?? null,
    firstSetupAt: firstUser?.at ?? null,
    counts: COUNTED.map((c, i) => ({ key: c.key, label: c.label, value: Number(totals[i]?.[0]?.n ?? 0) })),
  };
}

/** Uma linha para o log: "3 leads · 1 orçamentos · …", "vazio" ou "banco novo". */
export function summaryLine(summary: DatabaseSummary) {
  if (!summary.firstSetupAt) return "banco novo, preparado agora";
  const parts = summary.counts.filter((c) => c.value > 0).map((c) => `${c.value} ${c.label}`);
  return parts.length ? parts.join(" · ") : "nenhum lead, cliente, orçamento ou projeto ainda";
}
