import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";
import { SITE_URL } from "@/lib/site-url";

/** Endereço oficial (produção). Nas prévias da Vercel, é o domínio de produção do projeto. */
const OFFICIAL_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : SITE_URL;

/**
 * - Prévia da Vercel: a área interna só abre no endereço oficial. Assim ninguém
 *   trabalha, sem perceber, numa cópia de teste do site.
 * - Checagem otimista: sem sessão válida, /painel manda para o login.
 *   A checagem definitiva acontece em cada página e ação (requireUser).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (process.env.VERCEL_ENV === "preview") {
    return NextResponse.redirect(new URL(pathname + search, OFFICIAL_URL));
  }

  if (pathname.startsWith("/painel")) {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = new URL("/entrar", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/entrar"],
};
