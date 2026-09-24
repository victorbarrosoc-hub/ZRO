/**
 * Assinatura e leitura do token de sessão (JWT HS256).
 * Sem "server-only" porque o proxy também usa.
 */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "zro_session";
export const SESSION_DAYS = 14;

export type SessionPayload = {
  userId: string;
  name: string;
  expiresAt: number;
};

const DEV_SECRET = "zro-dev-secret-apenas-para-desenvolvimento-local";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Defina SESSION_SECRET (32+ caracteres) no ambiente de produção.");
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.name !== "string") return null;
    return { userId: payload.userId, name: payload.name, expiresAt: Number(payload.expiresAt) };
  } catch {
    return null;
  }
}
