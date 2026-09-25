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

type SeedUser = { name: string; envPrefix: string; email: string; password?: string };

function seedUsersFromEnv(): SeedUser[] {
  return [
    {
      name: "Victor Barroso",
      envPrefix: "ZRO_VICTOR",
      email: process.env.ZRO_VICTOR_EMAIL ?? "victor@zro.local",
      password: process.env.ZRO_VICTOR_PASSWORD,
    },
    {
      name: "Edu Cardoso",
      envPrefix: "ZRO_EDU",
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
        // Não derruba o deploy do site: a conta é criada no próximo deploy com a senha definida.
        console.warn(
          `⚠ Conta de ${u.name} não criada: defina ${u.envPrefix}_EMAIL e ${u.envPrefix}_PASSWORD e faça um novo deploy.`,
        );
        continue;
      }
      password = randomBytes(9).toString("base64url");
    } else if (!opts.allowGenerated && password.length < 10) {
      throw new Error(`A senha de ${u.name} (${u.envPrefix}_PASSWORD) precisa de pelo menos 10 caracteres.`);
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

/** Filmes do canal da ZRO no YouTube (youtube.com/@ZROFilmes). */
const CHANNEL_FILMS = [
  {
    id: "film-yt-uZWsnlQlAes",
    slug: "agae-45-anos",
    title: "AGAÉ · 45 anos",
    client: "AGAÉ",
    category: "filme-de-marca",
    year: 2026,
    duration: "1:43",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=uZWsnlQlAes",
    posterUrl: "https://i.ytimg.com/vi/uZWsnlQlAes/maxresdefault.jpg",
    featured: true,
    sortOrder: 1,
  },
  {
    id: "film-yt-Z1SVYvwo_2Y",
    slug: "agae-tudo-para-a-sua-obra",
    title: "Tudo para a sua obra",
    client: "AGAÉ",
    category: "campanha",
    year: 2026,
    duration: "0:31",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=Z1SVYvwo_2Y",
    posterUrl: "https://i.ytimg.com/vi/Z1SVYvwo_2Y/maxresdefault.jpg",
    featured: false,
    sortOrder: 2,
  },
  {
    id: "film-yt-oLqDLrwoSX4",
    slug: "agae-locacao-a-obra-nao-pode-parar",
    title: "A obra não pode parar",
    client: "AGAÉ Locação",
    category: "campanha",
    year: 2026,
    duration: "0:41",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=oLqDLrwoSX4",
    posterUrl: "https://i.ytimg.com/vi/oLqDLrwoSX4/maxresdefault.jpg",
    featured: false,
    sortOrder: 3,
  },
  {
    id: "film-yt-vphkqS7PLO8",
    slug: "philipeia-brasilidades",
    title: "Brasilidades",
    client: "Philipeia",
    category: "campanha",
    year: 2026,
    duration: "1:05",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=vphkqS7PLO8",
    posterUrl: "https://i.ytimg.com/vi/vphkqS7PLO8/maxresdefault.jpg",
    featured: false,
    sortOrder: 4,
  },
  {
    id: "film-yt-4iNsqpw9jmo",
    slug: "copa-philipeia",
    title: "Copa Philipeia",
    client: "Philipeia",
    category: "experiencia",
    year: 2026,
    duration: "0:46",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=4iNsqpw9jmo",
    posterUrl: "https://i.ytimg.com/vi/4iNsqpw9jmo/maxresdefault.jpg",
    featured: false,
    sortOrder: 5,
  },
  {
    id: "film-yt-PR-NWCrNTw0",
    slug: "copa-philipeia-apresentadora",
    title: "Apresentadora · Copa Philipeia",
    client: "Philipeia",
    category: "conteudo",
    year: 2026,
    duration: "0:47",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=PR-NWCrNTw0",
    posterUrl: "https://i.ytimg.com/vi/PR-NWCrNTw0/maxresdefault.jpg",
    featured: false,
    sortOrder: 6,
  },
  {
    id: "film-yt-Nf67wOAdaUQ",
    slug: "philipeia-making-of",
    title: "Making of",
    client: "Philipeia",
    category: "documental",
    year: 2026,
    duration: "0:33",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=Nf67wOAdaUQ",
    posterUrl: "https://i.ytimg.com/vi/Nf67wOAdaUQ/maxresdefault.jpg",
    featured: false,
    sortOrder: 7,
  },
  {
    id: "film-yt-7j4vOeXhFck",
    slug: "ocupacao-literaria-2026",
    title: "Ocupação Literária · Edição 2026",
    client: "Ocupação Literária",
    category: "experiencia",
    year: 2026,
    duration: "3:29",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=7j4vOeXhFck",
    posterUrl: "https://i.ytimg.com/vi/7j4vOeXhFck/maxresdefault.jpg",
    featured: false,
    sortOrder: 8,
  },
  {
    id: "film-yt-q5r_XmehbhI",
    slug: "easyrev-crescer-70",
    title: "Crescer 70% o seu faturamento",
    client: "EasyRev",
    category: "conteudo",
    year: 2026,
    duration: null,
    format: "9:16",
    videoUrl: "https://www.youtube.com/shorts/q5r_XmehbhI",
    posterUrl: "https://i.ytimg.com/vi/q5r_XmehbhI/oar2.jpg",
    featured: false,
    sortOrder: 9,
  },
  {
    id: "film-yt-xkvcmehxOoo",
    slug: "easyrev-duas-barreiras",
    title: "2 barreiras que travam o seu faturamento",
    client: "EasyRev",
    category: "conteudo",
    year: 2026,
    duration: null,
    format: "9:16",
    videoUrl: "https://www.youtube.com/shorts/xkvcmehxOoo",
    posterUrl: "https://i.ytimg.com/vi/xkvcmehxOoo/oar2.jpg",
    featured: false,
    sortOrder: 10,
  },
];

/** Clientes que aparecem no site (autorizados pelo Victor). */
const SHOWCASE_CLIENTS = ["SERHS", "SESI", "FIEPB", "SUDECO", "Quartzo", "AGAÉ", "Philipeia", "EasyRev", "Ocupação Literária"];

export async function ensureFilms(db: DB) {
  await db.insert(s.films).values(CHANNEL_FILMS).onConflictDoNothing();
}

export async function ensureShowcaseClients(db: DB) {
  if (!(await isEmpty(db, s.showcaseClients))) return;
  await db.insert(s.showcaseClients).values(SHOWCASE_CLIENTS.map((name, i) => ({ name, sortOrder: i })));
}

export async function ensureBaseData(db: DB, opts: { allowGeneratedPasswords: boolean }) {
  await ensureUsers(db, { allowGenerated: opts.allowGeneratedPasswords });
  await ensureSettings(db);
  await ensureCatalog(db);
  await ensureTemplates(db);
  await ensureKits(db);
  await ensureFaqs(db);
  await ensureTeam(db);
  await ensureFilms(db);
  await ensureShowcaseClients(db);
}
