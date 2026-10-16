import "server-only";
import { SITE_URL } from "@/lib/site-url";

/**
 * Prévias da Vercel. O src/proxy.ts já cobre /painel (e não muda); as rotas novas fora de /painel
 * (/api/google/*, /enviar, /cliente) têm esta guarda própria, com a mesma regra do proxy.
 */
export const OFFICIAL_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : SITE_URL;

export function ehPrevia(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/** Na prévia: 307 para o mesmo caminho no endereço oficial. Fora dela: null. */
export function paraOficial(request: Request): Response | null {
  if (!ehPrevia()) return null;
  const url = new URL(request.url);
  return Response.redirect(new URL(url.pathname + url.search, OFFICIAL_URL), 307);
}
