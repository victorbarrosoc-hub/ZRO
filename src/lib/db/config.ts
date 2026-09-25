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

const isIntegrationUrl = (key: string, value: string | undefined) => key.endsWith("_URL") && !!value?.startsWith("libsql://");

function fromVercelIntegration(env: NodeJS.ProcessEnv) {
  const key = Object.keys(env)
    .sort()
    .find((k) => isIntegrationUrl(k, env[k]));
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

/**
 * Todos os bancos diferentes que o ambiente oferece, com os nomes das
 * variáveis (nunca os tokens). Mais de um = dois bancos ligados ao projeto,
 * e o site poderia ler um e gravar no outro de um deploy para o seguinte.
 */
export function databaseCandidates(env: NodeJS.ProcessEnv = process.env) {
  const byUrl = new Map<string, string[]>();
  for (const key of Object.keys(env).sort()) {
    const value = env[key];
    const counts = key === "DATABASE_URL" || key === "TURSO_DATABASE_URL" ? !!value : isIntegrationUrl(key, value);
    if (!counts || !value) continue;
    byUrl.set(value, [...(byUrl.get(value) ?? []), key]);
  }
  return [...byUrl.entries()].map(([url, keys]) => ({ url, keys, label: databaseLabel(url) }));
}

/** Nome curto e seguro do banco, para mostrar na tela e no log (sem token). */
export function databaseLabel(url: string) {
  if (url.startsWith("file:")) return `arquivo local (${url.replace(/^file:(\.\/)?/, "")})`;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".turso.io") ? `${host.split(".")[0]} (Turso)` : host;
  } catch {
    return "endereço inválido";
  }
}
