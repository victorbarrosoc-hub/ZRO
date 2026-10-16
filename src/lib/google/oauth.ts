import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { credenciais, DRIVE_SCOPE, endpoints, REDIRECT_URI } from "./config";
import { deResposta, GoogleError } from "./erros";

/**
 * OAuth 2.0 do Google, fluxo de servidor web com PKCE (S256) e state.
 * Sem login_hint: nenhum e-mail fixo no código; a conta vem do about.get depois.
 */

/** Cookie do "Conectar Google" (state + PKCE, cifrado, só em /api/google, 10 minutos). */
export const COOKIE_OAUTH = "zro_google_oauth";

export function pkce(): { verificador: string; desafio: string } {
  const verificador = randomBytes(32).toString("base64url");
  const desafio = createHash("sha256").update(verificador).digest("base64url");
  return { verificador, desafio };
}

export function urlDeConsentimento({ state, desafio }: { state: string; desafio: string }): string {
  const { clientId } = credenciais();
  const u = new URL(endpoints().auth);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", DRIVE_SCOPE);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "false");
  u.searchParams.set("code_challenge", desafio);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", state);
  return u.toString();
}

type RespostaToken = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };

async function postToken(campos: Record<string, string>): Promise<RespostaToken> {
  let res: Response;
  try {
    res = await fetch(endpoints().token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(campos).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GoogleError("rede", 0, "token");
  }
  const json = (await res.json().catch(() => null)) as RespostaToken | null;
  if (!res.ok || !json?.access_token) throw deResposta(res.status, json);
  return json;
}

/** Troca o código do consentimento. `refresh` null = o Google não mandou (o callback avisa). */
export async function trocarCodigo(
  code: string,
  verificador: string,
): Promise<{ refresh: string | null; acesso: string; expiraEm: number; escopo: string }> {
  const { clientId, clientSecret } = credenciais();
  const j = await postToken({
    grant_type: "authorization_code",
    code,
    code_verifier: verificador,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
  });
  return {
    refresh: j.refresh_token ?? null,
    acesso: j.access_token!,
    expiraEm: Date.now() + (j.expires_in ?? 3600) * 1000,
    escopo: j.scope ?? "",
  };
}

/** Novo token de acesso. invalid_grant (revogado, 6 meses sem uso…) → GoogleError("reconectar"). */
export async function renovarAcesso(refresh: string): Promise<{ acesso: string; expiraEm: number; escopo: string }> {
  const { clientId, clientSecret } = credenciais();
  const j = await postToken({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: clientId,
    client_secret: clientSecret,
  });
  return { acesso: j.access_token!, expiraEm: Date.now() + (j.expires_in ?? 3600) * 1000, escopo: j.scope ?? "" };
}

/** Revoga a concessão inteira (refresh e acessos). Nunca lança: desconectar continua. */
export async function revogar(token: string): Promise<void> {
  try {
    await fetch(endpoints().revoke, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // sem rede: o token some do banco do mesmo jeito
  }
}

/** O escopo devolvido tem o drive completo? (igualdade exata, nunca substring) */
export function escopoTemDrive(escopo: string): boolean {
  return escopo.split(/\s+/).includes(DRIVE_SCOPE);
}
