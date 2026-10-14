import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/lib/db";

const { events, eventCrew, freelancers, projects, callSheets } = schema;

export type EventCrewMember = { freelancerId: string; name: string; photoId: string | null; function: string | null };

/** Outro evento, nas mesmas datas, em que alguém da equipe já está escalado. */
export type EventConflict = {
  freelancerId: string;
  freelancerName: string;
  eventId: string;
  eventTitle: string;
  date: string;
  endDate: string | null;
};

export type AgendaEvent = {
  id: string;
  type: string;
  title: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  projectId: string | null;
  projectCode: string | null;
  projectTitle: string | null;
  crew: EventCrewMember[];
  conflicts: EventConflict[];
  callSheetId: string | null;
};

/** Escalação de um freela, para avisar conflito enquanto o formulário é preenchido. */
export type Booking = { freelancerId: string; eventId: string; title: string; date: string; endDate: string | null };

export type AgendaOptions = {
  projects: { id: string; code: string; title: string; status: string }[];
  freelancers: { id: string; name: string; functions: string[]; active: boolean }[];
};

/** Último dia do evento (a própria data quando não há data final). */
const eventEndSql = sql<string>`coalesce(${events.endDate}, ${events.date})`;

const baseColumns = {
  id: events.id,
  type: events.type,
  title: events.title,
  date: events.date,
  endDate: events.endDate,
  startTime: events.startTime,
  endTime: events.endTime,
  location: events.location,
  notes: events.notes,
  projectId: events.projectId,
  projectCode: projects.code,
  projectTitle: projects.title,
};

type BaseRow = Omit<AgendaEvent, "crew" | "conflicts" | "callSheetId">;

/** Para cada evento, quem da equipe também está em outro evento nas mesmas datas. */
export async function findConflicts(eventIds: string[]) {
  if (!eventIds.length) return [];
  const mine = alias(eventCrew, "mine");
  const other = alias(eventCrew, "other");
  const ev = alias(events, "ev");
  const oev = alias(events, "oev");
  return db
    .select({
      eventId: mine.eventId,
      freelancerId: mine.freelancerId,
      freelancerName: freelancers.name,
      otherId: oev.id,
      otherTitle: oev.title,
      otherDate: oev.date,
      otherEnd: oev.endDate,
    })
    .from(mine)
    .innerJoin(other, and(eq(other.freelancerId, mine.freelancerId), ne(other.eventId, mine.eventId)))
    .innerJoin(ev, eq(ev.id, mine.eventId))
    .innerJoin(oev, eq(oev.id, other.eventId))
    .innerJoin(freelancers, eq(freelancers.id, mine.freelancerId))
    .where(
      and(
        inArray(mine.eventId, eventIds),
        lte(ev.date, sql`coalesce(${oev.endDate}, ${oev.date})`),
        lte(oev.date, sql`coalesce(${ev.endDate}, ${ev.date})`),
      ),
    )
    .orderBy(asc(oev.date), asc(freelancers.name));
}

async function hydrate(rows: BaseRow[]): Promise<AgendaEvent[]> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const [crew, conflicts, sheets] = await Promise.all([
    db
      .select({
        eventId: eventCrew.eventId,
        freelancerId: eventCrew.freelancerId,
        function: eventCrew.function,
        name: freelancers.name,
        photoId: freelancers.photoId,
      })
      .from(eventCrew)
      .innerJoin(freelancers, eq(eventCrew.freelancerId, freelancers.id))
      .where(inArray(eventCrew.eventId, ids))
      .orderBy(asc(freelancers.name)),
    findConflicts(ids),
    db
      .select({ id: callSheets.id, eventId: callSheets.eventId })
      .from(callSheets)
      .where(inArray(callSheets.eventId, ids))
      .orderBy(desc(callSheets.updatedAt)),
  ]);

  return rows.map((r) => ({
    ...r,
    crew: crew
      .filter((c) => c.eventId === r.id)
      .map((c) => ({ freelancerId: c.freelancerId, name: c.name, photoId: c.photoId, function: c.function })),
    conflicts: conflicts
      .filter((c) => c.eventId === r.id)
      .map((c) => ({
        freelancerId: c.freelancerId,
        freelancerName: c.freelancerName,
        eventId: c.otherId,
        eventTitle: c.otherTitle,
        date: c.otherDate,
        endDate: c.otherEnd,
      })),
    callSheetId: sheets.find((s) => s.eventId === r.id)?.id ?? null,
  }));
}

/** Eventos que tocam o intervalo [start, end], com equipe e conflitos. */
export async function listEventsInRange(filters: {
  start: string;
  end: string;
  type?: string;
  projectId?: string;
  freelancerId?: string;
}) {
  const where = [lte(events.date, filters.end), gte(eventEndSql, filters.start)];
  if (filters.type) where.push(eq(events.type, filters.type));
  if (filters.projectId) where.push(eq(events.projectId, filters.projectId));
  if (filters.freelancerId) {
    where.push(
      inArray(
        events.id,
        db.select({ id: eventCrew.eventId }).from(eventCrew).where(eq(eventCrew.freelancerId, filters.freelancerId)),
      ),
    );
  }
  const rows = await db
    .select(baseColumns)
    .from(events)
    .leftJoin(projects, eq(events.projectId, projects.id))
    .where(and(...where))
    .orderBy(asc(events.date), asc(events.startTime), asc(events.title));
  return hydrate(rows);
}

/** Todos os eventos de um projeto, do mais antigo ao mais novo. */
export async function listProjectEvents(projectId: string) {
  const rows = await db
    .select(baseColumns)
    .from(events)
    .leftJoin(projects, eq(events.projectId, projects.id))
    .where(eq(events.projectId, projectId))
    .orderBy(asc(events.date), asc(events.startTime), asc(events.title));
  return hydrate(rows);
}

/** Data de um evento (para abrir a agenda no mês certo a partir de um link). */
export async function getEventDate(id: string) {
  const [row] = await db.select({ date: events.date }).from(events).where(eq(events.id, id)).limit(1);
  return row?.date ?? null;
}

/** Projetos e freelas para os filtros e o formulário de evento. */
export async function getAgendaOptions(): Promise<AgendaOptions> {
  const [projectRows, freelaRows] = await Promise.all([
    db
      .select({ id: projects.id, code: projects.code, title: projects.title, status: projects.status })
      .from(projects)
      .orderBy(sql`case ${projects.status} when 'ativo' then 0 when 'pausado' then 1 else 2 end`, desc(projects.code)),
    db
      .select({ id: freelancers.id, name: freelancers.name, functions: freelancers.functions, active: freelancers.active })
      .from(freelancers)
      .orderBy(desc(freelancers.active), asc(freelancers.name)),
  ]);
  return { projects: projectRows, freelancers: freelaRows };
}

/** Escalações de eventos que terminam a partir de `from`. */
export async function listBookings(from: string): Promise<Booking[]> {
  return db
    .select({
      freelancerId: eventCrew.freelancerId,
      eventId: events.id,
      title: events.title,
      date: events.date,
      endDate: events.endDate,
    })
    .from(eventCrew)
    .innerJoin(events, eq(eventCrew.eventId, events.id))
    .where(gte(eventEndSql, from))
    .orderBy(asc(events.date));
}
