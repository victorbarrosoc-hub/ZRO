import "server-only";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "./jwt";
import { passwordFingerprint } from "./session";

/**
 * Usuário logado lido do cookie da própria requisição (route handlers de mídia: miniatura, token do
 * stream, proxy). Mesma regra de getSessionUser: sessão assinada, usuário existe e a senha não mudou.
 * Não usa cookies() do next/headers: dá para chamar fora do ciclo da página (e nos testes).
 */
export async function usuarioDaRequisicao(request: Pick<NextRequest, "cookies">): Promise<{ id: string; name: string } | null> {
  const sessao = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!sessao || sessao.expiresAt < Date.now()) return null;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, sessao.userId),
    columns: { id: true, name: true, passwordHash: true },
  });
  if (!user || passwordFingerprint(user.passwordHash) !== sessao.pv) return null;
  return { id: user.id, name: user.name };
}
