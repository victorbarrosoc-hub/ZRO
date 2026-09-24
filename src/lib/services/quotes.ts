/**
 * Contas e regras do orçamento, usadas no editor (navegador), na lista,
 * no timbrado e no PDF. Sem banco aqui, de propósito: o editor roda no
 * navegador e precisa chegar no mesmo número que o servidor.
 * Dinheiro sempre em centavos (inteiro).
 */
import {
  CATEGORIES,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_VIDEOS,
  optionLabel,
  type CategoryKey,
} from "@/lib/domain";
import { addDaysISO, daysBetween } from "@/lib/format";

/* ------------------------------ Totais ------------------------------ */

export type QuoteLine = { quantity: number; unitPrice: number; unitCost?: number | null };

/** Valor de uma linha (quantidade × valor unitário), arredondado ao centavo. */
export function lineTotal(line: QuoteLine) {
  return Math.round((Number(line.quantity) || 0) * (line.unitPrice || 0));
}

/** Custo interno de uma linha (quantidade × custo unitário). */
export function lineCost(line: QuoteLine) {
  return Math.round((Number(line.quantity) || 0) * (line.unitCost || 0));
}

export type QuoteTotals = {
  /** Soma das linhas. */
  subtotal: number;
  /** Desconto aplicado (nunca maior que o subtotal). */
  discount: number;
  /** O que o cliente paga. */
  total: number;
  /** Custo estimado (interno). */
  cost: number;
  /** Imposto estimado sobre o total (interno). */
  tax: number;
  taxRate: number;
  /** Total − custo − imposto (interno). */
  margin: number;
  /** Margem sobre o total, de 0 a 1 (null sem total). */
  marginPct: number | null;
};

/** Margem mínima saudável (abaixo disso, o painel avisa). */
export const MARGIN_MIN = 0.2;

export function quoteTotals(items: QuoteLine[], discount = 0, taxRate = 0): QuoteTotals {
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const appliedDiscount = Math.min(Math.max(0, Math.round(discount || 0)), Math.max(0, subtotal));
  const total = subtotal - appliedDiscount;
  const cost = items.reduce((s, i) => s + lineCost(i), 0);
  const rate = Number.isFinite(taxRate) ? Math.max(0, taxRate) : 0;
  const tax = Math.round((total * rate) / 100);
  const margin = total - cost - tax;
  return {
    subtotal,
    discount: appliedDiscount,
    total,
    cost,
    tax,
    taxRate: rate,
    margin,
    marginPct: total > 0 ? margin / total : null,
  };
}

export type MarginHealth = { tone: "ok" | "warn" | "danger" | "neutral"; label: string; hint?: string };

/** Leitura da margem, sempre com texto (cor nunca é o único sinal). */
export function marginHealth(t: QuoteTotals): MarginHealth {
  if (t.total <= 0) return { tone: "neutral", label: "Sem valor ainda" };
  const hint = t.cost === 0 ? "Sem custos lançados: a margem real vai ser menor." : undefined;
  if (t.margin < 0) return { tone: "danger", label: "Prejuízo", hint };
  if ((t.marginPct ?? 0) < MARGIN_MIN) return { tone: "warn", label: "Margem baixa", hint };
  return { tone: "ok", label: "Margem saudável", hint };
}

/** 0.4432 → "44%" */
export function percentLabel(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

/* ------------------------------ Identificação ------------------------------ */

/** "2026-012 v1" */
export function quoteCode(number: string, version: number) {
  return `${number} v${version}`;
}

/** "Orcamento-ZRO-2026-012-v1.pdf" */
export function quoteFileName(number: string, version: number) {
  return `Orcamento-ZRO-${number}-v${version}.pdf`;
}

/* ------------------------------ Status e validade ------------------------------ */

/** "Enviado" com a validade vencida aparece como "Expirado". */
export function effectiveQuoteStatus(q: { status: string; validUntil: string | null }, today: string) {
  if (q.status === "enviado" && q.validUntil && q.validUntil < today) return "expirado";
  return q.status;
}

export type ValidityInfo = { days: number; tone: "warn" | "danger" | null; label: string };

/**
 * Aviso de validade para orçamentos que ainda dependem dela (rascunho e enviado).
 * Vence em até 3 dias: aviso. Já venceu: alerta.
 */
export function validityInfo(validUntil: string | null, today: string, status: string): ValidityInfo | null {
  if (!validUntil || (status !== "enviado" && status !== "rascunho")) return null;
  const days = daysBetween(today, validUntil);
  if (days < 0) {
    const n = Math.abs(days);
    return { days, tone: "danger", label: n === 1 ? "Venceu ontem" : `Venceu há ${n} dias` };
  }
  if (days === 0) return { days, tone: "warn", label: "Vence hoje" };
  if (days === 1) return { days, tone: "warn", label: "Vence amanhã" };
  if (days <= 3) return { days, tone: "warn", label: `Vence em ${days} dias` };
  return { days, tone: null, label: `em ${days} dias` };
}

/* ------------------------------ Textos ------------------------------ */

/** Condições: uma por linha, sem marcadores repetidos. */
export function parseConditions(text: string | null | undefined) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d{1,2}[.)-])\s*/, "").trim())
    .filter(Boolean);
}

/** 1.5 → "1,5" */
export function quantityLabel(quantity: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(quantity);
}

/* ------------------------------ Timbrado ------------------------------ */

/** Assinatura oficial (documento-mestre §03). Usar exatamente assim. */
export const BRAND_SIGNATURE = "Onde tudo começa e o comum termina.";

/** Fecho da proposta, igual no timbrado e no PDF. */
export const QUOTE_CLOSING =
  "Para aprovar, é só responder a esta proposta. Daí em diante, começamos pela origem: a ideia, o briefing e a intenção.";

/** Rodapé do timbrado: razão social e CNPJ, endereço, contatos. */
export function companyLines(c: {
  legalName: string;
  cnpj: string;
  address: string;
  email: string;
  phone?: string;
  instagram: string;
  website?: string;
}) {
  const join = (parts: (string | null | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(" · ");
  return [
    join([c.legalName, c.cnpj ? `CNPJ ${c.cnpj}` : null]),
    join([c.address]),
    join([c.email, c.phone, c.instagram ? `@${c.instagram.replace(/^@/, "")}` : null, c.website]),
  ].filter(Boolean);
}

/* ------------------------------ Lead → orçamento ------------------------------ */

/** Valor do seletor de cliente que pede um cadastro novo, só com o nome. */
export const NEW_CLIENT_VALUE = "__novo__";

/** Tipo de projeto do funil → categoria do orçamento. */
export function categoryFromProjectType(projectType: string | null | undefined): CategoryKey {
  const direct = CATEGORIES.find((c) => c.key === projectType);
  if (direct) return direct.key;
  // Finalização e color (Absolute ZRO) é desenvolvimento visual: fica em Direção criativa.
  if (projectType === "finalizacao") return "direcao-criativa";
  // "Ainda não sei": começa como filme de marca, o padrão dos projetos.
  return "filme-de-marca";
}

/** Nome do tipo de projeto para o título ("Campanha", "Finalização e color"...). */
export function projectTypeTitle(projectType: string | null | undefined) {
  if (projectType === "finalizacao") return "Finalização e color";
  const direct = CATEGORIES.find((c) => c.key === projectType);
  if (direct) return direct.short;
  return "Projeto audiovisual";
}

/** Título sugerido: "Clínica Aurora · Campanha". */
export function suggestedTitle(who: string | null | undefined, kind: string) {
  return [who?.trim(), kind].filter(Boolean).join(" · ");
}

export type LeadAnswers = {
  idea?: string | null;
  timing?: string | null;
  city?: string | null;
  days?: string | null;
  videos?: string | null;
  format?: string | null;
  extras?: string[] | null;
};

/** Escopo inicial a partir das respostas do funil (o cliente vê: sem faixa de investimento). */
export function scopeFromLead(lead: LeadAnswers) {
  const blocks: string[] = [];
  if (lead.idea?.trim()) blocks.push(lead.idea.trim());
  const bullets: string[] = [];
  if (lead.days && lead.days !== "nao-sei") bullets.push(`Captação: ${optionLabel(FUNNEL_DAYS, lead.days)}`);
  const videos = lead.videos ? optionLabel(FUNNEL_VIDEOS, lead.videos) : null;
  const format = lead.format ? optionLabel(FUNNEL_FORMATS, lead.format).toLowerCase() : null;
  if (videos || format) bullets.push(`Entrega: ${[videos, format].filter(Boolean).join(", ")}`);
  if (lead.extras?.length) {
    bullets.push(`Extras: ${lead.extras.map((e) => optionLabel(FUNNEL_EXTRAS, e).toLowerCase()).join(", ")}`);
  }
  const when = [lead.timing, lead.city].map((v) => v?.trim()).filter(Boolean).join(", ");
  if (when) bullets.push(`Quando e onde: ${when}`);
  if (bullets.length) blocks.push(bullets.map((b) => `• ${b}`).join("\n"));
  return blocks.join("\n\n") || null;
}

/* ------------------------------ Parcelas ------------------------------ */

export type Installment = { label: string; amount: number; dueDate: string };

/** Nome de cada parcela: "entrada" e "saldo" em 2x; "parcela n" em 3x. */
export function installmentLabels(count: number) {
  if (count <= 1) return ["parcela única"];
  if (count === 2) return ["entrada", "saldo"];
  return Array.from({ length: count }, (_, i) => `parcela ${i + 1}`);
}

/**
 * Plano padrão: 1x hoje; 2x com 50% de entrada hoje e o saldo em 30 dias;
 * 3x em partes iguais a cada 30 dias. O último absorve os centavos.
 */
export function defaultInstallments(total: number, count: number, today: string): Installment[] {
  const n = Math.min(3, Math.max(1, Math.round(count)));
  const labels = installmentLabels(n);
  const base = Math.floor(total / n);
  return labels.map((label, i) => ({
    label,
    amount: i === n - 1 ? total - base * (n - 1) : base,
    dueDate: addDaysISO(today, i * 30),
  }));
}
