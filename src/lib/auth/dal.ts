import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { readSession } from "./session";

/** Confere a sessão; sem sessão válida, manda para o login. */
export const verifySession = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/entrar");
  return session;
});

/** Usuário logado (Victor ou Edu). Use em toda página e ação da área interna. */
export const requireUser = cache(async () => {
  const session = await verifySession();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { id: true, name: true, email: true, role: true },
  });
  if (!user) redirect("/entrar");
  return user;
});
