"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
} from "@/lib/domain";
import { whatsappDigits } from "@/lib/format";
import { buildLeadMessage } from "@/lib/lead-message";
import { getSetting } from "@/lib/settings";

const keys = <T extends readonly { key: string }[]>(list: T) => list.map((o) => o.key) as [string, ...string[]];
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const LeadSchema = z.object({
  projectType: z.enum(keys(FUNNEL_PROJECT_TYPES), { message: "Escolha o tipo de projeto." }),
  idea: optionalText(1200),
  company: optionalText(120),
  segment: optionalText(80),
  timing: optionalText(80),
  city: optionalText(80),
  days: z.enum(keys(FUNNEL_DAYS)).optional(),
  videos: z.enum(keys(FUNNEL_VIDEOS)).optional(),
  format: z.enum(keys(FUNNEL_FORMATS)).optional(),
  extras: z.array(z.enum(keys(FUNNEL_EXTRAS))).max(10).default([]),
  budget: z.enum(keys(FUNNEL_BUDGETS)).optional(),
  name: z.string().trim().min(2, "Faltou o seu nome. Como a gente te chama?").max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Confira o número com DDD."),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, "Confira o e-mail."),
  consent: z.literal(true, { message: "Precisamos do seu ok para guardar esses dados." }),
  website: z.string().max(0).optional(), // armadilha para robôs
});

export type LeadResult =
  | { ok: true; message: string; whatsappUrl: string | null; mailtoUrl: string | null; protocol: string }
  | { ok: false; error: string; field?: string };

// Limite simples por IP, em memória: no máximo 5 pedidos por hora por instância.
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function submitLead(input: unknown): Promise<LeadResult> {
  const parsed = LeadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Confira os dados.", field: String(issue?.path[0] ?? "") };
  }
  const data = parsed.data;
  if (!data.phone && !data.email) {
    return { ok: false, error: "Deixe um WhatsApp ou e-mail para a gente responder.", field: "phone" };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(ip)) {
    return { ok: false, error: "Recebemos vários pedidos seguidos. Tente de novo em alguns minutos." };
  }

  const [lead] = await db
    .insert(schema.leads)
    .values({
      name: data.name,
      company: data.company,
      segment: data.segment,
      email: data.email,
      phone: data.phone,
      projectType: data.projectType,
      idea: data.idea,
      timing: data.timing,
      city: data.city,
      days: data.days,
      videos: data.videos,
      format: data.format,
      extras: data.extras,
      budget: data.budget,
      stage: "novo",
      source: "site",
      consentAt: new Date(),
    })
    .returning({ id: schema.leads.id });

  const protocol = lead.id.slice(0, 4).toUpperCase();
  const message = buildLeadMessage(data, protocol);
  const [whatsapp, company] = await Promise.all([getSetting("whatsapp"), getSetting("company")]);
  const number = whatsappDigits(whatsapp.number);
  const text = encodeURIComponent(message);

  revalidatePath("/painel");
  revalidatePath("/painel/crm");

  return {
    ok: true,
    message,
    protocol,
    whatsappUrl: number ? `https://wa.me/${number}?text=${text}` : null,
    mailtoUrl: company.email
      ? `mailto:${company.email}?subject=${encodeURIComponent("Orçamento pelo site")}&body=${text}`
      : null,
  };
}
