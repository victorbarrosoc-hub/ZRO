/**
 * Dados base: usuários, configurações, catálogo, modelos, kits, FAQ e equipe.
 * Só cria o que ainda não existe, então pode rodar várias vezes.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DB } from "../../src/lib/db/client";
import * as s from "../../src/lib/db/schema";
import { hashPassword } from "../../src/lib/auth/password";
import {
  DEFAULT_CATALOG,
  DEFAULT_FAQS,
  DEFAULT_KITS,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
} from "../../src/lib/db/defaults";

type SeedUser = { name: string; email: string; password?: string };

function seedUsersFromEnv(): SeedUser[] {
  return [
    {
      name: "Victor Barroso",
      email: process.env.ZRO_VICTOR_EMAIL ?? "victor@zro.local",
      password: process.env.ZRO_VICTOR_PASSWORD,
    },
    {
      name: "Edu Cardoso",
      email: process.env.ZRO_EDU_EMAIL ?? "edu@zro.local",
      password: process.env.ZRO_EDU_PASSWORD,
    },
  ];
}

export async function ensureUsers(db: DB, opts: { allowGenerated: boolean }) {
  const created: { email: string; password: string }[] = [];
  for (const u of seedUsersFromEnv()) {
    const exists = await db.query.users.findFirst({ where: eq(s.users.email, u.email.toLowerCase()) });
    if (exists) continue;
    let password = u.password;
    if (!password) {
      if (!opts.allowGenerated) {
        throw new Error(
          `Defina a senha de ${u.name} (ZRO_VICTOR_PASSWORD / ZRO_EDU_PASSWORD) antes de criar os usuários em produção.`,
        );
      }
      password = randomBytes(9).toString("base64url");
    }
    await db.insert(s.users).values({
      name: u.name,
      email: u.email.toLowerCase(),
      passwordHash: await hashPassword(password),
    });
    created.push({ email: u.email.toLowerCase(), password: u.password ? "(definida no ambiente)" : password });
  }
  if (created.length && opts.allowGenerated) {
    mkdirSync("./data", { recursive: true });
    const lines = created.map((c) => `${c.email}  ${c.password}`).join("\n");
    writeFileSync("./data/credenciais-dev.txt", `Acesso local à área interna (não versionado)\n\n${lines}\n`, {
      flag: "a",
    });
    console.log("\nUsuários criados (senhas também em data/credenciais-dev.txt):\n" + lines + "\n");
  }
}

export async function ensureSettings(db: DB) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }
}

async function isEmpty(db: DB, table: SQLiteTable) {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(table);
  return Number(row?.n ?? 0) === 0;
}

export async function ensureCatalog(db: DB) {
  if (!(await isEmpty(db, s.catalogItems))) return;
  await db.insert(s.catalogItems).values(DEFAULT_CATALOG.map((c, i) => ({ ...c, sortOrder: i })));
}

export async function ensureTemplates(db: DB) {
  if (!(await isEmpty(db, s.projectTemplates))) return;
  await db.insert(s.projectTemplates).values(DEFAULT_TEMPLATES.map((t) => ({ ...t, tasks: [...t.tasks] })));
}

export async function ensureKits(db: DB) {
  if (!(await isEmpty(db, s.equipmentKits))) return;
  await db.insert(s.equipmentKits).values(DEFAULT_KITS.map((k) => ({ ...k, items: [...k.items] })));
}

export async function ensureFaqs(db: DB) {
  if (!(await isEmpty(db, s.faqs))) return;
  await db.insert(s.faqs).values(DEFAULT_FAQS.map((f, i) => ({ ...f, sortOrder: i })));
}

export async function ensureTeam(db: DB) {
  if (!(await isEmpty(db, s.teamMembers))) return;
  await db.insert(s.teamMembers).values([
    { name: "Victor Barroso", role: "Sócio · Direção criativa", sortOrder: 0 },
    { name: "Edu Cardoso", role: "Sócio · Produção executiva e financeiro", sortOrder: 1 },
  ]);
}

export async function ensureBaseData(db: DB, opts: { allowGeneratedPasswords: boolean }) {
  await ensureUsers(db, { allowGenerated: opts.allowGeneratedPasswords });
  await ensureSettings(db);
  await ensureCatalog(db);
  await ensureTemplates(db);
  await ensureKits(db);
  await ensureFaqs(db);
  await ensureTeam(db);
}
