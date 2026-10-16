import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { agendarPastasDoProjeto } from "./drive-pastas";

const { projects, projectTemplates, projectTasks, financeEntries } = schema;

/** Próximo código de projeto do ano: ZRO-2026-005. */
export async function nextProjectCode(year = Number(todayISO().slice(0, 4))) {
  const prefix = `ZRO-${year}-`;
  const rows = await db.select({ code: projects.code }).from(projects).where(like(projects.code, `${prefix}%`));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** Copia as tarefas de um modelo para o projeto (sem duplicar as que já existem). */
export async function applyTemplate(projectId: string, templateId: string) {
  const template = await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, templateId) });
  if (!template) return 0;
  const existing = await db.select({ title: projectTasks.title, stage: projectTasks.stage }).from(projectTasks).where(eq(projectTasks.projectId, projectId));
  const seen = new Set(existing.map((t) => `${t.stage}::${t.title}`));
  const toInsert = template.tasks
    .filter((t) => !seen.has(`${t.stage}::${t.title}`))
    .map((t, i) => ({ projectId, stage: t.stage, title: t.title, sortOrder: existing.length + i }));
  if (toInsert.length) await db.insert(projectTasks).values(toInsert);
  return toInsert.length;
}

/**
 * Cria um projeto com código automático e, se houver, as tarefas do modelo.
 * Usado por Projetos (novo projeto) e por Orçamentos (ao aprovar). Com o Google conectado,
 * a árvore de pastas do projeto nasce sozinha no Drive (services/drive-pastas.ts).
 */
export async function createProject(input: {
  title: string;
  clientId?: string | null;
  leadId?: string | null;
  quoteId?: string | null;
  category: string;
  startDate?: string | null;
  dueDate?: string | null;
  value?: number;
  briefing?: string | null;
  templateId?: string | null;
}) {
  const code = await nextProjectCode();
  const [row] = await db
    .insert(projects)
    .values({
      code,
      title: input.title,
      clientId: input.clientId ?? null,
      leadId: input.leadId ?? null,
      quoteId: input.quoteId ?? null,
      category: input.category,
      startDate: input.startDate ?? todayISO(),
      dueDate: input.dueDate ?? null,
      value: input.value ?? 0,
      briefing: input.briefing ?? null,
    })
    .returning({ id: projects.id, code: projects.code });

  let templateId = input.templateId ?? null;
  if (!templateId) {
    // Sem modelo escolhido: usa o primeiro modelo da mesma categoria, se existir.
    const byCategory = await db.query.projectTemplates.findFirst({
      where: eq(projectTemplates.category, input.category),
      orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)],
    });
    templateId = byCategory?.id ?? null;
  }
  if (templateId) await applyTemplate(row.id, templateId);
  // Pastas no Drive: a linha "criando" agora; o resto depois da resposta (nunca lança).
  await agendarPastasDoProjeto(row.id);
  return row;
}

/**
 * Valor do projeto → recebimento no financeiro, sem precisar lançar à mão.
 * - Projeto com valor e nenhuma entrada: cria o recebimento (vence no prazo do projeto).
 * - Uma entrada só, sem baixa e com o valor antigo: acompanha o valor novo.
 * - Parcelas ou baixas feitas: não mexe (a aba Financeiro mostra a diferença).
 * Entradas do projeto sempre ficam no nome do cliente do projeto.
 */
export async function syncProjectReceivable(projectId: string, previousValue?: number) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return null;
  const entradas = await db
    .select()
    .from(financeEntries)
    .where(and(eq(financeEntries.projectId, project.id), eq(financeEntries.kind, "entrada")));

  const otherClient = entradas.filter((e) => e.clientId !== project.clientId);
  for (const e of otherClient) {
    await db.update(financeEntries).set({ clientId: project.clientId }).where(eq(financeEntries.id, e.id));
  }

  if (project.value <= 0) return null;
  if (!entradas.length) {
    await db.insert(financeEntries).values({
      kind: "entrada",
      category: "cliente",
      description: `${project.title} · valor do projeto`,
      projectId: project.id,
      clientId: project.clientId,
      amount: project.value,
      dueDate: project.dueDate ?? project.startDate ?? todayISO(),
    });
    return "created" as const;
  }
  const only = entradas.length === 1 ? entradas[0] : null;
  if (only && only.paidAmount === 0 && previousValue != null && only.amount === previousValue && previousValue !== project.value) {
    await db.update(financeEntries).set({ amount: project.value }).where(eq(financeEntries.id, only.id));
    return "updated" as const;
  }
  return null;
}
