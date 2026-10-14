/**
 * Prepara o banco para uso real (produção): migrações, usuários (senhas
 * vindas do ambiente), configurações, catálogo, modelos, kits, FAQ, equipe
 * e o filme manifesto. Sem dados de exemplo. Só cria o que falta, então
 * roda em todo deploy da Vercel antes do build (npm run vercel-build).
 *
 * Uso: ZRO_VICTOR_EMAIL=... ZRO_VICTOR_PASSWORD=... ZRO_EDU_EMAIL=... ZRO_EDU_PASSWORD=... npm run db:setup
 */
import { databaseCandidates, databaseConfig, databaseLabel } from "../src/lib/db/config";

const { local, url } = databaseConfig();
if (local && process.env.VERCEL) {
  // Na Vercel não existe disco para banco local: sem Postgres, o site sobe quebrado.
  console.error(
    "\n✖ Falta o banco de dados.\n" +
      "  Defina DATABASE_URL (Postgres com pooler, ex.: integração Neon) nas variáveis\n" +
      "  de ambiente da Vercel. Passo a passo no DEPLOY.md.\n",
  );
  process.exit(1);
}

// Dois bancos ligados ao mesmo projeto: um deploy poderia ler um e o seguinte o
// outro, e os dados "sumiriam". Melhor o deploy parar do que escolher sozinho.
const candidates = databaseCandidates();
if (process.env.VERCEL && candidates.length > 1) {
  console.error(
    "\n✖ Há mais de um banco de dados ligado a este projeto:\n" +
      candidates.map((c) => `  - ${c.label}: ${c.keys.join(", ")}`).join("\n") +
      "\n  Deixe só o banco certo (DATABASE_URL). O site no ar continua como estava. Veja o DEPLOY.md.\n",
  );
  process.exit(1);
}
const { db, runMigrations, closeDatabase } = await import("../src/lib/db/client");
const s = await import("../src/lib/db/schema");
const { ensureBaseData } = await import("./lib/base-data");
const { databaseSummary, ensureDatabaseIdentity, recordDeploy, summaryLine } = await import("../src/lib/db/summary");

await runMigrations();
const found = await databaseSummary(db);

// Continuidade: em produção, cada deploy precisa usar o MESMO banco do deploy anterior.
// Banco vazio, ou que não viu o último deploy publicado, é banco trocado ou cópia nova:
// publicar esconderia o CRM. Melhor parar e deixar o site no ar como está.
// Vale mesmo sem VERCEL_GIT_PREVIOUS_SHA (redeploy, deploy pela API): em out/2026 a
// integração do Turso criou um banco vazio por deploy e a trava antiga não viu.
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (process.env.VERCEL_ENV === "production" && process.env.ZRO_ACEITAR_BANCO_NOVO !== "1") {
  const seen = found.identity?.deploys ?? [];
  const problem = !found.firstSetupAt
    ? "este deploy recebeu um banco VAZIO"
    : seen.length === 0
      ? "este banco não tem o histórico de publicações do banco oficial"
      : previousSha && !seen.includes(previousSha)
        ? "este banco não é o mesmo que o último deploy publicado usava"
        : null;
  if (problem) {
    console.error(
      `\n✖ Deploy parado para proteger os dados: ${problem}.\n` +
        `  Banco deste deploy: ${databaseLabel(url)}.\n` +
        "  Confira a variável DATABASE_URL na Vercel. O site no ar continua com os dados de antes.\n" +
        "  Banco novo de propósito (primeira publicação nele)? Crie ZRO_ACEITAR_BANCO_NOVO=1,\n" +
        "  publique e depois apague a variável. Veja o DEPLOY.md.\n",
    );
    await closeDatabase();
    process.exit(1);
  }
}

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
    posterUrl: "/media/manifesto-capa.jpg",
    summary: "Tudo começa do zero.",
    featured: true,
  })
  .onConflictDoNothing();
const identity = await ensureDatabaseIdentity(db);
if (process.env.VERCEL_GIT_COMMIT_SHA) await recordDeploy(db, process.env.VERCEL_GIT_COMMIT_SHA);
const where = process.env.VERCEL_ENV ? ` · ambiente ${process.env.VERCEL_ENV}` : "";
console.log(`Banco pronto: ${databaseLabel(url)} · id ${identity.id.slice(0, 8)}${where} · ${summaryLine(found)}`);
await closeDatabase();
