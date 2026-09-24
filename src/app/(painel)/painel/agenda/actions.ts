"use server";

import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, list, ok, str, type ActionResult } from "@/lib/actions";
import { EVENT_TYPES, FUNCTIONS } from "@/lib/domain";
import { joinNames } from "./agenda-utils";

const { events, eventCrew, freelancers, projects } = schema;

const EVENT_TYPE_KEYS = EVENT_TYPES.map((t) => t.key) as [string, ...string[]];
const FUNCTION_KEYS = new Set<string>(FUNCTIONS.map((f) => f.key));

const time = z.iso.time({ precision: -1, message: "Use o formato 00:00." });

const EventSchema = z
  .object({
    type: z.enum(EVENT_TYPE_KEYS, { message: "Escolha o tipo." }),
    title: z.string({ message: "Digite o título." }).min(2, "Digite o título.").max(120, "Título longo demais."),
    projectId: z.string().optional(),
    date: z.iso.date({ message: "Escolha a data." }),
    endDate: z.iso.date({ message: "Data final inválida." }).optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    location: z.string().max(160, "Local longo demais.").optional(),
    notes: z.string().max(2000, "Observação longa demais.").optional(),
    crew: z.array(z.object({ freelancerId: z.string().min(1), function: z.string().optional() })).max(40),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, {
    path: ["endDate"],
    message: "A data final vem depois da inicial.",
  });

type EventInput = z.infer<typeof EventSchema>;

function readEvent(fd: FormData) {
  const crewIds = [...new Set(list(fd, "crew"))];
  return EventSchema.safeParse({
    type: str(fd, "type") ?? "diaria",
    title: str(fd, "title"),
    projectId: str(fd, "projectId"),
    date: str(fd, "date"),
    endDate: str(fd, "endDate"),
    startTime: str(fd, "startTime"),
    endTime: str(fd, "endTime"),
    location: str(fd, "location"),
    notes: str(fd, "notes"),
    crew: crewIds.map((freelancerId) => {
      const fn = str(fd, `fn:${freelancerId}`);
      return { freelancerId, function: fn && FUNCTION_KEYS.has(fn) ? fn : undefined };
    }),
  });
}

/** Confere o projeto e os freelas (que podem ter sido apagados enquanto a janela estava aberta). */
async function sanitize(data: EventInput) {
  let projectId: string | null = null;
  if (data.projectId) {
    const [p] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, data.projectId)).limit(1);
    if (!p) return { error: "Projeto não encontrado." } as const;
    projectId = p.id;
  }
  const ids = data.crew.map((c) => c.freelancerId);
  const existing = ids.length
    ? new Set(
        (await db.select({ id: freelancers.id }).from(freelancers).where(inArray(freelancers.id, ids))).map((f) => f.id),
      )
    : new Set<string>();
  const endDate = data.endDate && data.endDate > data.date ? data.endDate : null;
  return {
    values: {
      type: data.type,
      title: data.title,
      projectId,
      date: data.date,
      endDate,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      location: data.location ?? null,
      notes: data.notes ?? null,
    },
    crew: data.crew.filter((c) => existing.has(c.freelancerId)),
  } as const;
}

/** "Atenção: Rafael Moura já está em “Diária 3 · Pipa” nesse dia." ou null. */
async function conflictWarning(eventId: string, crewIds: string[], start: string, end: string) {
  if (!crewIds.length) return null;
  const rows = await db
    .select({ name: freelancers.name, eventId: events.id, title: events.title })
    .from(eventCrew)
    .innerJoin(events, eq(eventCrew.eventId, events.id))
    .innerJoin(freelancers, eq(eventCrew.freelancerId, freelancers.id))
    .where(
      and(
        inArray(eventCrew.freelancerId, crewIds),
        ne(events.id, eventId),
        lte(events.date, end),
        gte(sql`coalesce(${events.endDate}, ${events.date})`, start),
      ),
    )
    .orderBy(asc(events.date), asc(freelancers.name));
  if (!rows.length) return null;

  const byEvent = new Map<string, { title: string; names: string[] }>();
  for (const r of rows) {
    const entry = byEvent.get(r.eventId) ?? { title: r.title, names: [] };
    if (!entry.names.includes(r.name)) entry.names.push(r.name);
    byEvent.set(r.eventId, entry);
  }
  const when = start === end ? "nesse dia" : "nesse período";
  const parts = [...byEvent.values()].map(
    (e) => `${joinNames(e.names)} já ${e.names.length > 1 ? "estão" : "está"} em “${e.title}” ${when}.`,
  );
  return `Atenção: ${parts.join(" ")}`;
}

function insertCrew(eventId: string, crew: { freelancerId: string; function?: string }[]) {
  return db.insert(eventCrew).values(crew.map((c) => ({ eventId, freelancerId: c.freelancerId, function: c.function ?? null })));
}

function revalidateEvent(...projectIds: (string | null | undefined)[]) {
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  for (const id of new Set(projectIds)) if (id) revalidatePath(`/painel/projetos/${id}`);
}

export async function createEvent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readEvent(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const clean = await sanitize(parsed.data);
  if ("error" in clean) return fail(clean.error ?? "Confira os campos.");

  const id = crypto.randomUUID();
  const insertEvent = db.insert(events).values({ id, ...clean.values });
  if (clean.crew.length) await db.batch([insertEvent, insertCrew(id, clean.crew)]);
  else await insertEvent;

  const warning = await conflictWarning(
    id,
    clean.crew.map((c) => c.freelancerId),
    clean.values.date,
    clean.values.endDate ?? clean.values.date,
  );
  revalidateEvent(clean.values.projectId);
  return ok(warning ? `Evento salvo. ${warning}` : "Evento salvo.", id);
}

export async function updateEvent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Evento não encontrado.");
  const [current] = await db.select({ id: events.id, projectId: events.projectId }).from(events).where(eq(events.id, id)).limit(1);
  if (!current) return fail("Esse evento não existe mais.");
  const parsed = readEvent(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const clean = await sanitize(parsed.data);
  if ("error" in clean) return fail(clean.error ?? "Confira os campos.");

  // Tudo ou nada: evento e equipe mudam juntos.
  const updateRow = db.update(events).set(clean.values).where(eq(events.id, id));
  const clearCrew = db.delete(eventCrew).where(eq(eventCrew.eventId, id));
  if (clean.crew.length) await db.batch([updateRow, clearCrew, insertCrew(id, clean.crew)]);
  else await db.batch([updateRow, clearCrew]);

  const warning = await conflictWarning(
    id,
    clean.crew.map((c) => c.freelancerId),
    clean.values.date,
    clean.values.endDate ?? clean.values.date,
  );
  revalidateEvent(current.projectId, clean.values.projectId);
  return ok(warning ? `Evento salvo. ${warning}` : "Evento salvo.", id);
}

export async function deleteEvent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Evento não encontrado.");
  const [current] = await db.select({ projectId: events.projectId }).from(events).where(eq(events.id, id)).limit(1);
  if (!current) return fail("Esse evento já foi excluído.");
  await db.batch([
    db.delete(eventCrew).where(eq(eventCrew.eventId, id)),
    db.update(schema.callSheets).set({ eventId: null }).where(eq(schema.callSheets.eventId, id)),
    db.delete(events).where(eq(events.id, id)),
  ]);
  revalidateEvent(current.projectId);
  return ok("Evento excluído.");
}
