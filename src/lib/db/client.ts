/**
 * Conexão com o banco. Local: arquivo SQLite em ./data/zro.db.
 * Produção: Turso (libSQL), com DATABASE_URL e DATABASE_AUTH_TOKEN.
 * Este arquivo não importa "server-only" para poder ser usado pelos scripts.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/zro.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

const globalForDb = globalThis as unknown as { zroLibsql?: Client };

export const libsql = globalForDb.zroLibsql ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.zroLibsql = libsql;

if (url.startsWith("file:")) {
  // SQLite local não liga as chaves estrangeiras sozinho.
  void libsql.execute("PRAGMA foreign_keys = ON");
}

export const db = drizzle(libsql, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
