/**
 * Conexão com o banco (endereço em ./config.ts).
 * Produção: Postgres do Supabase (postgres.js). Computador: PGlite em ./data/pglite.
 * Este arquivo não importa "server-only" para poder ser usado pelos scripts.
 */
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { LOCAL_DATABASE_DIR, databaseConfig } from "./config";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const config = databaseConfig();
const globalForDb = globalThis as unknown as { zroDb?: DB; zroPglite?: PGlite; zroSql?: postgres.Sql };

function connect(): DB {
  if (!config.server) {
    // Scripts de banco (migrate, seed): abrem o arquivo do PGlite direto.
    mkdirSync(LOCAL_DATABASE_DIR, { recursive: true });
    const client = globalForDb.zroPglite ?? new PGlite(LOCAL_DATABASE_DIR);
    globalForDb.zroPglite = client;
    // O PGlite fala o mesmo Postgres: as consultas são as mesmas da produção.
    return drizzlePglite(client, { schema, casing: "snake_case" }) as unknown as DB;
  }
  // Pooler do Supabase (modo transação): sem prepared statements, poucas conexões por função.
  // Local (servidor do PGlite): uma conexão só, que ele atende uma consulta por vez.
  const sql =
    globalForDb.zroSql ??
    postgres(config.url, { prepare: false, max: config.local ? 1 : 5, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });
  globalForDb.zroSql = sql;
  return drizzlePostgres(sql, { schema, casing: "snake_case" });
}

export const db = globalForDb.zroDb ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.zroDb = db;

/** Aplica as migrações pendentes (pasta ./drizzle). */
export async function runMigrations() {
  if (!config.server) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
  }
}

/** Fecha a conexão (scripts terminam mais rápido). */
export async function closeDatabase() {
  await globalForDb.zroSql?.end({ timeout: 5 });
  await globalForDb.zroPglite?.close();
}

export { schema };

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Várias escritas que valem juntas (tudo ou nada), na ordem dada.
 * Monte as consultas com o `t` recebido: elas só rodam aqui, dentro da transação.
 */
export async function transact(build: (t: Tx) => PromiseLike<unknown>[]) {
  return db.transaction(async (t) => {
    for (const query of build(t)) await query;
  });
}
