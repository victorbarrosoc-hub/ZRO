"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";

export type LoginState = { error?: string; email?: string } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
  password: z.string().min(1, "Digite a senha."),
  next: z.string().optional(),
});

// Hash qualquer, só para o tempo de resposta não revelar se o e-mail existe.
const DUMMY_HASH = "$2b$12$/dQxQT0Ze8Zg/txtvYxXYuzue8YGyeQcfLoi4DAEu7ttf8dH3w1W6";
const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, email: String(formData.get("email") ?? "") };
  }
  const { email, password, next } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000);
  const [fails] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.loginAttempts)
    .where(
      and(
        eq(schema.loginAttempts.email, email),
        eq(schema.loginAttempts.success, false),
        gte(schema.loginAttempts.createdAt, since),
      ),
    );
  if (Number(fails?.n ?? 0) >= MAX_FAILS) {
    return { error: `Muitas tentativas. Espere ${WINDOW_MIN} minutos e tente de novo.`, email };
  }

  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  await db.insert(schema.loginAttempts).values({ email, ip, success: Boolean(user && ok) });

  if (!user || !ok) {
    return { error: "E-mail ou senha não conferem.", email };
  }

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession(user);

  const target = next && next.startsWith("/painel") && !next.startsWith("//") ? next : "/painel";
  redirect(target);
}

export async function logout() {
  await deleteSession();
  redirect("/entrar");
}
