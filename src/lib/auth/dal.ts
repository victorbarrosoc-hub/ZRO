import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { passwordFingerprint, readSession } from "./session";

/**
 * Usuário da sessão atual, ou null. Não redireciona: serve para o login e
 * para rotas que respondem 401. Sessão de usuário apagado ou de antes de uma
 * troca de senha não vale.
 */
export const getSessionUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { id: true, name: true, email: true, role: true, photoId: true, passwordHash: true },
  });
  if (!user || passwordFingerprint(user.passwordHash) !== session.pv) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, photoId: user.photoId };
});

/** Usuário logado (Victor ou Edu). Use em toda página e ação da área interna. */
export const requireUser = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
});
