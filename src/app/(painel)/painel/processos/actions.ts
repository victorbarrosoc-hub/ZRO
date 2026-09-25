"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, ok, str, type ActionResult } from "@/lib/actions";
import { CATEGORY_KEYS, STAGE_KEYS } from "@/lib/domain";

const { projectTemplates, equipmentKits } = schema;

/** Modelos e kits aparecem nas telas de projeto (novo projeto, checklist). */
function revalidateProcessos(...paths: string[]) {
  revalidatePath("/painel/processos", "layout");
  revalidatePath("/painel/projetos", "layout");
  for (const p of paths) revalidatePath(p);
}

function jsonField(fd: FormData, key: string): unknown {
  const raw = fd.get(key);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ============================== Modelos de projeto ============================== */

const TaskSchema = z.object({
  stage: z.enum(STAGE_KEYS, { message: "Etapa inválida." }),
  title: z.string().trim().min(1, "Tarefa sem nome.").max(160, "Tarefa com nome muito longo (até 160 caracteres)."),
});

const TemplateSchema = z.object({
  name: z.string().min(2, "Digite o nome do modelo.").max(80, "Nome muito longo."),
  category: z.enum(CATEGORY_KEYS, { message: "Categoria inválida." }).optional(),
  description: z.string().max(300, "Descrição muito longa.").optional(),
  tasks: z.array(TaskSchema, { message: "Lista de tarefas inválida." }).max(200, "Até 200 tarefas por modelo."),
});

function readTemplate(fd: FormData) {
  const tasks = jsonField(fd, "tasks");
  return TemplateSchema.safeParse({
    name: str(fd, "name"),
    category: str(fd, "category"),
    description: str(fd, "description"),
    // Tarefas sem nome são descartadas (linha que ficou vazia).
    tasks: Array.isArray(tasks)
      ? tasks
          .map((t) => ({ stage: String(t?.stage ?? ""), title: String(t?.title ?? "").trim() }))
          .filter((t) => t.title)
      : tasks,
  });
}

export async function saveTemplate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const parsed = readTemplate(fd);
  if (!parsed.success) return fromZod(parsed.error);
  // Ordem das tarefas: pela etapa, mantendo a ordem de cada uma.
  const order = new Map(STAGE_KEYS.map((k, i) => [k, i]));
  const tasks = [...parsed.data.tasks].sort((a, b) => (order.get(a.stage) ?? 0) - (order.get(b.stage) ?? 0));
  const values = {
    name: parsed.data.name,
    category: parsed.data.category ?? null,
    description: parsed.data.description ?? null,
    tasks,
  };

  if (id) {
    const exists = await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, id), columns: { id: true } });
    if (!exists) return fail("Modelo não encontrado.");
    await db.update(projectTemplates).set(values).where(eq(projectTemplates.id, id));
    revalidateProcessos(`/painel/processos/${id}`);
    return ok("Modelo salvo.", id);
  }
  const [row] = await db.insert(projectTemplates).values(values).returning({ id: projectTemplates.id });
  revalidateProcessos();
  return ok("Modelo criado.", row.id);
}

export async function duplicateTemplate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const source = id ? await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, id) }) : null;
  if (!source) return fail("Modelo não encontrado.");
  const [row] = await db
    .insert(projectTemplates)
    .values({
      name: `${source.name} (cópia)`.slice(0, 80),
      // A cópia nasce sem categoria para não disputar com o original.
      category: null,
      description: source.description,
      tasks: source.tasks,
    })
    .returning({ id: projectTemplates.id });
  revalidateProcessos();
  redirect(`/painel/processos/${row.id}?copia=1`);
}

export async function deleteTemplate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Modelo não encontrado.");
  await db.delete(projectTemplates).where(eq(projectTemplates.id, id));
  revalidateProcessos();
  if (fd.get("from") === "editor") redirect("/painel/processos");
  return ok("Modelo excluído.");
}

/* ============================== Kits de equipamento ============================== */

const KitItemSchema = z.object({
  name: z.string().trim().min(1, "Item sem nome.").max(100, "Nome de item muito longo."),
  qty: z.number({ message: "Quantidade inválida." }).int("Use número inteiro.").min(1, "Quantidade mínima: 1.").max(999, "Quantidade muito alta."),
});

const KitSchema = z.object({
  name: z.string().min(2, "Digite o nome do kit.").max(60, "Nome muito longo."),
  description: z.string().max(200, "Descrição muito longa.").optional(),
  items: z.array(KitItemSchema, { message: "Lista de itens inválida." }).min(1, "Coloque pelo menos um item.").max(100, "Até 100 itens por kit."),
});

function readKit(fd: FormData) {
  const items = jsonField(fd, "items");
  return KitSchema.safeParse({
    name: str(fd, "name"),
    description: str(fd, "description"),
    items: Array.isArray(items)
      ? items
          .map((i) => ({ name: String(i?.name ?? "").trim(), qty: Number(i?.qty) }))
          .filter((i) => i.name)
      : items,
  });
}

export async function createKit(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readKit(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db
    .insert(equipmentKits)
    .values({ name: parsed.data.name, description: parsed.data.description ?? null, items: parsed.data.items })
    .returning({ id: equipmentKits.id });
  revalidateProcessos();
  return ok("Kit criado.", row.id);
}

export async function updateKit(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Kit não encontrado.");
  const parsed = readKit(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db
    .update(equipmentKits)
    .set({ name: parsed.data.name, description: parsed.data.description ?? null, items: parsed.data.items })
    .where(eq(equipmentKits.id, id));
  revalidateProcessos();
  return ok("Kit salvo.");
}

export async function deleteKit(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Kit não encontrado.");
  await db.delete(equipmentKits).where(eq(equipmentKits.id, id));
  revalidateProcessos();
  return ok("Kit excluído.");
}
