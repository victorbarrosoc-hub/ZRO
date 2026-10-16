import "server-only";
import { SITE_URL } from "@/lib/site-url";
import { GoogleError } from "./erros";
import { OFFICIAL_URL } from "./previa";

/**
 * Configuração do Google (cliente OAuth "Aplicativo da Web" do projeto "ZRO Site").
 * Nada aqui lança no import: sem as variáveis, Ajustes mostra o que falta e o resto do painel abre normal.
 */

/** O único escopo. Conferido por igualdade exata na lista devolvida (substring aceitaria drive.readonly). */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** Endereço de retorno cadastrado no Google Cloud (Clientes → URIs de redirecionamento). */
export const REDIRECT_URI = `${SITE_URL}/api/google/callback`;

function chaveDoDriveOk(): boolean {
  const v = process.env.ZRO_DRIVE_KEY;
  // Em desenvolvimento, sem a variável, vale a chave de dev (cripto.ts).
  if (!v) return process.env.NODE_ENV !== "production";
  return Buffer.from(v, "base64").length === 32;
}

/** O que falta para o Google funcionar (sem lançar). */
export function googleConfigurado(): { ok: boolean; faltam: string[] } {
  const faltam: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) faltam.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) faltam.push("GOOGLE_CLIENT_SECRET");
  if (!chaveDoDriveOk()) faltam.push("ZRO_DRIVE_KEY");
  return { ok: faltam.length === 0, faltam };
}

/** Id e segredo do cliente OAuth. Sem eles: GoogleError("sem_config"). */
export function credenciais(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GoogleError("sem_config", 0, "Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");
  return { clientId, clientSecret };
}

/**
 * Base do Google falso (scripts/google-mock), só no computador: nunca na Vercel e nunca em produção,
 * porque o segredo do cliente e o refresh token iriam para essa base. E só em endereço local.
 */
export function baseDeTeste(): string | null {
  const base = process.env.ZRO_GOOGLE_API_BASE;
  if (!base || process.env.VERCEL === "1" || process.env.NODE_ENV === "production") return null;
  try {
    const u = new URL(base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Endpoints (função, não constante: os testes trocam o ambiente). */
export function endpoints() {
  const base = baseDeTeste();
  if (base) {
    return {
      auth: `${base}/o/oauth2/v2/auth`,
      token: `${base}/token`,
      revoke: `${base}/revoke`,
      drive: `${base}/drive/v3`,
      upload: `${base}/upload/drive/v3`,
    };
  }
  return {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    revoke: "https://oauth2.googleapis.com/revoke",
    drive: "https://www.googleapis.com/drive/v3",
    upload: "https://www.googleapis.com/upload/drive/v3",
  };
}

function origem(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Origens que podem abrir sessão de envio (vão no `Origin` da sessão retomável). */
export function origensPermitidas(): string[] {
  const lista = [SITE_URL, OFFICIAL_URL, "https://zrofilmes.vercel.app"];
  if (process.env.VERCEL !== "1") lista.push("http://localhost:3000", "http://127.0.0.1:3000");
  return [...new Set(lista.map(origem).filter((o): o is string => !!o))];
}

/**
 * Só uma URI de sessão do Google (ou do mock, nas mesmas condições). Conferido ANTES de qualquer
 * PUT/DELETE do servidor numa URI decifrada.
 */
export function sessaoPermitida(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  const base = baseDeTeste();
  const host = (u.protocol === "https:" && u.host === "www.googleapis.com") || (base !== null && u.origin === base);
  return host && u.pathname.startsWith("/upload/drive/v3/files") && !!u.searchParams.get("upload_id");
}
