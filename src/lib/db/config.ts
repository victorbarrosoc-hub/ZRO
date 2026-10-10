/**
 * Onde está o banco.
 * - Produção: Postgres no Supabase, em DATABASE_URL (ou POSTGRES_URL, o nome
 *   que a integração Supabase da Vercel cria). Use a URL do pooler
 *   (porta 6543, "Transaction pooler") por causa das funções serverless.
 * - Computador: PGlite (Postgres num arquivo) em ./data/pglite. Com `npm run dev`
 *   ele roda como servidor local (scripts/dev.mjs) e o site conecta por ZRO_LOCAL_DB_URL;
 *   os scripts de banco (migrate, seed) abrem o arquivo direto, com o site parado.
 * Sem "server-only" para os scripts e o drizzle.config poderem usar.
 */
export const LOCAL_DATABASE_DIR = "./data/pglite";

const isPostgresUrl = (value: string | undefined) => !!value && /^postgres(ql)?:\/\//.test(value);

export function databaseConfig() {
  const env = process.env;
  const url = [env.DATABASE_URL, env.POSTGRES_URL].find(isPostgresUrl);
  if (url) return { url, local: false as const, server: true as const };
  const localServer = env.ZRO_LOCAL_DB_URL;
  if (localServer) return { url: localServer, local: true as const, server: true as const };
  return { url: `pglite:${LOCAL_DATABASE_DIR}`, local: true as const, server: false as const };
}

/**
 * Todos os bancos Postgres diferentes que o ambiente oferece, com os nomes das
 * variáveis (nunca as senhas). Mais de um = dois bancos ligados ao projeto,
 * e o site poderia ler um e gravar no outro de um deploy para o seguinte.
 * O mesmo banco por endereços diferentes (pooler e conexão direta) conta uma vez.
 */
export function databaseCandidates(env: NodeJS.ProcessEnv = process.env) {
  const byDatabase = new Map<string, string[]>();
  for (const key of ["DATABASE_URL", "POSTGRES_URL"]) {
    const value = env[key];
    if (!isPostgresUrl(value)) continue;
    const label = databaseLabel(value!);
    byDatabase.set(label, [...(byDatabase.get(label) ?? []), key]);
  }
  return [...byDatabase.entries()].map(([label, keys]) => ({ label, keys }));
}

/** Nome curto e seguro do banco, para mostrar na tela e no log (sem senha). */
export function databaseLabel(url: string) {
  if (url.startsWith("pglite:") || url.includes("@127.0.0.1:")) return "arquivo local (data/pglite)";
  try {
    const u = new URL(url);
    // Supabase: "db.<ref>.supabase.co" (direto) ou usuário "postgres.<ref>" no pooler.
    const ref = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ?? decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
    if (ref) return `${ref} (Supabase)`;
    return `${u.hostname}${u.pathname !== "/" ? u.pathname : ""}`;
  } catch {
    return "endereço inválido";
  }
}
