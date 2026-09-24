"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, money, ok, str, type ActionResult } from "@/lib/actions";
import { FINANCE_CATEGORIES, FINANCE_KINDS, PAYMENT_METHODS } from "@/lib/domain";
import { brl, dateBR, monthLong } from "@/lib/format";
import {
  addMonthsISO,
  dasDueDate,
  dasEntriesFor,
  isMonthKey,
  monthOf,
  revenueInMonth,
  shiftMonth,
} from "@/lib/queries/finance";
import { deletePayment, registerPayment } from "@/lib/services/finance";
import { getSetting } from "@/lib/settings";

const { financeEntries, financePayments } = schema;

const KIND_KEYS = FINANCE_KINDS.map((k) => k.key) as [string, ...string[]];
const METHOD_KEYS = PAYMENT_METHODS.map((m) => m.key) as [string, ...string[]];

type Links = { projectId?: string | null; freelancerId?: string | null; clientId?: string | null } | null | undefined;

/** Revalida tudo que mostra lançamentos: as três telas do financeiro, o painel e as fichas ligadas. */
function touch(...links: Links[]) {
  revalidatePath("/painel/financeiro");
  revalidatePath("/painel/financeiro/fluxo");
  revalidatePath("/painel/financeiro/impostos");
  revalidatePath("/painel");
  const paths = new Set<string>();
  for (const l of links) {
    if (!l) continue;
    if (l.projectId) {
      paths.add(`/painel/projetos/${l.projectId}`);
      paths.add("/painel/projetos");
    }
    if (l.freelancerId) {
      paths.add(`/painel/freelas/${l.freelancerId}`);
      paths.add("/painel/freelas");
    }
    if (l.clientId) paths.add(`/painel/crm/clientes/${l.clientId}`);
  }
  for (const p of paths) revalidatePath(p);
}

/* ============================== Lançamentos ============================== */

const EntrySchema = z
  .object({
    kind: z.enum(KIND_KEYS, { message: "Escolha o tipo." }),
    category: z.string({ message: "Escolha a categoria." }),
    description: z
      .string({ message: "Digite a descrição." })
      .min(2, "Digite a descrição.")
      .max(200, "Descrição longa demais."),
    amount: z.number({ message: "Digite o valor." }).int().positive("Digite um valor maior que zero."),
    dueDate: z.iso.date({ message: "Escolha o vencimento." }),
    projectId: z.string().optional(),
    clientId: z.string().optional(),
    freelancerId: z.string().optional(),
    installment: z.string().max(20, "Parcela: até 20 caracteres.").optional(),
    competence: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência no formato AAAA-MM.")
      .optional(),
    notes: z.string().max(2000, "Observação longa demais.").optional(),
  })
  .refine((d) => FINANCE_CATEGORIES.some((c) => c.key === d.category && c.kind === d.kind), {
    message: "Escolha uma categoria deste tipo.",
    path: ["category"],
  });

/** Competência aceita "2026-09" (campo de mês) ou "09/2026" (digitada). */
function readCompetence(fd: FormData) {
  const raw = str(fd, "competence");
  if (!raw) return undefined;
  const typed = raw.match(/^(\d{1,2})\/(\d{4})$/);
  return typed ? `${typed[2]}-${typed[1].padStart(2, "0")}` : raw;
}

function readEntry(fd: FormData) {
  return EntrySchema.safeParse({
    kind: str(fd, "kind"),
    category: str(fd, "category"),
    description: str(fd, "description"),
    amount: money(fd, "amount"),
    dueDate: str(fd, "dueDate"),
    projectId: str(fd, "projectId"),
    clientId: str(fd, "clientId"),
    freelancerId: str(fd, "freelancerId"),
    installment: str(fd, "installment"),
    competence: readCompetence(fd),
    notes: str(fd, "notes"),
  });
}

/** Campos gravados: cliente só em entrada, freela só em saída, competência só em imposto. */
function shape(d: z.infer<typeof EntrySchema>) {
  return {
    kind: d.kind,
    category: d.category,
    description: d.description,
    amount: d.amount,
    dueDate: d.dueDate,
    projectId: d.projectId ?? null,
    clientId: d.kind === "entrada" ? (d.clientId ?? null) : null,
    freelancerId: d.kind === "saida" ? (d.freelancerId ?? null) : null,
    // Imposto sem competência: o mês anterior ao vencimento (DAS, ISS e INSS vencem no mês seguinte).
    competence: d.kind === "imposto" ? (d.competence ?? shiftMonth(monthOf(d.dueDate), -1)) : null,
    installment: d.installment ?? null,
    notes: d.notes ?? null,
  };
}

const RepeatSchema = z.number().int().min(1).max(12);

export async function createEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readEntry(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const repeat = RepeatSchema.safeParse(Number(str(fd, "repeat") ?? "1"));
  if (!repeat.success) return fail("Repita por 1 a 12 meses.", { repeat: ["Repita por 1 a 12 meses."] });

  const n = repeat.data;
  const base = shape(parsed.data);
  const rows = Array.from({ length: n }, (_, i) => ({
    ...base,
    dueDate: addMonthsISO(base.dueDate, i),
    competence: base.competence ? shiftMonth(base.competence, i) : null,
    installment: n > 1 ? `${i + 1}/${n}` : base.installment,
  }));

  let firstId: string | undefined;
  try {
    const inserted = await db.insert(financeEntries).values(rows).returning({ id: financeEntries.id });
    firstId = inserted[0]?.id;
  } catch {
    return fail("Não foi possível salvar. Confira o projeto, o cliente e o freela escolhidos.");
  }
  touch(base);
  const first = rows[0];
  const last = rows[rows.length - 1];
  return ok(
    n > 1
      ? `${n} lançamentos criados, de ${dateBR(first.dueDate)} a ${dateBR(last.dueDate)}.`
      : `Lançamento criado. Vence em ${dateBR(first.dueDate)}.`,
    firstId,
  );
}

export async function updateEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const current = id ? await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, id) }) : undefined;
  if (!current) return fail("Lançamento não encontrado.");
  const parsed = readEntry(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const data = shape(parsed.data);
  if (data.amount < current.paidAmount) {
    const msg = `O valor não pode ficar abaixo do que já foi baixado (${brl(current.paidAmount)}).`;
    return fail(msg, { amount: [msg] });
  }
  try {
    await db.update(financeEntries).set(data).where(eq(financeEntries.id, current.id));
  } catch {
    return fail("Não foi possível salvar. Confira o projeto, o cliente e o freela escolhidos.");
  }
  touch(current, data);
  return ok("Lançamento atualizado.");
}

export async function deleteEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const entry = id ? await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, id) }) : undefined;
  if (!entry) return fail("Lançamento não encontrado.");
  // As baixas saem junto (sem depender do ON DELETE CASCADE do SQLite).
  await db.batch([
    db.delete(financePayments).where(eq(financePayments.entryId, entry.id)),
    db.delete(financeEntries).where(eq(financeEntries.id, entry.id)),
  ]);
  touch(entry);
  return ok("Lançamento excluído.");
}

/* ============================== Baixas ============================== */

const PaySchema = z.object({
  amount: z.number({ message: "Digite o valor." }).int().positive("Digite um valor maior que zero."),
  date: z.iso.date({ message: "Escolha a data." }),
  method: z.enum(METHOD_KEYS, { message: "Escolha a forma de pagamento." }),
  notes: z.string().max(300, "Observação longa demais.").optional(),
});

/** Registra uma baixa (total ou parcial) de qualquer lançamento. */
export async function payEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const entryId = str(fd, "entryId");
  const entry = entryId ? await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, entryId) }) : undefined;
  if (!entry) return fail("Lançamento não encontrado.");
  const parsed = PaySchema.safeParse({
    amount: money(fd, "amount"),
    date: str(fd, "date"),
    method: str(fd, "method"),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const open = Math.max(0, entry.amount - entry.paidAmount);
  if (open <= 0) return fail("Este lançamento já está quitado.");
  if (parsed.data.amount > open) {
    const msg = `O valor passa do que falta (${brl(open)}).`;
    return fail(msg, { amount: [msg] });
  }
  try {
    await registerPayment({ entryId: entry.id, ...parsed.data });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível registrar a baixa.");
  }
  touch(entry);
  const done = parsed.data.amount === open;
  if (entry.kind === "entrada") return ok(done ? "Recebimento registrado. Lançamento quitado." : "Recebimento parcial registrado.");
  return ok(done ? "Pagamento registrado. Lançamento quitado." : "Pagamento parcial registrado.");
}

export async function removePayment(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const paymentId = str(fd, "paymentId");
  const payment = paymentId ? await db.query.financePayments.findFirst({ where: eq(financePayments.id, paymentId) }) : undefined;
  if (!payment) return fail("Baixa não encontrada.");
  const entry = await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, payment.entryId) });
  await deletePayment(payment.id);
  touch(entry);
  return ok("Baixa excluída.");
}

/* ============================== Impostos ============================== */

/** Lança o DAS de uma competência: receita recebida no mês × alíquota de Ajustes, vencendo dia 20 do mês seguinte. */
export async function launchDas(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const month = str(fd, "month");
  if (!isMonthKey(month)) return fail("Competência inválida.");
  if ((await dasEntriesFor(month)).length) return fail(`O DAS de ${monthLong(month)} já foi lançado.`);
  const [revenue, taxes] = await Promise.all([revenueInMonth(month), getSetting("taxes")]);
  const rate = Number(taxes.rate) || 0;
  if (rate <= 0) return fail("Defina a alíquota efetiva em Ajustes antes de lançar o DAS.");
  const amount = Math.round((revenue * rate) / 100);
  if (amount <= 0) return fail(`Não há receita recebida em ${monthLong(month)} para calcular o DAS.`);
  const dueDate = dasDueDate(month);
  const [row] = await db
    .insert(financeEntries)
    .values({
      kind: "imposto",
      category: "das",
      description: `DAS · competência ${monthLong(month)}`,
      competence: month,
      amount,
      dueDate,
    })
    .returning({ id: financeEntries.id });
  touch(null);
  return ok(`DAS de ${monthLong(month)} lançado: ${brl(amount)}, vence em ${dateBR(dueDate)}.`, row.id);
}
