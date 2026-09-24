/**
 * Onde está o banco. Local: arquivo SQLite em ./data/zro.db.
 * Produção: Turso (libSQL). Aceita, nesta ordem:
 * - DATABASE_URL / DATABASE_AUTH_TOKEN (definidas à mão);
 * - TURSO_DATABASE_URL / TURSO_AUTH_TOKEN;
 * - o par que a integração da Turso na Vercel cria, com o prefixo escolhido
 *   na conexão (ex.: STORAGE_URL + STORAGE_AUTH_TOKEN).
 * Sem "server-only" para os scripts e o drizzle.config poderem usar.
 */
export const LOCAL_DATABASE_URL = "file:./data/zro.db";

function fromVercelIntegration(env: NodeJS.ProcessEnv) {
  const key = Object.keys(env)
    .sort()
    .find((k) => k.endsWith("_URL") && env[k]?.startsWith("libsql://"));
  if (!key) return null;
  const prefix = key.replace(/(_DATABASE)?_URL$/, "");
  const authToken =
    env[`${prefix}_AUTH_TOKEN`] || env[`${prefix}_DATABASE_AUTH_TOKEN`] || env[`${prefix}_TOKEN`] || undefined;
  return { url: env[key]!, authToken };
}

export function databaseConfig() {
  const env = process.env;
  const explicit = env.DATABASE_URL || env.TURSO_DATABASE_URL;
  const found = explicit
    ? { url: explicit, authToken: env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined }
    : fromVercelIntegration(env);
  const url = found?.url ?? LOCAL_DATABASE_URL;
  return { url, authToken: found?.authToken, local: url.startsWith("file:") };
}
