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

/** Telefone sem o +55, só dígitos. */
function localPhoneDigits(phone: string) {
  const d = phone.replace(/\D/g, "");
  return (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
}

/** "84999197374" → "(84) 99919-7374"; fixo com 10 dígitos → "(84) 3211-1234". Outro formato volta como veio. */
export function formatPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return null;
  const d = localPhoneDigits(phone);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone.trim();
}

/** Máscara enquanto digita: (84) 99919-7374. */
export function maskPhone(input: string) {
  const d = localPhoneDigits(input).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const rest = d.slice(2);
  const head = rest.length === 9 ? 5 : 4;
  return rest.length > head ? `(${d.slice(0, 2)}) ${rest.slice(0, head)}-${rest.slice(head)}` : `(${d.slice(0, 2)}) ${rest}`;
}

/** Só dígitos de um telefone brasileiro, com DDI 55. */
export function whatsappDigits(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/** CPF (11 dígitos) ou CNPJ (14) com máscara; outro formato volta como veio. */
export function formatDocument(doc: string | null | undefined) {
  if (!doc) return null;
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

/** Máscara enquanto digita: CPF até 11 dígitos, CNPJ a partir do 12º. */
export function maskDocument(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(?=\d)/, "$1.").replace(/(\d{3}\.\d{3})(?=\d)/, "$1.").replace(/(\d{3}\.\d{3}\.\d{3})(?=\d)/, "$1-");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
}

/** CPF com os dígitos verificadores certos. */
export function isValidCpf(value: string | null | undefined) {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** "@zro", "instagram.com/zro/" ou "https://www.instagram.com/zro" → "zro". */
export function instagramHandle(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/[/?#].*$/, "")
      .trim() || undefined
  );
}

/** Endereço do perfil, só para @ com cara de @ (letras, números, ponto e _). */
export function instagramUrl(value: string | null | undefined) {
  const handle = instagramHandle(value);
  return handle && /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
