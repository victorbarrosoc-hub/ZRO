import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
  optionLabel,
} from "./domain";

export type LeadInput = {
  projectType: string;
  idea?: string;
  company?: string;
  segment?: string;
  timing?: string;
  city?: string;
  days?: string;
  videos?: string;
  format?: string;
  extras?: string[];
  budget?: string;
  name: string;
  phone?: string;
  email?: string;
};

/** Monta a mensagem que chega no WhatsApp da ZRO, já encaminhada. */
export function buildLeadMessage(lead: LeadInput, protocol?: string) {
  const lines: string[] = ["Olá, ZRO! Vim pelo site e quero um orçamento.", ""];
  const add = (label: string, value: string | undefined | null) => {
    const v = (value ?? "").trim();
    if (v && v !== "—") lines.push(`• ${label}: ${v}`);
  };

  add("Projeto", optionLabel(FUNNEL_PROJECT_TYPES, lead.projectType));
  const company = [lead.company, lead.segment ? `(${lead.segment})` : ""].filter(Boolean).join(" ");
  add("Empresa", company);
  add("Quando/onde", [lead.timing, lead.city].filter(Boolean).join(", "));
  if (lead.days) add("Diárias", optionLabel(FUNNEL_DAYS, lead.days));
  const videos = [lead.videos ? optionLabel(FUNNEL_VIDEOS, lead.videos) : "", lead.format ? optionLabel(FUNNEL_FORMATS, lead.format).toLowerCase() : ""]
    .filter(Boolean)
    .join(", ");
  add("Vídeos", videos);
  if (lead.extras?.length) add("Extras", lead.extras.map((e) => optionLabel(FUNNEL_EXTRAS, e)).join(", "));
  if (lead.budget) add("Investimento", optionLabel(FUNNEL_BUDGETS, lead.budget));
  add("Ideia", lead.idea);

  lines.push("", `Meu nome é ${lead.name.trim()}.`);
  if (protocol) lines.push(`(protocolo ${protocol})`);
  return lines.join("\n");
}
