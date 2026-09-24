import "server-only";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FUNCTIONS, optionLabel } from "@/lib/domain";

const { projects, clients, events, eventCrew, projectCrew, freelancers, callSheets, projectChecklists, equipmentKits, scripts } =
  schema;

export type CallSheetRow = typeof callSheets.$inferSelect;
export type ChecklistRow = typeof projectChecklists.$inferSelect;
export type ScriptRow = typeof scripts.$inferSelect;
export type ChecklistItem = ChecklistRow["items"][number];

/** Pessoa sugerida para a equipe da ordem do dia. */
export type CrewSuggestion = { name: string; role: string; phone: string };

/** Cabeçalho dos documentos: código, título e cliente do projeto. */
export async function getProjectHeader(projectId: string) {
  const [row] = await db
    .select({
      id: projects.id,
      code: projects.code,
      title: projects.title,
      status: projects.status,
      clientName: clients.name,
      clientContact: clients.contactName,
      clientPhone: clients.phone,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

export type ProjectHeader = NonNullable<Awaited<ReturnType<typeof getProjectHeader>>>;

/** Ordens do dia, checklists e roteiros de um projeto (para a aba Documentos). */
export async function listProjectDocuments(projectId: string) {
  const [sheetRows, checklistRows, scriptRows] = await Promise.all([
    db
      .select({
        id: callSheets.id,
        title: callSheets.title,
        date: callSheets.date,
        callTime: callSheets.callTime,
        location: callSheets.location,
        crew: callSheets.crew,
        eventId: callSheets.eventId,
        updatedAt: callSheets.updatedAt,
      })
      .from(callSheets)
      .where(eq(callSheets.projectId, projectId))
      .orderBy(asc(callSheets.date), asc(callSheets.createdAt)),
    db
      .select({
        id: projectChecklists.id,
        title: projectChecklists.title,
        date: projectChecklists.date,
        items: projectChecklists.items,
        updatedAt: projectChecklists.updatedAt,
      })
      .from(projectChecklists)
      .where(eq(projectChecklists.projectId, projectId))
      .orderBy(asc(projectChecklists.date), asc(projectChecklists.createdAt)),
    db
      .select({
        id: scripts.id,
        kind: scripts.kind,
        title: scripts.title,
        content: scripts.content,
        shots: scripts.shots,
        updatedAt: scripts.updatedAt,
      })
      .from(scripts)
      .where(eq(scripts.projectId, projectId))
      .orderBy(desc(scripts.updatedAt)),
  ]);

  return {
    callSheets: sheetRows.map(({ crew, ...s }) => ({ ...s, crewCount: crew.length })),
    checklists: checklistRows.map(({ items, ...c }) => ({
      ...c,
      total: items.length,
      out: items.filter((i) => i.out).length,
      back: items.filter((i) => i.back).length,
      missing: items.filter((i) => i.out && !i.back).length,
    })),
    scripts: scriptRows.map(({ content, shots, ...s }) => ({
      ...s,
      words: (content ?? "").trim().match(/\S+/g)?.length ?? 0,
      shotCount: shots.length,
      shotsDone: shots.filter((x) => x.done).length,
    })),
  };
}

/** Próxima diária do projeto (a partir de hoje), para preencher documentos novos. */
export async function nextProjectDiaria(projectId: string, today: string) {
  const [row] = await db
    .select({
      id: events.id,
      title: events.title,
      date: events.date,
      startTime: events.startTime,
      location: events.location,
    })
    .from(events)
    .where(and(eq(events.projectId, projectId), eq(events.type, "diaria"), gte(events.date, today)))
    .orderBy(asc(events.date), asc(events.startTime))
    .limit(1);
  return row ?? null;
}

/** Equipe de um evento no formato da ordem do dia. */
export async function eventCrewSuggestions(eventIds: string[]) {
  if (!eventIds.length) return {} as Record<string, CrewSuggestion[]>;
  const rows = await db
    .select({
      eventId: eventCrew.eventId,
      function: eventCrew.function,
      name: freelancers.name,
      phone: freelancers.phone,
    })
    .from(eventCrew)
    .innerJoin(freelancers, eq(eventCrew.freelancerId, freelancers.id))
    .where(inArray(eventCrew.eventId, eventIds))
    .orderBy(asc(freelancers.name));
  const out: Record<string, CrewSuggestion[]> = {};
  for (const r of rows) {
    (out[r.eventId] ??= []).push({
      name: r.name,
      role: r.function ? optionLabel(FUNCTIONS, r.function) : "",
      phone: r.phone ?? "",
    });
  }
  return out;
}

/** Equipe do projeto (uma linha por pessoa, com as funções juntas). */
export async function projectCrewSuggestions(projectId: string): Promise<CrewSuggestion[]> {
  const rows = await db
    .select({
      name: projectCrew.name,
      function: projectCrew.function,
      freelancerId: projectCrew.freelancerId,
      freelaName: freelancers.name,
      phone: freelancers.phone,
    })
    .from(projectCrew)
    .leftJoin(freelancers, eq(projectCrew.freelancerId, freelancers.id))
    .where(eq(projectCrew.projectId, projectId))
    .orderBy(asc(projectCrew.createdAt));
  const byName = new Map<string, CrewSuggestion>();
  for (const r of rows) {
    const name = r.freelaName ?? r.name;
    if (!name) continue;
    const role = optionLabel(FUNCTIONS, r.function);
    const found = byName.get(name);
    if (found) {
      if (!found.role.split(" / ").includes(role)) found.role = `${found.role} / ${role}`;
    } else {
      byName.set(name, { name, role, phone: r.phone ?? "" });
    }
  }
  return [...byName.values()];
}

/** Tudo que o editor da ordem do dia precisa. */
export async function getCallSheetEditor(projectId: string, sheetId: string) {
  const [project, sheet] = await Promise.all([
    getProjectHeader(projectId),
    db.query.callSheets.findFirst({ where: and(eq(callSheets.id, sheetId), eq(callSheets.projectId, projectId)) }),
  ]);
  if (!project || !sheet) return null;
  const projectEvents = await db
    .select({
      id: events.id,
      type: events.type,
      title: events.title,
      date: events.date,
      endDate: events.endDate,
      startTime: events.startTime,
      location: events.location,
    })
    .from(events)
    .where(eq(events.projectId, projectId))
    .orderBy(asc(events.date), asc(events.startTime));
  const [crewByEvent, projectCrewList] = await Promise.all([
    eventCrewSuggestions(projectEvents.map((e) => e.id)),
    projectCrewSuggestions(projectId),
  ]);
  return { project, sheet, events: projectEvents, crewByEvent, projectCrew: projectCrewList };
}

/** Ordem do dia com o cabeçalho do projeto (para imprimir). */
export async function getCallSheetPrint(projectId: string, sheetId: string) {
  const [project, sheet] = await Promise.all([
    getProjectHeader(projectId),
    db.query.callSheets.findFirst({ where: and(eq(callSheets.id, sheetId), eq(callSheets.projectId, projectId)) }),
  ]);
  if (!project || !sheet) return null;
  return { project, sheet };
}

export async function getChecklist(projectId: string, checklistId: string) {
  const [project, checklist] = await Promise.all([
    getProjectHeader(projectId),
    db.query.projectChecklists.findFirst({
      where: and(eq(projectChecklists.id, checklistId), eq(projectChecklists.projectId, projectId)),
    }),
  ]);
  if (!project || !checklist) return null;
  return { project, checklist };
}

export async function listKits() {
  return db
    .select({ id: equipmentKits.id, name: equipmentKits.name, description: equipmentKits.description, items: equipmentKits.items })
    .from(equipmentKits)
    .orderBy(asc(equipmentKits.name));
}

export async function getScript(projectId: string, scriptId: string) {
  const [project, script] = await Promise.all([
    getProjectHeader(projectId),
    db.query.scripts.findFirst({ where: and(eq(scripts.id, scriptId), eq(scripts.projectId, projectId)) }),
  ]);
  if (!project || !script) return null;
  return { project, script };
}
