import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { todayISO } from "@/lib/format";

const { financeEntries, financePayments } = schema;

/** Recalcula o valor pago de um lançamento a partir das baixas. */
export async function recalcPaid(entryId: string) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${financePayments.amount}), 0)`.mapWith(Number), last: sql<string | null>`max(${financePayments.date})` })
    .from(financePayments)
    .where(eq(financePayments.entryId, entryId));
  const paid = Number(row?.total ?? 0);
  await db
    .update(financeEntries)
    .set({ paidAmount: paid, paidAt: paid > 0 ? (row?.last ?? null) : null })
    .where(eq(financeEntries.id, entryId));
  return paid;
}

/**
 * Registra uma baixa (total ou parcial). Sem valor, quita o que falta.
 * Usado pelo Financeiro, por Freelas e por Projetos.
 */
export async function registerPayment(input: {
  entryId: string;
  amount?: number;
  date?: string;
  method?: string;
  notes?: string;
}) {
  const entry = await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, input.entryId) });
  if (!entry) throw new Error("Lançamento não encontrado.");
  const open = Math.max(0, entry.amount - entry.paidAmount);
  const amount = input.amount ?? open;
  if (amount <= 0) throw new Error("Não há valor em aberto neste lançamento.");
  await db.insert(financePayments).values({
    entryId: entry.id,
    amount,
    date: input.date ?? todayISO(),
    method: input.method,
    notes: input.notes,
  });
  await recalcPaid(entry.id);
  return entry;
}

/** Remove uma baixa e recalcula o lançamento. */
export async function deletePayment(paymentId: string) {
  const payment = await db.query.financePayments.findFirst({ where: eq(financePayments.id, paymentId) });
  if (!payment) return;
  await db.delete(financePayments).where(eq(financePayments.id, paymentId));
  await recalcPaid(payment.entryId);
}
