/**
 * Utilitários das Server Actions da área interna.
 * Toda action: requireUser() → validar com zod → gravar → revalidatePath → ActionResult.
 */
import type { z } from "zod";
import { parseBRL } from "./format";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const initialActionState: ActionResult | null = null;

export function ok(message?: string, id?: string): ActionResult {
  return { ok: true, message, id };
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult {
  return { ok: false, error, fieldErrors };
}

/** Converte o erro do zod em { campo: [mensagens] } e devolve a primeira mensagem. */
export function fromZod(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(error.issues[0]?.message ?? "Confira os campos.", fieldErrors);
}

/** Texto do formulário: vazio vira undefined. */
export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

/** Valor em reais do formulário → centavos (ou undefined). */
export function money(fd: FormData, key: string) {
  const cents = parseBRL(fd.get(key));
  return cents == null ? undefined : cents;
}

export function bool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function list(fd: FormData, key: string) {
  return fd
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
}
