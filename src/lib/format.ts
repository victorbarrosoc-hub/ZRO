/** Formatação em português do Brasil: dinheiro, datas e status. */
import type { EntryStatus } from "./domain";

export const TIMEZONE = "America/Fortaleza"; // Natal/RN, UTC-3

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 150000 → "R$ 1.500,00" */
export function brl(cents: number | null | undefined) {
  return brlFormatter.format((cents ?? 0) / 100);
}

/**
 * 1500000 → "R$ 15 mil". Feito à mão (sem Intl compacto) para sair igual
 * no servidor e no navegador.
 */
export function brlCompact(cents: number | null | undefined) {
  const value = (cents ?? 0) / 100;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const one = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
  if (abs >= 1_000_000) return `${sign}R$ ${one(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sign}R$ ${one(abs / 1_000)} mil`;
  return `${sign}R$ ${Math.round(abs)}`;
}

/** "1.500,00", "1500", "R$ 1.500,5" → 150000 (centavos). Vazio → null. */
export function parseBRL(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  let clean = raw.replace(/[^\d.,-]/g, "");
  if (clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if ((clean.match(/\./g) ?? []).length > 1) {
    clean = clean.replace(/\./g, "");
  } else if (/\.\d{3}$/.test(clean)) {
    // "1.500" é milhar, não decimal
    clean = clean.replace(".", "");
  }
  const value = Number(clean);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Centavos → texto editável "1500,00". */
export function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Hoje em Natal, "AAAA-MM-DD". */
export function todayISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T12:00:00Z`).getTime();
  const b = new Date(`${toISO}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-09-24" → "24/09/2026" */
export function dateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-09-24" → "24 set" */
export function dateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "2026-09-24" → "24 de setembro de 2026" */
export function dateLong(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} de ${MONTHS_LONG[Number(m) - 1]} de ${y}`;
}

/** "2026-09" → "setembro de 2026" */
export function monthLong(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS_LONG[Number(m) - 1]} de ${y}`;
}

/** "2026-09" → "set" */
export function monthShort(ym: string) {
  const [, m] = ym.split("-");
  return MONTHS[Number(m) - 1];
}

export function weekdayShort(iso: string) {
  return WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

/** Distância em dias, em português ("hoje", "amanhã", "em 3 dias", "há 2 dias"). */
export function relativeDay(iso: string | null | undefined, today = todayISO()) {
  if (!iso) return "";
  const diff = daysBetween(today, iso);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1) return `em ${diff} dias`;
  return `há ${Math.abs(diff)} dias`;
}

/** Data e hora de um timestamp, em Natal. */
export function dateTimeBR(date: Date | number | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Status de um lançamento financeiro a partir do valor pago e do vencimento. */
export function entryStatus(
  entry: { amount: number; paidAmount: number; dueDate: string },
  today = todayISO(),
): EntryStatus {
  if (entry.paidAmount >= entry.amount) return "pago";
  if (entry.dueDate < today) return "atrasado";
  if (entry.paidAmount > 0) return "parcial";
  return "pendente";
}

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  pago: "Pago",
  parcial: "Parcial",
  atrasado: "Atrasado",
  pendente: "Pendente",
};

/** Só dígitos de um telefone brasileiro, com DDI 55. */
export function whatsappDigits(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
