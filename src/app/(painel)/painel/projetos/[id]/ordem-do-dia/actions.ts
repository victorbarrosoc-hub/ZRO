"use server";

import { and, asc, eq, gte, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, ok, str, type ActionResult } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import { eventCrewSuggestions } from "@/lib/queries/documents";

const { callSheets, events, projects } = schema;

const time = z.iso.time({ precision: -1, message: "Use o formato 00:00." });
const timeOrEmpty = z.union([time, z.literal("")]);

const CallSheetSchema = z.object({
  title: z.string({ message: "Digite o título." }).min(2, "Digite o título.").max(120, "Título longo demais."),
  date: z.iso.date({ message: "Escolha a data." }),
  callTime: time.optional(),
  location: z.string().max(160, "Local longo demais.").optional(),
  locationUrl: z.url({ protocol: /^https?$/, message: "O link do mapa precisa começar com https://." }).max(600).optional(),
  eventId: z.string().optional(),
  schedule: z
    .array(
      z.object({
        time: timeOrEmpty,
        activity: z.string().max(200, "Atividade longa demais."),
        notes: z.string().max(400, "Observação do cronograma longa demais.").optional(),
      }),
    )
    .max(80, "Cronograma longo demais."),
  crew: z
    .array(
      z.object({
        name: z.string().min(1, "Toda pessoa da equipe precisa de nome.").max(80),
        role: z.string().max(80),
        phone: z.string().max(30, "Telefone longo demais.").optional(),
        call: time.optional(),
      }),
    )
    .max(80, "Equipe longa demais."),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1, "Todo contato precisa de nome.").max(80),
        role: z.string().max(80),
        phone: z.string().max(30, "Telefone longo demais.").optional(),
      }),
    )
    .max(40, "Contatos demais."),
  notes: z.string().max(4000, "Observações longas demais.").optional(),
});

/** Linhas vindas do editor: só texto, aparado, sem linha totalmente vazia. */
function cleanRows(rows: unknown, keys: string[]) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const obj = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      return Object.fromEntries(keys.map((k) => [k, typeof obj[k] === "string" ? (obj[k] as string).trim() : ""]));
    })
    .filter((r) => keys.some((k) => r[k]));
}

const blank = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function revalidateSheet(projectId: string, sheetId?: string) {
  revalidatePath(`/painel/projetos/${projectId}`);
  revalidatePath("/painel/agenda");
  if (sheetId) {
    revalidatePath(`/painel/projetos/${projectId}/ordem-do-dia/${sheetId}`);
    revalidatePath(`/painel/projetos/${projectId}/ordem-do-dia/${sheetId}/imprimir`);
  }
}

/** Cria uma ordem do dia (já puxando a próxima diária sem ordem) e abre o editor. */
export async function newCallSheet(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const projectId = str(fd, "projectId");
  if (!projectId) return fail("Projeto não encontrado.");
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return fail("Projeto não encontrado.");

  const today = todayISO();
  const [upcoming, withSheet] = await Promise.all([
    db
      .select({ id: events.id, title: events.title, date: events.date, startTime: events.startTime, location: events.location })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.type, "diaria"), gte(events.date, today)))
      .orderBy(asc(events.date), asc(events.startTime)),
    db
      .select({ eventId: callSheets.eventId })
      .from(callSheets)
      .where(and(eq(callSheets.projectId, projectId), isNotNull(callSheets.eventId))),
  ]);
  const taken = new Set(withSheet.map((s) => s.eventId));
  // Vindo de um evento da agenda, usa esse evento; senão, a próxima diária ainda sem ordem do dia.
  const eventId = str(fd, "eventId");
  let diaria = upcoming.find((e) => !taken.has(e.id));
  if (eventId) {
    const [chosen] = await db
      .select({ id: events.id, title: events.title, date: events.date, startTime: events.startTime, location: events.location })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.projectId, projectId)))
      .limit(1);
    if (!chosen) return fail("Esse evento não é deste projeto.");
    diaria = chosen;
  }
  const crew = diaria ? ((await eventCrewSuggestions([diaria.id]))[diaria.id] ?? []) : [];

  const [row] = await db
    .insert(callSheets)
    .values({
      projectId,
      eventId: diaria?.id ?? null,
      title: diaria?.title ?? "Ordem do dia",
      date: diaria?.date ?? today,
      callTime: diaria?.startTime ?? null,
      location: diaria?.location ?? null,
      crew: crew.map((c) => ({ name: c.name, role: c.role, ...(c.phone ? { phone: c.phone } : {}) })),
    })
    .returning({ id: callSheets.id });

  revalidateSheet(projectId);
  redirect(`/painel/projetos/${projectId}/ordem-do-dia/${row.id}`);
}

export async function saveCallSheet(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const projectId = str(fd, "projectId");
  if (!id || !projectId) return fail("Ordem do dia não encontrada.");
  const [current] = await db
    .select({ id: callSheets.id })
    .from(callSheets)
    .where(and(eq(callSheets.id, id), eq(callSheets.projectId, projectId)))
    .limit(1);
  if (!current) return fail("Essa ordem do dia não existe mais.");

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(str(fd, "data") ?? "{}");
  } catch {
    return fail("Não foi possível ler a ordem do dia. Recarregue a página.");
  }

  const parsed = CallSheetSchema.safeParse({
    title: blank(raw.title),
    date: blank(raw.date),
    callTime: blank(raw.callTime),
    location: blank(raw.location),
    locationUrl: blank(raw.locationUrl),
    eventId: blank(raw.eventId),
    schedule: cleanRows(raw.schedule, ["time", "activity", "notes"]).map((r) => ({
      time: r.time,
      activity: r.activity,
      notes: r.notes || undefined,
    })),
    crew: cleanRows(raw.crew, ["name", "role", "phone", "call"]).map((r) => ({
      name: r.name,
      role: r.role,
      phone: r.phone || undefined,
      call: r.call || undefined,
    })),
    contacts: cleanRows(raw.contacts, ["name", "role", "phone"]).map((r) => ({
      name: r.name,
      role: r.role,
      phone: r.phone || undefined,
    })),
    notes: blank(raw.notes),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const data = parsed.data;

  let eventId: string | null = null;
  if (data.eventId) {
    const [ev] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, data.eventId), eq(events.projectId, projectId)))
      .limit(1);
    if (!ev) return fail("A diária escolhida não é deste projeto.");
    eventId = ev.id;
  }

  await db
    .update(callSheets)
    .set({
      title: data.title,
      date: data.date,
      callTime: data.callTime ?? null,
      location: data.location ?? null,
      locationUrl: data.locationUrl ?? null,
      eventId,
      schedule: data.schedule,
      crew: data.crew,
      contacts: data.contacts,
      notes: data.notes ?? null,
    })
    .where(eq(callSheets.id, id));

  revalidateSheet(projectId, id);
  // "Imprimir" com alteração pendente: salva e já abre a versão de impressão.
  if (str(fd, "then") === "print") redirect(`/painel/projetos/${projectId}/ordem-do-dia/${id}/imprimir`);
  return ok("Ordem do dia salva.");
}

export async function deleteCallSheet(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const projectId = str(fd, "projectId");
  if (!id || !projectId) return fail("Ordem do dia não encontrada.");
  await db.delete(callSheets).where(and(eq(callSheets.id, id), eq(callSheets.projectId, projectId)));
  revalidateSheet(projectId);
  redirect(`/painel/projetos/${projectId}?aba=documentos`);
}
