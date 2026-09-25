/**
 * Versão em texto da ordem do dia, formatada para o WhatsApp
 * (*negrito* e _itálico_). Roda no navegador e no servidor.
 */
import { dateBR } from "@/lib/format";
import { mapsSearchUrl, weekdayLong } from "@/app/(painel)/painel/agenda/agenda-utils";

export type SheetForText = {
  title: string;
  date: string;
  callTime?: string | null;
  location?: string | null;
  locationUrl?: string | null;
  schedule: { time: string; activity: string; notes?: string | null }[];
  crew: { name: string; role: string; phone?: string | null; call?: string | null }[];
  contacts: { name: string; role: string; phone?: string | null }[];
  notes?: string | null;
};

export function callSheetText(sheet: SheetForText, project: { code: string; title: string }) {
  const lines: string[] = [];
  const clean = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) =>
    rows.filter((r) => keys.some((k) => String(r[k] ?? "").trim()));

  lines.push(`*Ordem do dia · ${sheet.title.trim() || "sem título"}*`);
  lines.push(`${project.title} (${project.code})`);
  lines.push("");
  if (sheet.date) lines.push(`*Data:* ${weekdayLong(sheet.date)}, ${dateBR(sheet.date)}`);
  if (sheet.callTime) lines.push(`*Chegada:* ${sheet.callTime}`);
  if (sheet.location?.trim()) lines.push(`*Local:* ${sheet.location.trim()}`);
  const map = sheet.locationUrl?.trim() || (sheet.location?.trim() ? mapsSearchUrl(sheet.location.trim()) : "");
  if (map) lines.push(`*Mapa:* ${map}`);

  const schedule = clean(sheet.schedule, ["time", "activity", "notes"]);
  if (schedule.length) {
    lines.push("", "*Cronograma*");
    for (const r of schedule) {
      lines.push(`${r.time || "--:--"} · ${r.activity.trim()}${r.notes?.trim() ? ` _(${r.notes.trim()})_` : ""}`);
    }
  }

  const crew = clean(sheet.crew, ["name", "role", "phone", "call"]);
  if (crew.length) {
    lines.push("", "*Equipe*");
    for (const c of crew) {
      lines.push(
        [c.name.trim(), c.role?.trim(), c.call ? `chega ${c.call}` : null, c.phone?.trim()].filter(Boolean).join(" · "),
      );
    }
  }

  const contacts = clean(sheet.contacts, ["name", "role", "phone"]);
  if (contacts.length) {
    lines.push("", "*Contatos*");
    for (const c of contacts) lines.push([c.name.trim(), c.role?.trim(), c.phone?.trim()].filter(Boolean).join(" · "));
  }

  if (sheet.notes?.trim()) lines.push("", "*Observações*", sheet.notes.trim());
  lines.push("", "_ZRO Filmes · Onde tudo começa e o comum termina._");
  return lines.join("\n");
}
