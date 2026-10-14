"use server";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fromZod, list, money, ok, str, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import {
  CATEGORY_KEYS,
  CREATIVE_RULE,
  DELIVERABLE_STATUS,
  FINANCE_CATEGORIES,
  FINANCE_KINDS,
  FUNCTION_MAX,
  PAYMENT_METHODS,
  PROJECT_STATUS,
  STAGES,
  STAGE_KEYS,
  creativeRuleComplete,
  optionLabel,
  type CreativeRuleAnswers,
} from "@/lib/domain";
import { brl, todayISO } from "@/lib/format";
import { registerPayment } from "@/lib/services/finance";
import { logProjectActivity } from "@/lib/services/activity";
import { applyTemplate, createProject, syncProjectReceivable } from "@/lib/services/projects";
import { syncProjectTeam, teamSyncNote } from "@/lib/services/team";

const { projects, projectTasks, projectDeliverables, projectCrew, financeEntries, freelancers, clients, projectTemplates, events, eventCrew } = schema;

/* ============================== Utilitários ============================== */

type Ids = (string | null | undefined)[];

/** Revalida tudo que mostra dados de projeto: lista, ficha, painel e, quando for o caso, financeiro, freelas e cliente. */
function touch(projectId: string | null | undefined, opts: { finance?: boolean; freelancers?: Ids; clients?: Ids; agenda?: boolean } = {}) {
  revalidatePath("/painel/projetos");
  if (projectId) revalidatePath(`/painel/projetos/${projectId}`);
  revalidatePath("/painel");
  if (opts.finance) {
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/financeiro", "layout");
  }
  const fl = [...new Set((opts.freelancers ?? []).filter((x): x is string => Boolean(x)))];
  if (fl.length) {
    revalidatePath("/painel/freelas");
    for (const f of fl) revalidatePath(`/painel/freelas/${f}`);
  }
  for (const c of new Set((opts.clients ?? []).filter((x): x is string => Boolean(x)))) {
    revalidatePath(`/painel/crm/clientes/${c}`);
  }
  if (opts.agenda) revalidatePath("/painel/agenda");
}

const stageIdx = (key: string) => STAGES.findIndex((s) => s.key === key);
const STATUS_KEYS = PROJECT_STATUS.map((s) => s.key) as [string, ...string[]];
const DELIVERABLE_KEYS = DELIVERABLE_STATUS.map((s) => s.key) as [string, ...string[]];
const KIND_KEYS = FINANCE_KINDS.map((k) => k.key) as [string, ...string[]];
const METHOD_KEYS = PAYMENT_METHODS.map((m) => m.key) as [string, ...string[]];

const optionalDate = z.iso.date({ message: "Data inválida." }).optional();

/** Aceita "drive.google.com/..." sem o https:// e recusa qualquer coisa que não seja http(s). */
function normalizeUrl(value: string | undefined) {
  if (!value) return undefined;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}
const optionalUrl = z.url({ protocol: /^https?$/, message: "Link inválido. Cole o endereço completo." }).max(500).optional();

function intField(fd: FormData, key: string) {
  const v = str(fd, key);
  if (v == null) return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

async function projectById(id: string | undefined) {
  if (!id) return null;
  return (await db.query.projects.findFirst({ where: eq(projects.id, id) })) ?? null;
}

/* ============================== Projeto ============================== */

const ProjectSchema = z
  .object({
    title: z.string({ message: "Digite o título do projeto." }).min(2, "Digite o título do projeto.").max(140, "Título longo demais."),
    clientId: z.string().optional(),
    category: z.enum(CATEGORY_KEYS, { message: "Escolha a categoria." }),
    startDate: optionalDate,
    dueDate: optionalDate,
    value: z.number({ message: "Valor inválido." }).int().nonnegative("O valor não pode ser negativo.").optional(),
  })
  .refine((d) => !d.startDate || !d.dueDate || d.dueDate >= d.startDate, {
    message: "O prazo não pode ser antes do início.",
    path: ["dueDate"],
  });

function readProject(fd: FormData) {
  return ProjectSchema.safeParse({
    title: str(fd, "title"),
    clientId: str(fd, "clientId"),
    category: str(fd, "category"),
    startDate: str(fd, "startDate"),
    dueDate: str(fd, "dueDate"),
    value: money(fd, "value"),
  });
}

async function clientExists(id: string | undefined) {
  if (!id) return true;
  return Boolean(await db.query.clients.findFirst({ where: eq(clients.id, id), columns: { id: true } }));
}

export async function createProjectAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = readProject(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const briefing = str(fd, "briefing");
  if (briefing && briefing.length > 5000) return fail("O briefing passou de 5.000 caracteres.", { briefing: ["Texto longo demais."] });
  if (!(await clientExists(parsed.data.clientId))) return fail("Cliente não encontrado.", { clientId: ["Cliente não encontrado."] });

  const templateId = str(fd, "templateId");
  if (templateId) {
    const template = await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, templateId), columns: { id: true } });
    if (!template) return fail("Modelo não encontrado.", { templateId: ["Modelo não encontrado."] });
  }

  const row = await createProject({
    title: parsed.data.title,
    clientId: parsed.data.clientId ?? null,
    category: parsed.data.category,
    startDate: parsed.data.startDate ?? null,
    dueDate: parsed.data.dueDate ?? null,
    value: parsed.data.value ?? 0,
    briefing: briefing ?? null,
    templateId: templateId ?? null,
  });
  await syncProjectReceivable(row.id);
  await logProjectActivity(row.id, "projeto", `Projeto ${row.code} aberto: ${parsed.data.title}.`, user.id);
  touch(row.id, { finance: true, clients: [parsed.data.clientId] });
  redirect(`/painel/projetos/${row.id}`);
}

export async function updateProject(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = readProject(fd);
  if (!parsed.success) return fromZod(parsed.error);
  if (!(await clientExists(parsed.data.clientId))) return fail("Cliente não encontrado.", { clientId: ["Cliente não encontrado."] });

  await db
    .update(projects)
    .set({
      title: parsed.data.title,
      clientId: parsed.data.clientId ?? null,
      category: parsed.data.category,
      startDate: parsed.data.startDate ?? null,
      dueDate: parsed.data.dueDate ?? null,
      value: parsed.data.value ?? 0,
    })
    .where(eq(projects.id, project.id));
  const receivable = await syncProjectReceivable(project.id, project.value);
  if (parsed.data.title !== project.title) await syncProjectTeam(project.id);
  touch(project.id, { finance: true, clients: [project.clientId, parsed.data.clientId], agenda: true });
  return ok(
    receivable === "created"
      ? "Projeto atualizado. O recebimento entrou no financeiro."
      : receivable === "updated"
        ? "Projeto atualizado. O recebimento acompanhou o valor novo."
        : "Projeto atualizado.",
  );
}

export async function setProjectStatus(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = z.enum(STATUS_KEYS, { message: "Status inválido." }).safeParse(str(fd, "status"));
  if (!parsed.success) return fromZod(parsed.error);
  if (parsed.data === project.status) return ok();
  await db.update(projects).set({ status: parsed.data }).where(eq(projects.id, project.id));
  await logProjectActivity(project.id, "projeto", `${project.title}: ${optionLabel(PROJECT_STATUS, parsed.data).toLowerCase()}.`, user.id);
  touch(project.id, { clients: [project.clientId] });
  return ok(`Projeto marcado como ${optionLabel(PROJECT_STATUS, parsed.data).toLowerCase()}.`);
}

/**
 * Muda a etapa do processo criativo. Trava da regra criativa (documento-mestre §34):
 * sem as 6 respostas, o projeto não avança além de Conceito.
 */
export async function moveProjectStage(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = z.enum(STAGE_KEYS, { message: "Etapa inválida." }).safeParse(str(fd, "to"));
  if (!parsed.success) return fromZod(parsed.error);

  const from = Math.max(0, stageIdx(project.stage));
  const to = stageIdx(parsed.data);
  if (to === from) return ok();
  const conceito = stageIdx("conceito");
  if (to > from && to > conceito && !creativeRuleComplete(project.creativeRule)) {
    const target = from <= conceito ? "Direção" : STAGES[to].label;
    const message = `Responda a regra criativa antes de avançar para ${target}.`;
    return fail(message, { creativeRule: [message] });
  }

  await db.update(projects).set({ stage: parsed.data }).where(eq(projects.id, project.id));
  const s = STAGES[to];
  await logProjectActivity(project.id, "projeto", `${project.title} ${to > from ? "avançou" : "voltou"} para ${s.n} ${s.label}.`, user.id);
  touch(project.id, { clients: [project.clientId] });
  return ok(`${to > from ? "Avançou" : "Voltou"} para ${s.n} ${s.label}.`);
}

export async function saveBriefing(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = z
    .object({
      briefing: z.string().max(5000, "O briefing passou de 5.000 caracteres.").optional(),
      notes: z.string().max(3000, "As observações passaram de 3.000 caracteres.").optional(),
    })
    .safeParse({ briefing: str(fd, "briefing"), notes: str(fd, "notes") });
  if (!parsed.success) return fromZod(parsed.error);
  await db
    .update(projects)
    .set({ briefing: parsed.data.briefing ?? null, notes: parsed.data.notes ?? null })
    .where(eq(projects.id, project.id));
  touch(project.id);
  return ok("Briefing salvo.");
}

export async function saveCreativeRule(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const answers: CreativeRuleAnswers = {};
  for (const q of CREATIVE_RULE) {
    const v = str(fd, q.key);
    if (v && v.length > 1000) return fail("Cada resposta pode ter até 1.000 caracteres.", { [q.key]: ["Resposta longa demais."] });
    if (v) answers[q.key] = v;
  }
  await db.update(projects).set({ creativeRule: answers }).where(eq(projects.id, project.id));
  touch(project.id);
  if (creativeRuleComplete(answers)) {
    return ok(
      project.stage === "conceito" || project.stage === "origem"
        ? "Regra criativa respondida. O projeto pode seguir para Direção."
        : "Regra criativa respondida.",
    );
  }
  const n = CREATIVE_RULE.filter((q) => (answers[q.key] ?? "").trim().length >= 3).length;
  return ok(`Regra criativa salva: ${n} de 6 respondidas.`);
}

export async function updateDriveUrl(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = z.object({ driveUrl: optionalUrl }).safeParse({ driveUrl: normalizeUrl(str(fd, "driveUrl")) });
  if (!parsed.success) return fromZod(parsed.error);
  await db.update(projects).set({ driveUrl: parsed.data.driveUrl ?? null }).where(eq(projects.id, project.id));
  touch(project.id);
  return ok(parsed.data.driveUrl ? "Link do Drive salvo." : "Link do Drive removido.");
}

export async function deleteProject(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "id"));
  if (!project) return fail("Projeto não encontrado.");
  const crew = await db.select({ freelancerId: projectCrew.freelancerId }).from(projectCrew).where(eq(projectCrew.projectId, project.id));
  // Tarefas, entregas, equipe, agenda e documentos saem junto (cascade). Lançamentos ficam, sem o vínculo.
  await db.delete(projects).where(eq(projects.id, project.id));
  touch(null, { finance: true, agenda: true, clients: [project.clientId], freelancers: crew.map((c) => c.freelancerId) });
  redirect("/painel/projetos");
}

/* ============================== Tarefas ============================== */

export async function addTask(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "projectId"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = z
    .object({
      stage: z.enum(STAGE_KEYS, { message: "Escolha a etapa." }),
      title: z.string({ message: "Digite a tarefa." }).min(2, "Digite a tarefa.").max(200, "Tarefa longa demais."),
    })
    .safeParse({ stage: str(fd, "stage"), title: str(fd, "title") });
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db
    .select({ max: sql<number | null>`max(${projectTasks.sortOrder})`.mapWith(Number) })
    .from(projectTasks)
    .where(eq(projectTasks.projectId, project.id));
  await db.insert(projectTasks).values({
    projectId: project.id,
    stage: parsed.data.stage,
    title: parsed.data.title,
    sortOrder: Number(row?.max ?? -1) + 1,
  });
  touch(project.id);
  return ok("Tarefa adicionada.");
}

/** Marca ou desmarca (valor explícito, para dois cliques rápidos não se anularem). */
export async function setTaskDone(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const task = id ? await db.query.projectTasks.findFirst({ where: eq(projectTasks.id, id) }) : null;
  if (!task) return fail("Tarefa não encontrada.");
  const done = str(fd, "done") === "1";
  await db.update(projectTasks).set({ done }).where(eq(projectTasks.id, task.id));
  touch(task.projectId);
  return ok();
}

export async function deleteTask(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const task = id ? await db.query.projectTasks.findFirst({ where: eq(projectTasks.id, id) }) : null;
  if (!task) return fail("Tarefa não encontrada.");
  await db.delete(projectTasks).where(eq(projectTasks.id, task.id));
  touch(task.projectId);
  return ok("Tarefa excluída.");
}

export async function applyTemplateToProject(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "projectId"));
  if (!project) return fail("Projeto não encontrado.");
  const templateId = str(fd, "templateId");
  const template = templateId ? await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, templateId) }) : null;
  if (!template) return fail("Escolha um modelo.", { templateId: ["Escolha um modelo."] });
  const added = await applyTemplate(project.id, template.id);
  touch(project.id);
  if (!added) return ok(`O projeto já tem todas as tarefas de "${template.name}".`);
  return ok(`${added} tarefa${added > 1 ? "s" : ""} de "${template.name}" adicionada${added > 1 ? "s" : ""}.`);
}

/* ============================== Entregas ============================== */

const DeliverableSchema = z.object({
  title: z.string({ message: "Digite o nome da entrega." }).min(2, "Digite o nome da entrega.").max(160, "Nome longo demais."),
  format: z.string().max(40, "Formato longo demais.").optional(),
  duration: z.string().max(40, "Duração longa demais.").optional(),
  quantity: z.number({ message: "Quantidade inválida." }).int("Use um número inteiro.").min(1, "Mínimo de 1.").max(999),
  dueDate: optionalDate,
  status: z.enum(DELIVERABLE_KEYS, { message: "Status inválido." }),
  revision: z.number({ message: "Número inválido." }).int("Use um número inteiro.").min(0).max(99).optional(),
  link: optionalUrl,
});

function readDeliverable(fd: FormData) {
  return DeliverableSchema.safeParse({
    title: str(fd, "title"),
    format: str(fd, "format"),
    duration: str(fd, "duration"),
    quantity: intField(fd, "quantity") ?? 1,
    dueDate: str(fd, "dueDate"),
    status: str(fd, "status") ?? "pendente",
    revision: intField(fd, "revision"),
    link: normalizeUrl(str(fd, "link")),
  });
}

async function deliverableById(id: string | undefined) {
  if (!id) return null;
  return (await db.query.projectDeliverables.findFirst({ where: eq(projectDeliverables.id, id) })) ?? null;
}

export async function createDeliverable(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "projectId"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = readDeliverable(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db
    .select({ max: sql<number | null>`max(${projectDeliverables.sortOrder})`.mapWith(Number) })
    .from(projectDeliverables)
    .where(eq(projectDeliverables.projectId, project.id));
  const { link, revision, ...rest } = parsed.data;
  await db.insert(projectDeliverables).values({
    ...rest,
    link: link ?? null,
    revision: revision ?? 0,
    projectId: project.id,
    sortOrder: Number(row?.max ?? -1) + 1,
  });
  touch(project.id);
  return ok("Entrega adicionada.");
}

export async function updateDeliverable(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const item = await deliverableById(str(fd, "id"));
  if (!item) return fail("Entrega não encontrada.");
  const parsed = readDeliverable(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const { link, revision, format, duration, dueDate, ...rest } = parsed.data;
  await db
    .update(projectDeliverables)
    .set({
      ...rest,
      format: format ?? null,
      duration: duration ?? null,
      dueDate: dueDate ?? null,
      link: link ?? null,
      revision: revision ?? item.revision,
    })
    .where(eq(projectDeliverables.id, item.id));
  touch(item.projectId);
  return ok("Entrega atualizada.");
}

export async function setDeliverableStatus(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const item = await deliverableById(str(fd, "id"));
  if (!item) return fail("Entrega não encontrada.");
  const parsed = z.enum(DELIVERABLE_KEYS, { message: "Status inválido." }).safeParse(str(fd, "status"));
  if (!parsed.success) return fromZod(parsed.error);
  await db.update(projectDeliverables).set({ status: parsed.data }).where(eq(projectDeliverables.id, item.id));
  touch(item.projectId);
  return ok(`${item.title}: ${optionLabel(DELIVERABLE_STATUS, parsed.data).toLowerCase()}.`);
}

/** Nova rodada de revisão: conta mais uma e marca como "Com o cliente". */
export async function addDeliverableRevision(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const item = await deliverableById(str(fd, "id"));
  if (!item) return fail("Entrega não encontrada.");
  const revision = item.revision + 1;
  await db.update(projectDeliverables).set({ revision, status: "revisao" }).where(eq(projectDeliverables.id, item.id));
  touch(item.projectId);
  return ok(`${revision}ª rodada de revisão registrada. ${item.title} está com o cliente.`);
}

export async function deleteDeliverable(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const item = await deliverableById(str(fd, "id"));
  if (!item) return fail("Entrega não encontrada.");
  await db.delete(projectDeliverables).where(eq(projectDeliverables.id, item.id));
  touch(item.projectId);
  return ok("Entrega excluída.");
}

/* ============================== Equipe ============================== */

const CrewSchema = z
  .object({
    freelancerId: z.string().optional(),
    name: z.string().max(120, "Nome longo demais.").optional(),
    function: z.string({ message: "Escolha a função." }).min(1, "Escolha a função.").max(FUNCTION_MAX, "Função longa demais."),
    work: z.string().max(200, "Descrição longa demais.").optional(),
    startDate: optionalDate,
    dueDate: optionalDate,
    mode: z.enum(["diaria", "fechado"]),
    dailyRate: z.number({ message: "Valor da diária inválido." }).int().nonnegative("O valor não pode ser negativo.").optional(),
    amount: z.number({ message: "Valor inválido." }).int().nonnegative("O valor não pode ser negativo."),
  })
  .refine((d) => Boolean(d.freelancerId) || (d.name ?? "").length >= 2, {
    message: "Escolha um freela ou digite o nome.",
    path: ["name"],
  })
  .refine((d) => d.mode === "fechado" || d.dailyRate != null, {
    message: "Digite o valor da diária.",
    path: ["dailyRate"],
  })
  .refine((d) => d.mode === "fechado" || Boolean(d.freelancerId), {
    message: "Por diária só vale para freela cadastrado (a agenda escala pelo cadastro).",
    path: ["freelancerId"],
  })
  .refine((d) => !d.startDate || !d.dueDate || d.dueDate >= d.startDate, {
    message: "O prazo não pode ser antes do início.",
    path: ["dueDate"],
  });

function readCrew(fd: FormData) {
  return CrewSchema.safeParse({
    freelancerId: str(fd, "freelancerId"),
    name: str(fd, "name"),
    function: str(fd, "function"),
    work: str(fd, "work"),
    startDate: str(fd, "startDate"),
    dueDate: str(fd, "dueDate"),
    mode: str(fd, "mode") === "diaria" ? "diaria" : "fechado",
    dailyRate: money(fd, "dailyRate"),
    amount: money(fd, "amount") ?? 0,
  });
}

/** Colunas da equipe a partir do formulário (por diária: o valor vem da agenda). */
function crewValues(d: z.infer<typeof CrewSchema>) {
  const perDay = d.mode === "diaria";
  return {
    function: d.function,
    work: d.work ?? null,
    startDate: perDay ? null : (d.startDate ?? null),
    dueDate: perDay ? null : (d.dueDate ?? null),
    dailyRate: perDay ? (d.dailyRate ?? 0) : null,
    amount: perDay ? 0 : d.amount,
    // Montado ou mexido à mão: não sai sozinho da equipe se a pessoa for tirada das diárias.
    source: "manual",
  };
}

async function crewById(id: string | undefined) {
  if (!id) return null;
  return (await db.query.projectCrew.findFirst({ where: eq(projectCrew.id, id) })) ?? null;
}

async function freelancerName(id: string | undefined) {
  if (!id) return null;
  const f = await db.query.freelancers.findFirst({ where: eq(freelancers.id, id), columns: { name: true } });
  return f?.name ?? null;
}

/**
 * Diárias marcadas no formulário da equipe → escalação na agenda do projeto.
 * Só mexe na escalação desta pessoa nesta função (ou sem função).
 */
async function applyCrewDiarias(fd: FormData, projectId: string, freelancerId: string | undefined, fn: string) {
  if (str(fd, "diariasField") !== "1" || !freelancerId) return;
  const diarias = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.projectId, projectId), eq(events.type, "diaria")));
  if (!diarias.length) return;
  const ids = new Set(diarias.map((d) => d.id));
  const wanted = new Set(list(fd, "diarias").filter((id) => ids.has(id)));
  const current = await db
    .select()
    .from(eventCrew)
    .where(and(eq(eventCrew.freelancerId, freelancerId), inArray(eventCrew.eventId, [...ids])));

  const drop = current.filter((c) => !wanted.has(c.eventId) && (c.function === fn || c.function == null));
  if (drop.length) await db.delete(eventCrew).where(inArray(eventCrew.id, drop.map((c) => c.id)));
  const add = [...wanted].filter((eventId) => !current.some((c) => c.eventId === eventId));
  if (add.length) await db.insert(eventCrew).values(add.map((eventId) => ({ eventId, freelancerId, function: fn })));
}

export async function addCrewMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "projectId"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = readCrew(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const { freelancerId, name } = parsed.data;
  // O nome fica guardado também: se o cadastro do freela sumir, a equipe continua legível.
  const snapshot = freelancerId ? await freelancerName(freelancerId) : name;
  if (freelancerId && !snapshot) return fail("Freela não encontrado.", { freelancerId: ["Freela não encontrado."] });
  const values = crewValues(parsed.data);
  await db.insert(projectCrew).values({
    ...values,
    projectId: project.id,
    freelancerId: freelancerId ?? null,
    name: snapshot ?? null,
  });
  await applyCrewDiarias(fd, project.id, freelancerId, parsed.data.function);
  const report = await syncProjectTeam(project.id);
  touch(project.id, { finance: true, agenda: true, freelancers: [freelancerId] });
  return ok([`${snapshot} entrou na equipe.`, report.paymentsCreated ? "Pagamento lançado no financeiro." : ""].join(" ").trim());
}

export async function updateCrewMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const member = await crewById(str(fd, "id"));
  if (!member) return fail("Pessoa não encontrada na equipe.");
  const project = await projectById(member.projectId);
  if (!project) return fail("Projeto não encontrado.");
  const parsed = readCrew(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const { freelancerId, name } = parsed.data;
  const snapshot = freelancerId ? await freelancerName(freelancerId) : name;
  if (freelancerId && !snapshot) return fail("Freela não encontrado.", { freelancerId: ["Freela não encontrado."] });

  await db
    .update(projectCrew)
    .set({ ...crewValues(parsed.data), freelancerId: freelancerId ?? null, name: snapshot ?? null })
    .where(eq(projectCrew.id, member.id));
  await applyCrewDiarias(fd, project.id, freelancerId, parsed.data.function);
  const report = await syncProjectTeam(project.id);

  // Pagamento já com baixa maior que o valor novo, ou dividido em mais de um lançamento: avisa.
  const linked = await db.select().from(financeEntries).where(eq(financeEntries.crewId, member.id));
  const updated = await crewById(member.id);
  const total = linked.reduce((s, e) => s + e.amount, 0);
  let note = report.paymentsCreated || report.paymentsUpdated ? " Financeiro atualizado." : "";
  if (updated && linked.length && total !== updated.amount) {
    note =
      linked.length > 1
        ? " Confira os pagamentos no financeiro: há mais de um lançamento para esta pessoa."
        : ` O pagamento no financeiro continua em ${brl(total)} (já teve baixa).`;
  }
  touch(project.id, { finance: true, agenda: true, freelancers: [member.freelancerId, freelancerId] });
  return ok(`Equipe atualizada.${note}`);
}

export async function deleteCrewMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const member = await crewById(str(fd, "id"));
  if (!member) return fail("Pessoa não encontrada na equipe.");
  // Pagamento gerado e ainda sem nenhuma baixa sai junto. O que já teve baixa fica no financeiro.
  const removed = await db
    .delete(financeEntries)
    .where(and(eq(financeEntries.crewId, member.id), eq(financeEntries.paidAmount, 0)))
    .returning({ id: financeEntries.id });
  // Sai também das diárias do projeto nesta função (senão a agenda colocaria de volta).
  if (member.freelancerId) {
    const diarias = await db.select({ id: events.id }).from(events).where(eq(events.projectId, member.projectId));
    if (diarias.length) {
      await db.delete(eventCrew).where(
        and(
          eq(eventCrew.freelancerId, member.freelancerId),
          inArray(eventCrew.eventId, diarias.map((d) => d.id)),
          or(eq(eventCrew.function, member.function), isNull(eventCrew.function)),
        ),
      );
    }
  }
  await db.delete(projectCrew).where(eq(projectCrew.id, member.id));
  await syncProjectTeam(member.projectId);
  touch(member.projectId, { finance: true, agenda: true, freelancers: [member.freelancerId] });
  return ok(removed.length ? "Removido da equipe e das diárias. O pagamento em aberto saiu do financeiro." : "Removido da equipe e das diárias.");
}

/** Lança no financeiro o pagamento de quem ainda não tem (equipes antigas, de antes da automação). */
export async function generateCrewPayment(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const member = await crewById(str(fd, "id"));
  if (!member) return fail("Pessoa não encontrada na equipe.");
  if (member.amount <= 0) return fail("Defina o valor antes de lançar o pagamento.");
  const report = await syncProjectTeam(member.projectId);
  touch(member.projectId, { finance: true, freelancers: [member.freelancerId] });
  return ok(teamSyncNote(report) || "Pagamento lançado no financeiro.");
}

/* ============================== Financeiro do projeto ============================== */

const EntrySchema = z
  .object({
    kind: z.enum(KIND_KEYS, { message: "Escolha o tipo." }),
    category: z.string({ message: "Escolha a categoria." }),
    description: z.string({ message: "Descreva o lançamento." }).min(2, "Descreva o lançamento.").max(200, "Descrição longa demais."),
    amount: z.number({ message: "Digite o valor." }).int().positive("Digite o valor."),
    dueDate: z.iso.date({ message: "Escolha o vencimento." }),
    installment: z.string().max(20, "Parcela longa demais.").optional(),
    notes: z.string().max(1000, "Observação longa demais.").optional(),
  })
  .refine((d) => FINANCE_CATEGORIES.some((c) => c.key === d.category && c.kind === d.kind), {
    message: "Escolha uma categoria deste tipo.",
    path: ["category"],
  });

export async function createProjectEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const project = await projectById(str(fd, "projectId"));
  if (!project) return fail("Projeto não encontrado.");
  const parsed = EntrySchema.safeParse({
    kind: str(fd, "kind"),
    category: str(fd, "category"),
    description: str(fd, "description"),
    amount: money(fd, "amount"),
    dueDate: str(fd, "dueDate"),
    installment: str(fd, "installment"),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  // Custo de uma diária (alimentação, deslocamento...): a diária precisa ser deste projeto.
  const eventId = str(fd, "eventId");
  const event = eventId
    ? await db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.projectId, project.id)), columns: { id: true } })
    : null;
  await db.insert(financeEntries).values({
    ...parsed.data,
    projectId: project.id,
    eventId: parsed.data.kind === "saida" ? (event?.id ?? null) : null,
    clientId: parsed.data.kind === "entrada" ? project.clientId : null,
  });
  touch(project.id, { finance: true, clients: [project.clientId] });
  const label = parsed.data.kind === "entrada" ? "Entrada" : parsed.data.kind === "imposto" ? "Imposto" : "Saída";
  return ok(`${label} de ${brl(parsed.data.amount)} lançada.`);
}

/** Baixa total ou parcial de um lançamento do projeto (recebimento ou pagamento). */
export async function payProjectEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entryId = str(fd, "entryId");
  const entry = entryId ? await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, entryId) }) : null;
  if (!entry) return fail("Lançamento não encontrado.");
  const open = Math.max(0, entry.amount - entry.paidAmount);
  if (open <= 0) return fail("Este lançamento já está quitado.");
  const parsed = z
    .object({
      amount: z
        .number({ message: "Digite o valor." })
        .int()
        .positive("Digite o valor.")
        .max(open, `O valor passa do que falta (${brl(open)}).`),
      date: z.iso.date({ message: "Escolha a data." }),
      method: z.enum(METHOD_KEYS, { message: "Escolha a forma." }),
    })
    .safeParse({ amount: money(fd, "amount"), date: str(fd, "date") ?? todayISO(), method: str(fd, "method") ?? "pix" });
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await registerPayment({ entryId: entry.id, amount: parsed.data.amount, date: parsed.data.date, method: parsed.data.method });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível registrar.");
  }
  if (entry.kind === "entrada") {
    await logProjectActivity(entry.projectId, "financeiro", `Recebido ${brl(parsed.data.amount)} · ${entry.description}.`, user.id);
  }
  touch(entry.projectId ?? str(fd, "projectId"), { finance: true, freelancers: [entry.freelancerId], clients: [entry.clientId] });
  const rest = open - parsed.data.amount;
  const what = entry.kind === "entrada" ? "Recebimento registrado" : "Pagamento registrado";
  return ok(rest > 0 ? `${what}. Faltam ${brl(rest)}.` : `${what}. Lançamento quitado.`);
}

export async function deleteProjectEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const entryId = str(fd, "entryId");
  const entry = entryId ? await db.query.financeEntries.findFirst({ where: eq(financeEntries.id, entryId) }) : null;
  if (!entry) return fail("Lançamento não encontrado.");
  await db.delete(financeEntries).where(eq(financeEntries.id, entry.id));
  touch(entry.projectId ?? str(fd, "projectId"), { finance: true, freelancers: [entry.freelancerId], clients: [entry.clientId] });
  return ok("Lançamento excluído.");
}
