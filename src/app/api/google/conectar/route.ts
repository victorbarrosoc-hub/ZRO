import { randomBytes } from "node:crypto";
import { EncryptJWT } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { googleConfigurado, REDIRECT_URI } from "@/lib/google/config";
import { chaveDerivada } from "@/lib/google/cripto";
import { COOKIE_OAUTH, pkce, urlDeConsentimento } from "@/lib/google/oauth";
import { paraOficial } from "@/lib/google/previa";

/**
 * Começo do "Conectar Google" (Ajustes → Google Drive). state de 32 bytes + PKCE num cookie cifrado
 * (só /api/google, 10 minutos). `?trocar=1`: o usuário confirmou a troca para outra conta.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const previa = paraOficial(request);
  if (previa) return previa;
  const url = new URL(request.url);
  // O Google volta para REDIRECT_URI: o cookie precisa nascer nesse mesmo endereço.
  const retorno = new URL(REDIRECT_URI);
  if (url.host !== retorno.host) return NextResponse.redirect(new URL(url.pathname + url.search, retorno.origin), 307);

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/entrar?next=/painel/ajustes/google", url.origin), 303);
  if (!googleConfigurado().ok) return NextResponse.redirect(new URL("/painel/ajustes/google?erro=config", url.origin), 303);

  const state = randomBytes(32).toString("base64url");
  const { verificador, desafio } = pkce();
  const cookie = await new EncryptJWT({ s: state, v: verificador, u: user.id, t: url.searchParams.get("trocar") === "1" })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .encrypt(chaveDerivada("zro:google-oauth"));

  const res = NextResponse.redirect(urlDeConsentimento({ state, desafio }), 302);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(COOKIE_OAUTH, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
