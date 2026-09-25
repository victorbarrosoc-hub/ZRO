/**
 * Conexão com o banco (endereço em ./config.ts).
 * Este arquivo não importa "server-only" para poder ser usado pelos scripts.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseConfig } from "./config";
import * as schema from "./schema";

const { url, authToken, local } = databaseConfig();

const globalForDb = globalThis as unknown as { zroLibsql?: Client };

export const libsql = globalForDb.zroLibsql ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.zroLibsql = libsql;

if (local) {
  // SQLite local não liga as chaves estrangeiras sozinho.
  void libsql.execute("PRAGMA foreign_keys = ON");
}

export const db = drizzle(libsql, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
