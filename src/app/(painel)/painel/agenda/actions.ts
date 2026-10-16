"use server";

import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema, transact, type Tx } from "@/lib/db";
import { fail, fromZod, list, ok, str, type ActionResult } from "@/lib/actions";
import { EVENT_COLORS, EVENT_TYPES, EVENT_TYPES_PESSOAIS, FUNCTION_MAX } from "@/lib/domain";
import { dateBR } from "@/lib/format";
import { logProjectActivity } from "@/lib/services/activity";
import { revogarLinksDe } from "@/lib/services/drive-links";
import { syncProjectTeam, teamSyncNote, type TeamSyncReport } from "@/lib/services/team";
import { joinNames } from "./agenda-utils";

const { events, eventCrew, freelancers, projects, users } = schema;

const EVENT_TYPE_KEYS = EVENT_TYPES.map((t) => t.key) as [string, ...string[]];

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
    ownerId: z.string().optional(),
    color: z.enum(EVENT_COLORS.map((c) => c.key) as [string, ...string[]]).optional(),
    crew: z.array(z.object({ freelancerId: z.string().min(1), function: z.string().optional() })).max(40),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, {
    path: ["endDate"],
    message: "A data final vem depois da inicial.",
  })
  .refine((v) => !(EVENT_TYPES_PESSOAIS as readonly string[]).includes(v.type) || !!v.ownerId, {
    path: ["ownerId"],
    message: "Diga de quem é a agenda.",
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
    ownerId: str(fd, "ownerId"),
    color: str(fd, "color"),
    crew: crewIds.map((freelancerId) => {
      const fn = str(fd, `fn:${freelancerId}`);
      return { freelancerId, function: fn && fn.length <= FUNCTION_MAX ? fn : undefined };
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
  let ownerId: string | null = null;
  if (data.ownerId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.ownerId)).limit(1);
    if (!u) return { error: "Sócio não encontrado." } as const;
    ownerId = u.id;
  }
  // Freela fora da ZRO e compromisso pessoal são a agenda do sócio: sem projeto e sem equipe.
  const pessoal = (EVENT_TYPES_PESSOAIS as readonly string[]).includes(data.type);
  if (pessoal) projectId = null;
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
      ownerId,
      color: data.color ?? null,
    },
    crew: pessoal ? [] : data.crew.filter((c) => existing.has(c.freelancerId)),
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

function insertCrew(t: Tx, eventId: string, crew: { freelancerId: string; function?: string }[]) {
  return t.insert(eventCrew).values(crew.map((c) => ({ eventId, freelancerId: c.freelancerId, function: c.function ?? null })));
}

function revalidateEvent(...projectIds: (string | null | undefined)[]) {
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  const ids = [...new Set(projectIds)].filter(Boolean);
  for (const id of ids) revalidatePath(`/painel/projetos/${id}`);
  if (ids.length) {
    // Diária mexe na equipe e nos pagamentos: financeiro, freelas e ficha do cliente também.
    revalidatePath("/painel/projetos");
    revalidatePath("/painel/financeiro", "layout");
    revalidatePath("/painel/freelas", "layout");
    revalidatePath("/painel/crm", "layout");
  }
}

/** Equipe e pagamentos dos projetos envolvidos, em dia com a agenda. */
async function syncTeams(...projectIds: (string | null | undefined)[]) {
  const total: TeamSyncReport = { joined: [], left: [], paymentsCreated: 0, paymentsUpdated: 0 };
  for (const id of new Set(projectIds)) {
    if (!id) continue;
    const r = await syncProjectTeam(id);
    total.joined.push(...r.joined);
    total.left.push(...r.left);
    total.paymentsCreated += r.paymentsCreated;
    total.paymentsUpdated += r.paymentsUpdated;
  }
  return teamSyncNote(total);
}

function when(date: string, endDate: string | null) {
  return endDate && endDate > date ? `${dateBR(date)} a ${dateBR(endDate)}` : dateBR(date);
}

export async function createEvent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = readEvent(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const clean = await sanitize(parsed.data);
  if ("error" in clean) return fail(clean.error ?? "Confira os campos.");

  const id = crypto.randomUUID();
  await transact((t) => [
    t.insert(events).values({ id, ...clean.values }),
    ...(clean.crew.length ? [insertCrew(t, id, clean.crew)] : []),
  ]);

  const warning = await conflictWarning(
    id,
    clean.crew.map((c) => c.freelancerId),
    clean.values.date,
    clean.values.endDate ?? clean.values.date,
  );
  const note = await syncTeams(clean.values.projectId);
  if (clean.values.type === "diaria") {
    await logProjectActivity(
      clean.values.projectId,
      "agenda",
      `Diária marcada: ${when(clean.values.date, clean.values.endDate)} · ${clean.values.title}.`,
      user.id,
    );
  }
  revalidateEvent(clean.values.projectId);
  return ok([warning ? `Evento salvo. ${warning}` : "Evento salvo.", note].filter(Boolean).join(" "), id);
}

export async function updateEvent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Evento não encontrado.");
  const [current] = await db
    .select({ id: events.id, projectId: events.projectId, type: events.type, date: events.date, endDate: events.endDate })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!current) return fail("Esse evento não existe mais.");
  const parsed = readEvent(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const clean = await sanitize(parsed.data);
  if ("error" in clean) return fail(clean.error ?? "Confira os campos.");

  // Tudo ou nada: evento e equipe mudam juntos.
  await transact((t) => [
    t.update(events).set(clean.values).where(eq(events.id, id)),
    t.delete(eventCrew).where(eq(eventCrew.eventId, id)),
    ...(clean.crew.length ? [insertCrew(t, id, clean.crew)] : []),
  ]);

  const warning = await conflictWarning(
    id,
    clean.crew.map((c) => c.freelancerId),
    clean.values.date,
    clean.values.endDate ?? clean.values.date,
  );
  const note = await syncTeams(current.projectId, clean.values.projectId);
  const moved = current.date !== clean.values.date || (current.endDate ?? null) !== clean.values.endDate;
  if (clean.values.type === "diaria" && (moved || current.projectId !== clean.values.projectId)) {
    await logProjectActivity(
      clean.values.projectId,
      "agenda",
      `Diária ${current.projectId === clean.values.projectId ? "remarcada" : "marcada"}: ${when(clean.values.date, clean.values.endDate)} · ${clean.values.title}.`,
      user.id,
    );
  }
  revalidateEvent(current.projectId, clean.values.projectId);
  return ok([warning ? `Evento salvo. ${warning}` : "Evento salvo.", note].filter(Boolean).join(" "), id);
}

export async function deleteEvent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Evento não encontrado.");
  const [current] = await db
    .select({ projectId: events.projectId, type: events.type, title: events.title, date: events.date, endDate: events.endDate })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!current) return fail("Esse evento já foi excluído.");
  // O link de envio da diária para antes (nunca apagado; o que chegou fica no Drive e no banco).
  await revogarLinksDe({ eventId: id });
  await transact((t) => [
    t.delete(eventCrew).where(eq(eventCrew.eventId, id)),
    t.update(schema.callSheets).set({ eventId: null }).where(eq(schema.callSheets.eventId, id)),
    t.delete(events).where(eq(events.id, id)),
  ]);
  const note = await syncTeams(current.projectId);
  if (current.type === "diaria") {
    await logProjectActivity(current.projectId, "agenda", `Diária desmarcada: ${when(current.date, current.endDate)} · ${current.title}.`, user.id);
  }
  revalidateEvent(current.projectId);
  return ok(["Evento excluído.", note].filter(Boolean).join(" "));
}
