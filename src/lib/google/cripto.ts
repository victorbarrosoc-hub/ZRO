import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/**
 * Segredos do Drive no banco: refresh token, token dos links e URI das sessões de envio.
 * AES-256-GCM com a chave ZRO_DRIVE_KEY (variável própria: trocar SESSION_SECRET não derruba o Drive).
 * Formato "v1.<iv>.<cifra>.<tag>" em base64url. O AAD é o contexto ("drive_envios.sessao:<id>"…):
 * a cifra de uma linha não serve em outra.
 *
 * Nada lança no import. Sem a chave em produção, só `selar`/`abrir` lançam.
 */

export class ChaveErrada extends Error {
  constructor() {
    super("Não deu para abrir o segredo (chave trocada ou dado adulterado).");
    this.name = "ChaveErrada";
  }
}

const DEV_KEY_TEXT = "zro-dev-drive-key";

function chave(): Buffer {
  const v = process.env.ZRO_DRIVE_KEY;
  if (!v) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Defina ZRO_DRIVE_KEY (openssl rand -base64 32) nas variáveis da Vercel.");
    }
    return createHash("sha256").update(DEV_KEY_TEXT).digest();
  }
  const k = Buffer.from(v, "base64");
  if (k.length !== 32) throw new Error("ZRO_DRIVE_KEY precisa ter 32 bytes em base64 (openssl rand -base64 32).");
  return k;
}

export function selar(texto: string, contexto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  c.setAAD(Buffer.from(contexto, "utf8"));
  const cifra = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return ["v1", iv.toString("base64url"), cifra.toString("base64url"), tag.toString("base64url")].join(".");
}

/** Abre um segredo selado. Chave trocada, contexto errado ou dado adulterado: ChaveErrada. */
export function abrir(selado: string, contexto: string): string {
  const k = chave(); // sem chave em produção: lança a mensagem de configuração, não ChaveErrada
  const partes = String(selado ?? "").split(".");
  if (partes.length !== 4 || partes[0] !== "v1") throw new ChaveErrada();
  try {
    const [, iv, cifra, tag] = partes;
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    d.setAAD(Buffer.from(contexto, "utf8"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(cifra, "base64url")), d.final()]).toString("utf8");
  } catch {
    throw new ChaveErrada();
  }
}

/** Token de link: 256 bits em base64url (43 caracteres). */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** O banco guarda só isto para achar o link (sha256 hex). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Mesmo segredo de desenvolvimento do src/lib/auth/jwt.ts (lá ele não é exportado).
const DEV_SESSION_SECRET = "zro-dev-secret-apenas-para-desenvolvimento-local";

/**
 * Chave de 32 bytes derivada (HKDF) do SESSION_SECRET, uma por uso:
 * "zro:google-oauth" (cookie do OAuth) e "zro:area-cliente" (cookie da área do cliente).
 */
export function chaveDerivada(info: string): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  let base = secret;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("Defina SESSION_SECRET (32+ caracteres).");
    base = DEV_SESSION_SECRET;
  }
  return new Uint8Array(hkdfSync("sha256", Buffer.from(base!, "utf8"), Buffer.alloc(0), Buffer.from(info, "utf8"), 32));
}
