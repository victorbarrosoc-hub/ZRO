/**
 * Endereço público do site, usado em metadados, sitemap e links absolutos.
 * Ordem: NEXT_PUBLIC_SITE_URL → domínio de produção da Vercel → padrão.
 */
function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return process.env.NODE_ENV === "production" ? "https://zrofilmes.vercel.app" : "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl().replace(/\/+$/, "");
