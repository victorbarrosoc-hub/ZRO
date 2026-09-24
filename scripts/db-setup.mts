/**
 * Prepara um banco novo para uso real (produção): migrações, usuários
 * (senhas obrigatórias no ambiente), configurações, catálogo, modelos,
 * kits, FAQ, equipe e o filme manifesto. Sem dados de exemplo.
 *
 * Uso: ZRO_VICTOR_EMAIL=... ZRO_VICTOR_PASSWORD=... ZRO_EDU_EMAIL=... ZRO_EDU_PASSWORD=... npm run db:setup
 */
import { mkdirSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";

const local = (process.env.DATABASE_URL ?? "file:./data/zro.db").startsWith("file:");
if (local) mkdirSync("./data", { recursive: true });

const { db } = await import("../src/lib/db/client");
const s = await import("../src/lib/db/schema");
const { ensureBaseData } = await import("./lib/base-data");

await migrate(db, { migrationsFolder: "./drizzle" });
await ensureBaseData(db, { allowGeneratedPasswords: local });
await db
  .insert(s.films)
  .values({
    id: "film-manifesto",
    slug: "manifesto",
    title: "Manifesto",
    client: "ZRO",
    category: "filme-de-marca",
    year: 2026,
    duration: "0:34",
    format: "16:9",
    videoUrl: "/media/manifesto-zro.mp4",
    posterUrl: "/media/manifesto-poster.jpg",
    summary: "Tudo começa do zero.",
    featured: true,
  })
  .onConflictDoNothing();
console.log("Banco pronto.");
