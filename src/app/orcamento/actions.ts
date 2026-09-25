"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, count, eq, gt } from "drizzle-orm";
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

/*
 * Freio contra spam. Acima do limite o pedido não entra no CRM, mas a pessoa
 * recebe o link do WhatsApp do mesmo jeito: cliente de verdade nunca é barrado.
 * - por IP, em memória: 5 pedidos por hora (vale por instância do servidor);
 * - no site todo, pelo banco: 30 pedidos em 10 minutos.
 */
const HOUR = 60 * 60 * 1000;
const hits = new Map<string, number[]>();
function tooManyFromIp(ip: string) {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [key, times] of hits) if (times.every((t) => now - t > HOUR)) hits.delete(key);
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < HOUR);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

async function tooManyOnSite() {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.source, "site"), gt(schema.leads.createdAt, since)));
  return (row?.n ?? 0) >= 30;
}

async function saveLead(data: z.infer<typeof LeadSchema>) {
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
  return lead;
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

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = tooManyFromIp(ip) || (await tooManyOnSite());

  const lead = limited ? null : await saveLead(data);
  const protocol = (lead?.id ?? randomUUID()).slice(0, 4).toUpperCase();
  const message = buildLeadMessage(data, protocol);
  const [whatsapp, company] = await Promise.all([getSetting("whatsapp"), getSetting("company")]);
  const number = whatsappDigits(whatsapp.number);
  const text = encodeURIComponent(message);

  if (lead) {
    revalidatePath("/painel");
    revalidatePath("/painel/crm");
  }

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
