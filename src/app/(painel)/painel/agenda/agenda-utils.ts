/**
 * Utilitários puros da agenda: grade do mês, faixas de eventos de vários
 * dias, rótulos de data e hora. Rodam no servidor e no navegador.
 */
import { addDaysISO, daysBetween, monthLong } from "@/lib/format";

export const WEEKDAY_HEADERS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

const WEEKDAYS_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
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

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "2026-09-30" → "quarta-feira" */
export function weekdayLong(iso: string) {
  return WEEKDAYS_LONG[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

/** "2026-09" válido? */
export function isMonthParam(v: string | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function isDateParam(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime());
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Segunda-feira da semana de uma data (a semana da agenda começa na segunda). */
export function mondayOf(iso: string) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDaysISO(iso, -((dow + 6) % 7));
}

/** Semanas (segunda a domingo) que cobrem o mês inteiro. */
export function monthGrid(ym: string) {
  const first = `${ym}-01`;
  const last = addDaysISO(`${shiftMonth(ym, 1)}-01`, -1);
  const start = mondayOf(first);
  const end = addDaysISO(mondayOf(last), 6);
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = addDaysISO(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysISO(d, i)));
  }
  return { first, last, start, end, weeks };
}

/** "setembro de 2026" → "Setembro de 2026" */
export function monthTitle(ym: string) {
  return capitalize(monthLong(ym));
}

/** Último dia de um evento (o próprio dia, se não tiver data final). */
export function eventEnd(ev: { date: string; endDate: string | null }) {
  return ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
}

export function eventDays(ev: { date: string; endDate: string | null }) {
  return daysBetween(ev.date, eventEnd(ev)) + 1;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Todos os dias entre duas datas, inclusive. */
export function eachDay(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

type Layoutable = { id: string; date: string; endDate: string | null; startTime: string | null; title: string };

export type WeekSegment<T> = {
  event: T;
  startCol: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Distribui os eventos de uma semana em faixas: evento de vários dias vira
 * uma barra contínua; os outros ocupam a primeira faixa livre do dia.
 */
export function layoutWeek<T extends Layoutable>(week: string[], events: T[]) {
  const ws = week[0];
  const we = week[week.length - 1];
  const segments: WeekSegment<T>[] = events
    .filter((e) => rangesOverlap(e.date, eventEnd(e), ws, we))
    .map((e) => {
      const s = e.date < ws ? ws : e.date;
      const end = eventEnd(e) > we ? we : eventEnd(e);
      return {
        event: e,
        startCol: daysBetween(ws, s),
        span: daysBetween(s, end) + 1,
        lane: 0,
        continuesBefore: e.date < ws,
        continuesAfter: eventEnd(e) > we,
      };
    });

  segments.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.span - a.span ||
      (a.event.startTime ?? "").localeCompare(b.event.startTime ?? "") ||
      a.event.title.localeCompare(b.event.title, "pt-BR"),
  );

  const lanes: boolean[][] = [];
  for (const seg of segments) {
    let lane = 0;
    for (;;) {
      lanes[lane] ??= Array<boolean>(7).fill(false);
      let free = true;
      for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
        if (lanes[lane][c]) {
          free = false;
          break;
        }
      }
      if (free) break;
      lane++;
    }
    for (let c = seg.startCol; c < seg.startCol + seg.span; c++) lanes[lane][c] = true;
    seg.lane = lane;
  }
  return { segments, laneCount: lanes.length };
}

/** "07:00–15:00", "07:00" ou "" (dia todo). */
export function timeRange(ev: { startTime: string | null; endTime: string | null }) {
  if (ev.startTime && ev.endTime) return `${ev.startTime}–${ev.endTime}`;
  return ev.startTime ?? (ev.endTime ? `até ${ev.endTime}` : "");
}

function dayMonth(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)} de ${MONTHS_LONG[Number(m) - 1]}`;
}

/**
 * "quarta-feira, 30 de setembro de 2026"
 * "8 a 10 de outubro de 2026"
 * "30 de setembro a 2 de outubro de 2026"
 */
export function dateRangeLong(date: string, endDate: string | null) {
  const end = endDate && endDate > date ? endDate : null;
  if (!end) return `${weekdayLong(date)}, ${dayMonth(date)} de ${date.slice(0, 4)}`;
  const [y1, m1, d1] = date.split("-");
  const [y2, m2] = end.split("-");
  if (y1 !== y2) return `${dayMonth(date)} de ${y1} a ${dayMonth(end)} de ${y2}`;
  if (m1 !== m2) return `${dayMonth(date)} a ${dayMonth(end)} de ${y2}`;
  return `${Number(d1)} a ${dayMonth(end)} de ${y2}`;
}

/** "30/09" */
export function dayMonthShort(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** ["Ana"] → "Ana"; ["Ana", "Bia", "Caio"] → "Ana, Bia e Caio" */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Visual de cada tipo de evento no calendário (cor fica só para status). */
export const EVENT_CHIP: Record<string, string> = {
  diaria: "border-white/25 bg-white/[0.11] text-white",
  entrega: "border-white/35 bg-transparent text-light",
  reuniao: "border-line-strong bg-white/[0.035] text-light",
  // a agenda de um sócio: tracejado, para não se confundir com a produção da ZRO
  freela: "border-dashed border-white/35 bg-white/[0.04] text-light",
  pessoal: "border-dashed border-line-strong bg-transparent text-ash",
  outro: "border-line bg-transparent text-ash",
};

/** "Edu · Freela" (agenda de um sócio) ou só "Diária" (agenda da ZRO). */
export function eventKicker(ev: { type: string; ownerName?: string | null }, typeLabel: string) {
  const dono = ev.ownerName?.trim().split(/\s+/)[0];
  return dono ? `${dono} · ${typeLabel}` : typeLabel;
}

export function eventChipClass(type: string) {
  return EVENT_CHIP[type] ?? EVENT_CHIP.outro;
}

/** "14 a 20 de setembro" ou "28 de setembro a 4 de outubro" (semana de segunda a domingo). */
export function weekTitle(monday: string) {
  const sunday = addDaysISO(monday, 6);
  const [y1, m1] = monday.split("-");
  const [y2, m2] = sunday.split("-");
  if (y1 !== y2) return `${dayMonth(monday)} de ${y1} a ${dayMonth(sunday)} de ${y2}`;
  if (m1 !== m2) return `${dayMonth(monday)} a ${dayMonth(sunday)}`;
  return `${Number(monday.slice(8, 10))} a ${dayMonth(sunday)}`;
}
