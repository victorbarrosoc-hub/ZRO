"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bool, fail, fromZod, money, ok, str, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { CATALOG_UNITS, CATEGORY_KEYS, FUNNEL_BUDGETS, optionLabel } from "@/lib/domain";
import { addDaysISO, brl, dateBR, todayISO } from "@/lib/format";
import { nextQuoteNumber, otherOpenQuotesForLead } from "@/lib/queries/quotes";
import { ensureClientForLead } from "@/lib/services/clients";
import { createProject } from "@/lib/services/projects";
import { NEW_CLIENT_VALUE, installmentLabels, quoteCode, quoteTotals, scopeFromLead } from "@/lib/services/quotes";
import { getSetting } from "@/lib/settings";

const { quotes, quoteItems, clients, leads, projects, catalogItems, financeEntries } = schema;

const UNIT_KEYS = new Set<string>(CATALOG_UNITS.map((u) => u.key));
const isoDate = (message: string) => z.string({ message }).regex(/^\d{4}-\d{2}-\d{2}$/, message);

/** Todo lugar que mostra orçamento, lead, projeto ou lançamento gerado aqui. */
function revalidateQuote(
  quoteId: string | null,
  related: { leadId?: string | null; clientId?: string | null; projectId?: string | null } = {},
) {
  revalidatePath("/painel/orcamentos");
  if (quoteId) {
    revalidatePath(`/painel/orcamentos/${quoteId}`);
    revalidatePath(`/painel/orcamentos/${quoteId}/timbrado`);
  }
  revalidatePath("/painel/crm");
  if (related.leadId) revalidatePath(`/painel/crm/${related.leadId}`);
  if (related.clientId) {
    revalidatePath("/painel/crm/clientes");
    revalidatePath(`/painel/crm/clientes/${related.clientId}`);
  }
  revalidatePath("/painel/projetos");
  if (related.projectId) revalidatePath(`/painel/projetos/${related.projectId}`);
  revalidatePath("/painel/financeiro");
  revalidatePath("/painel");
}

function isUniqueError(e: unknown) {
  const text = e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? "")}` : String(e);
  return text.includes("UNIQUE");
}

/** "6", "6,5" ou "6.5" → número (ou undefined). */
function decimal(fd: FormData, key: string) {
  const raw = str(fd, key);
  if (raw == null) return undefined;
  const n = Number(raw.replace(/\s|%/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

async function findQuote(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return null;
  return (await db.query.quotes.findFirst({ where: eq(quotes.id, id) })) ?? null;
}

async function itemsOf(quoteId: string) {
  return db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
}

/* ============================== Criar ============================== */

const CreateSchema = z.object({
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  newClientName: z.string().trim().min(2, "Digite o nome do cliente.").max(120, "Nome longo demais.").optional(),
  title: z.string().trim().min(3, "Dê um título ao orçamento.").max(160, "Título longo demais."),
  category: z.enum(CATEGORY_KEYS, { message: "Escolha a categoria." }),
});

export async function createQuote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const rawClient = str(fd, "clientId");
  const parsed = CreateSchema.safeParse({
    leadId: str(fd, "leadId"),
    clientId: rawClient && rawClient !== NEW_CLIENT_VALUE ? rawClient : undefined,
    newClientName: rawClient === NEW_CLIENT_VALUE ? (str(fd, "newClientName") ?? "") : undefined,
    title: str(fd, "title") ?? "",
    category: str(fd, "category"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const data = parsed.data;

  const lead = data.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, data.leadId) }) : null;
  if (data.leadId && !lead) return fail("Lead não encontrado.");

  let clientId = data.clientId ?? lead?.clientId ?? null;
  if (clientId) {
    const exists = await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { id: true } });
    if (!exists) return fail("Cliente não encontrado.", { clientId: ["Cliente não encontrado."] });
  }
  if (!clientId && !lead && !data.newClientName) {
    return fail("Escolha para quem é o orçamento.", { clientId: ["Escolha o cliente."] });
  }
  if (data.newClientName) {
    const [row] = await db.insert(clients).values({ name: data.newClientName, source: "outro" }).returning({ id: clients.id });
    clientId = row.id;
  }

  const [quoteSettings, taxes] = await Promise.all([getSetting("quote"), getSetting("taxes")]);
  const today = todayISO();
  const values = {
    clientId,
    leadId: lead?.id ?? null,
    title: data.title,
    category: data.category,
    status: "rascunho",
    issueDate: today,
    validUntil: addDaysISO(today, Math.max(1, Number(quoteSettings.validityDays) || 15)),
    period: lead?.timing ?? null,
    scope: lead ? scopeFromLead(lead) : null,
    paymentTerms: quoteSettings.paymentTerms || null,
    conditions: (quoteSettings.conditions ?? []).join("\n") || null,
    discount: 0,
    taxRate: Number(taxes.rate) || 0,
    internalNotes: lead?.budget ? `Faixa de investimento informada no funil: ${optionLabel(FUNNEL_BUDGETS, lead.budget)}.` : null,
  };

  let id: string | null = null;
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    const number = await nextQuoteNumber(today.slice(0, 4));
    try {
      const [row] = await db.insert(quotes).values({ ...values, number, version: 1 }).returning({ id: quotes.id });
      id = row.id;
    } catch (e) {
      if (!isUniqueError(e)) throw e;
    }
  }
  if (!id) return fail("Não foi possível numerar o orçamento. Tente de novo.");

  revalidateQuote(id, { leadId: lead?.id, clientId });
  redirect(`/painel/orcamentos/${id}`);
}

/* ============================== Salvar (editor) ============================== */

const SaveSchema = z.object({
  title: z.string().trim().min(3, "Dê um título ao orçamento.").max(160, "Título longo demais."),
  clientId: z.string().optional(),
  category: z.enum(CATEGORY_KEYS, { message: "Escolha a categoria." }),
  issueDate: isoDate("Informe a data de emissão."),
  validUntil: isoDate("Data de validade inválida.").optional(),
  period: z.string().trim().max(200, "Período longo demais.").optional(),
  scope: z.string().trim().max(6000, "Escopo longo demais.").optional(),
  paymentTerms: z.string().trim().max(1000, "Forma de pagamento longa demais.").optional(),
  conditions: z.string().trim().max(4000, "Condições longas demais.").optional(),
  discount: z.number().int().min(0, "O desconto não pode ser negativo.").max(1e11).default(0),
  taxRate: z
    .number({ message: "Alíquota inválida." })
    .min(0, "A alíquota vai de 0 a 100%.")
    .max(100, "A alíquota vai de 0 a 100%.")
    .default(0),
  internalNotes: z.string().trim().max(4000, "Notas longas demais.").optional(),
});

const ItemInput = z.object({
  catalogItemId: z.string().max(64).nullish(),
  description: z.string().max(200, "descrição longa demais (até 200 caracteres)."),
  detail: z.string().max(500, "detalhe longo demais (até 500 caracteres).").nullish(),
  quantity: z.number({ message: "quantidade inválida." }),
  unit: z.string().nullish(),
  unitPrice: z.number({ message: "valor inválido." }).int("valor inválido."),
  unitCost: z.number({ message: "custo inválido." }).int("custo inválido."),
});

type CleanItem = {
  catalogItemId: string | null;
  description: string;
  detail: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  unitCost: number;
};

/** Lê os itens (JSON do campo escondido) com mensagens por linha. */
function readItems(raw: FormDataEntryValue | null): { items: CleanItem[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(String(raw ?? "[]"));
  } catch {
    return { error: "Não consegui ler os itens. Recarregue a página e tente de novo." };
  }
  if (!Array.isArray(data)) return { error: "Não consegui ler os itens." };
  if (data.length > 100) return { error: "No máximo 100 itens por orçamento." };
  const items: CleanItem[] = [];
  for (let i = 0; i < data.length; i++) {
    const parsed = ItemInput.safeParse(data[i]);
    if (!parsed.success) return { error: `Item ${i + 1}: ${parsed.error.issues[0]?.message ?? "confira os dados."}` };
    const it = parsed.data;
    const description = it.description.trim();
    if (!description) return { error: `Item ${i + 1}: escreva a descrição.` };
    if (!(it.quantity > 0) || it.quantity > 100000) return { error: `Item ${i + 1}: a quantidade precisa ser maior que zero.` };
    if (it.unitPrice < 0 || it.unitCost < 0) return { error: `Item ${i + 1}: valores não podem ser negativos.` };
    if (it.unitPrice > 1e11 || it.unitCost > 1e11) return { error: `Item ${i + 1}: valor alto demais.` };
    items.push({
      catalogItemId: it.catalogItemId || null,
      description,
      detail: it.detail?.trim() || null,
      quantity: Math.round(it.quantity * 100) / 100,
      unit: it.unit && UNIT_KEYS.has(it.unit) ? it.unit : null,
      unitPrice: it.unitPrice,
      unitCost: it.unitCost,
    });
  }
  return { items };
}

export async function saveQuote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const quote = await findQuote(fd);
  if (!quote) return fail("Orçamento não encontrado.");

  const internalNotes = str(fd, "internalNotes")?.slice(0, 4000) ?? null;
  if (quote.status !== "rascunho") {
    // Depois de enviado, o que o cliente recebeu não muda: só as notas internas.
    await db.update(quotes).set({ internalNotes }).where(eq(quotes.id, quote.id));
    revalidateQuote(quote.id);
    return ok("Notas internas salvas.");
  }

  const parsed = SaveSchema.safeParse({
    title: str(fd, "title") ?? "",
    clientId: str(fd, "clientId"),
    category: str(fd, "category"),
    issueDate: str(fd, "issueDate"),
    validUntil: str(fd, "validUntil"),
    period: str(fd, "period"),
    scope: str(fd, "scope"),
    paymentTerms: str(fd, "paymentTerms"),
    conditions: str(fd, "conditions"),
    discount: money(fd, "discount"),
    taxRate: decimal(fd, "taxRate"),
    internalNotes: str(fd, "internalNotes"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const data = parsed.data;

  const read = readItems(fd.get("items"));
  if ("error" in read) return fail(read.error, { items: [read.error] });
  const items = read.items;

  if (data.clientId) {
    const exists = await db.query.clients.findFirst({ where: eq(clients.id, data.clientId), columns: { id: true } });
    if (!exists) return fail("Cliente não encontrado.", { clientId: ["Cliente não encontrado."] });
  } else if (!quote.leadId) {
    return fail("Escolha o cliente.", { clientId: ["Escolha o cliente."] });
  }
  if (data.validUntil && data.validUntil < data.issueDate) {
    return fail("A validade não pode ser antes da emissão.", { validUntil: ["A validade não pode ser antes da emissão."] });
  }
  const totals = quoteTotals(items, 0, data.taxRate);
  if (data.discount > totals.subtotal) {
    return fail(`O desconto passa do subtotal (${brl(totals.subtotal)}).`, { discount: ["O desconto passa do subtotal."] });
  }

  // Item de catálogo apagado no meio do caminho: guarda a linha sem o vínculo.
  const catalogIds = [...new Set(items.map((i) => i.catalogItemId).filter((v): v is string => !!v))];
  if (catalogIds.length) {
    const found = await db.select({ id: catalogItems.id }).from(catalogItems).where(inArray(catalogItems.id, catalogIds));
    const known = new Set(found.map((f) => f.id));
    for (const it of items) if (it.catalogItemId && !known.has(it.catalogItemId)) it.catalogItemId = null;
  }

  const update = db
    .update(quotes)
    .set({
      title: data.title,
      clientId: data.clientId ?? null,
      category: data.category,
      issueDate: data.issueDate,
      validUntil: data.validUntil ?? null,
      period: data.period ?? null,
      scope: data.scope ?? null,
      paymentTerms: data.paymentTerms ?? null,
      conditions: data.conditions ?? null,
      discount: data.discount,
      taxRate: data.taxRate,
      internalNotes: data.internalNotes ?? null,
    })
    .where(eq(quotes.id, quote.id));
  const clear = db.delete(quoteItems).where(eq(quoteItems.quoteId, quote.id));
  // Tudo de uma vez (atômico): dados do orçamento e a lista nova de itens.
  if (items.length) {
    await db.batch([update, clear, db.insert(quoteItems).values(items.map((it, i) => ({ ...it, quoteId: quote.id, sortOrder: i })))]);
  } else {
    await db.batch([update, clear]);
  }

  revalidateQuote(quote.id, { leadId: quote.leadId, clientId: data.clientId });
  return ok("Orçamento salvo.");
}

/* ============================== Status ============================== */

export async function markQuoteSent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const quote = await findQuote(fd);
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status !== "rascunho") return fail("Só um rascunho pode ser marcado como enviado.");
  const items = await itemsOf(quote.id);
  const totals = quoteTotals(items, quote.discount, quote.taxRate);
  if (!items.length || totals.total <= 0) return fail("Adicione pelo menos um item com valor antes de enviar.");
  if (!quote.clientId && !quote.leadId) return fail("Escolha o cliente antes de enviar.");
  if (quote.validUntil && quote.validUntil < todayISO()) return fail("A validade já passou. Ajuste a data e salve antes de enviar.");

  await db.update(quotes).set({ status: "enviado", sentAt: new Date() }).where(eq(quotes.id, quote.id));

  let leadMoved = false;
  if (quote.leadId) {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, quote.leadId) });
    if (lead) {
      const patch: Partial<typeof leads.$inferInsert> = {};
      if (lead.stage === "novo" || lead.stage === "conversa") patch.stage = "orcamento";
      if (lead.estimatedValue == null) patch.estimatedValue = totals.total;
      if (Object.keys(patch).length) await db.update(leads).set(patch).where(eq(leads.id, lead.id));
      leadMoved = patch.stage === "orcamento";
    }
  }

  revalidateQuote(quote.id, { leadId: quote.leadId, clientId: quote.clientId });
  return ok(leadMoved ? "Marcado como enviado. O lead foi para Orçamento enviado." : "Marcado como enviado.");
}

export async function revertQuoteToDraft(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const quote = await findQuote(fd);
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status !== "enviado") return fail("Só um orçamento enviado pode voltar para rascunho.");
  await db.update(quotes).set({ status: "rascunho", sentAt: null }).where(eq(quotes.id, quote.id));
  revalidateQuote(quote.id, { leadId: quote.leadId, clientId: quote.clientId });
  return ok("Voltou para rascunho. Pode editar.");
}

const InstallmentsSchema = z
  .array(
    z.object({
      amount: z.number({ message: "Valor da parcela inválido." }).int().positive("Toda parcela precisa de valor."),
      dueDate: isoDate("Informe o vencimento de cada parcela."),
    }),
  )
  .min(1, "Informe as parcelas.")
  .max(3, "No máximo 3 parcelas.");

export async function approveQuote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const quote = await findQuote(fd);
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status === "aprovado") return fail("Este orçamento já foi aprovado.");
  if (quote.status === "recusado") return fail("Orçamento recusado. Crie uma nova versão para aprovar.");

  const sibling = await db.query.quotes.findFirst({
    where: and(eq(quotes.number, quote.number), eq(quotes.status, "aprovado")),
    columns: { version: true },
  });
  if (sibling) return fail(`A versão ${sibling.version} deste orçamento já foi aprovada.`);

  const items = await itemsOf(quote.id);
  const totals = quoteTotals(items, quote.discount, quote.taxRate);
  if (totals.total <= 0) return fail("O orçamento está sem valor. Adicione os itens antes de aprovar.");
  if (!quote.clientId && !quote.leadId) return fail("Escolha o cliente antes de aprovar.");

  let plan: z.infer<typeof InstallmentsSchema>;
  try {
    const parsed = InstallmentsSchema.safeParse(JSON.parse(String(fd.get("installments") ?? "[]")));
    if (!parsed.success) return fromZod(parsed.error);
    plan = parsed.data;
  } catch {
    return fail("Não consegui ler as parcelas.");
  }
  const sum = plan.reduce((s, p) => s + p.amount, 0);
  if (sum !== totals.total) {
    return fail(`A soma das parcelas (${brl(sum)}) precisa fechar o total (${brl(totals.total)}).`);
  }

  // Cliente: o do orçamento ou um novo a partir do lead.
  let clientId = quote.clientId;
  try {
    if (!clientId && quote.leadId) clientId = await ensureClientForLead(quote.leadId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível cadastrar o cliente.");
  }
  const client = clientId ? await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { name: true } }) : null;
  const clientName = client?.name ?? quote.title;

  const project = await createProject({
    title: quote.title,
    clientId,
    leadId: quote.leadId,
    quoteId: quote.id,
    category: quote.category ?? "filme-de-marca",
    value: totals.total,
    briefing: quote.scope,
  });

  const labels = installmentLabels(plan.length);
  const entries = plan.map((p, i) => ({
    kind: "entrada",
    category: "cliente",
    description: `${clientName} · ${labels[i]}`,
    installment: `${i + 1}/${plan.length}`,
    clientId,
    projectId: project.id,
    quoteId: quote.id,
    amount: p.amount,
    dueDate: p.dueDate,
  }));
  const approve = db
    .update(quotes)
    .set({ status: "aprovado", decidedAt: new Date(), projectId: project.id, clientId })
    .where(eq(quotes.id, quote.id));
  const insertEntries = db.insert(financeEntries).values(entries);

  try {
    if (quote.leadId) {
      await db.batch([
        approve,
        insertEntries,
        db
          .update(leads)
          .set({ stage: "ganho", clientId, lostReason: null, estimatedValue: totals.total })
          .where(eq(leads.id, quote.leadId)),
      ]);
    } else {
      await db.batch([approve, insertEntries]);
    }
  } catch {
    // Sem lançamentos, o projeto criado agora não faz sentido: desfaz.
    await db.delete(projects).where(eq(projects.id, project.id));
    return fail("Não foi possível concluir a aprovação. Nada foi alterado; tente de novo.");
  }

  revalidateQuote(quote.id, { leadId: quote.leadId, clientId, projectId: project.id });
  return ok(`Orçamento aprovado. Projeto ${project.code} criado.`, project.id);
}

export async function refuseQuote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const quote = await findQuote(fd);
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status !== "rascunho" && quote.status !== "enviado" && quote.status !== "expirado") {
    return fail("Este orçamento já foi decidido.");
  }
  const reason = str(fd, "reason")?.slice(0, 500);
  const today = todayISO();
  const note = `Recusado em ${dateBR(today)}${reason ? `: ${reason}` : "."}`;

  await db
    .update(quotes)
    .set({
      status: "recusado",
      decidedAt: new Date(),
      internalNotes: [quote.internalNotes, note].filter(Boolean).join("\n\n"),
    })
    .where(eq(quotes.id, quote.id));

  let message = "Orçamento recusado.";
  if (quote.leadId && bool(fd, "markLost")) {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, quote.leadId), columns: { stage: true } });
    const others = await otherOpenQuotesForLead(quote.leadId, quote.number);
    if (lead && lead.stage !== "ganho" && !others.length) {
      await db
        .update(leads)
        .set({ stage: "perdido", lostReason: reason ?? `Orçamento ${quoteCode(quote.number, quote.version)} recusado.` })
        .where(eq(leads.id, quote.leadId));
      message = "Orçamento recusado. O lead foi para Perdido.";
    } else if (others.length) {
      message = "Orçamento recusado. O lead continua aberto: há outro orçamento em andamento.";
    }
  }

  revalidateQuote(quote.id, { leadId: quote.leadId, clientId: quote.clientId });
  return ok(message);
}

/* ============================== Versões e exclusão ============================== */

export async function newQuoteVersion(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const source = await findQuote(fd);
  if (!source) return fail("Orçamento não encontrado.");
  if (source.status === "aprovado") return fail("Orçamento aprovado não ganha nova versão. Crie um orçamento novo.");
  if (source.status === "rascunho") return fail("Este rascunho ainda pode ser editado: não precisa de nova versão.");

  const [latest] = await db
    .select({ version: quotes.version })
    .from(quotes)
    .where(eq(quotes.number, source.number))
    .orderBy(desc(quotes.version))
    .limit(1);
  const version = (latest?.version ?? source.version) + 1;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, source.id));
  const quoteSettings = await getSetting("quote");
  const today = todayISO();
  const id = crypto.randomUUID();

  const insertQuote = db.insert(quotes).values({
    id,
    number: source.number,
    version,
    clientId: source.clientId,
    leadId: source.leadId,
    title: source.title,
    category: source.category,
    status: "rascunho",
    issueDate: today,
    validUntil: addDaysISO(today, Math.max(1, Number(quoteSettings.validityDays) || 15)),
    period: source.period,
    scope: source.scope,
    paymentTerms: source.paymentTerms,
    conditions: source.conditions,
    discount: source.discount,
    taxRate: source.taxRate,
    internalNotes: source.internalNotes,
  });
  try {
    if (items.length) {
      await db.batch([
        insertQuote,
        db.insert(quoteItems).values(
          items.map((it) => ({
            quoteId: id,
            catalogItemId: it.catalogItemId,
            description: it.description,
            detail: it.detail,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            unitCost: it.unitCost,
            sortOrder: it.sortOrder,
          })),
        ),
      ]);
    } else {
      await db.batch([insertQuote]);
    }
  } catch (e) {
    if (isUniqueError(e)) return fail("Outra versão acabou de ser criada. Recarregue a página.");
    throw e;
  }

  revalidateQuote(id, { leadId: source.leadId, clientId: source.clientId });
  revalidatePath(`/painel/orcamentos/${source.id}`);
  redirect(`/painel/orcamentos/${id}`);
}

export async function deleteQuote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const quote = await findQuote(fd);
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status !== "rascunho") return fail("Só rascunhos podem ser excluídos.");

  await db.batch([
    db.delete(quoteItems).where(eq(quoteItems.quoteId, quote.id)),
    db.delete(quotes).where(eq(quotes.id, quote.id)),
  ]);

  const [previous] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.number, quote.number))
    .orderBy(desc(quotes.version))
    .limit(1);

  revalidateQuote(null, { leadId: quote.leadId, clientId: quote.clientId });
  redirect(previous ? `/painel/orcamentos/${previous.id}` : "/painel/orcamentos");
}
