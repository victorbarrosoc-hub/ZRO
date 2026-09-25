"use server";

import { and, asc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, ok, str, type ActionResult } from "@/lib/actions";
import { todayISO } from "@/lib/format";

const { projectChecklists, equipmentKits, events, projects } = schema;

type Item = { name: string; qty: number; out: boolean; back: boolean };

const MAX_ITEMS = 300;

async function load(fd: FormData) {
  const id = str(fd, "id");
  const projectId = str(fd, "projectId");
  if (!id || !projectId) return null;
  const [row] = await db
    .select({ id: projectChecklists.id, projectId: projectChecklists.projectId, items: projectChecklists.items })
    .from(projectChecklists)
    .where(and(eq(projectChecklists.id, id), eq(projectChecklists.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

async function saveItems(id: string, projectId: string, items: Item[]) {
  await db.update(projectChecklists).set({ items }).where(eq(projectChecklists.id, id));
  revalidatePath(`/painel/projetos/${projectId}`);
  revalidatePath(`/painel/projetos/${projectId}/checklists/${id}`);
}

/** Índice + nome: garante que o item mexido é o que está na tela. */
function pickItem(items: Item[], fd: FormData) {
  const index = Number(str(fd, "index"));
  const name = str(fd, "name");
  if (!Number.isInteger(index) || index < 0 || index >= items.length || items[index].name !== name) return null;
  return index;
}

/** Cria um checklist (com a data da próxima diária, se houver) e abre o editor. */
export async function newChecklist(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const projectId = str(fd, "projectId");
  if (!projectId) return fail("Projeto não encontrado.");
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return fail("Projeto não encontrado.");
  const today = todayISO();
  const [diaria] = await db
    .select({ title: events.title, date: events.date })
    .from(events)
    .where(and(eq(events.projectId, projectId), eq(events.type, "diaria"), gte(events.date, today)))
    .orderBy(asc(events.date))
    .limit(1);

  const [row] = await db
    .insert(projectChecklists)
    .values({ projectId, title: diaria ? `Equipamento · ${diaria.title}` : "Checklist de equipamento", date: diaria?.date ?? today, items: [] })
    .returning({ id: projectChecklists.id });

  revalidatePath(`/painel/projetos/${projectId}`);
  redirect(`/painel/projetos/${projectId}/checklists/${row.id}`);
}

const InfoSchema = z.object({
  title: z.string({ message: "Dê um título ao checklist." }).min(2, "Dê um título ao checklist.").max(120, "Título longo demais."),
  date: z.iso.date({ message: "Data inválida." }).optional(),
});

export async function updateChecklistInfo(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  const parsed = InfoSchema.safeParse({ title: str(fd, "title"), date: str(fd, "date") });
  if (!parsed.success) return fromZod(parsed.error);
  await db
    .update(projectChecklists)
    .set({ title: parsed.data.title, date: parsed.data.date ?? null })
    .where(eq(projectChecklists.id, row.id));
  revalidatePath(`/painel/projetos/${row.projectId}`);
  revalidatePath(`/painel/projetos/${row.projectId}/checklists/${row.id}`);
  return ok("Checklist atualizado.");
}

/** Marca "saiu" ou "voltou". Voltou implica que saiu; desmarcar "saiu" desfaz o "voltou". */
export async function toggleChecklistItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  const field = str(fd, "field");
  if (field !== "out" && field !== "back") return fail("Marcação inválida.");
  const index = pickItem(row.items, fd);
  if (index == null) return fail("A lista mudou enquanto você mexia. Recarregue a página.");
  const value = str(fd, "value") === "1";
  const items = row.items.map((it, i) => {
    if (i !== index) return it;
    if (field === "out") return { ...it, out: value, back: value ? it.back : false };
    return { ...it, back: value, out: value ? true : it.out };
  });
  await saveItems(row.id, row.projectId, items);
  return ok();
}

const ItemSchema = z.object({
  name: z.string({ message: "Digite o nome do item." }).min(1, "Digite o nome do item.").max(80, "Nome longo demais."),
  qty: z.number({ message: "Quantidade inválida." }).int("Quantidade inválida.").min(1, "A quantidade mínima é 1.").max(999, "Quantidade alta demais."),
});

export async function addChecklistItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  const parsed = ItemSchema.safeParse({ name: str(fd, "itemName"), qty: Number(str(fd, "qty") ?? "1") });
  if (!parsed.success) return fromZod(parsed.error);
  if (row.items.length >= MAX_ITEMS) return fail("Esse checklist já está cheio.");
  await saveItems(row.id, row.projectId, [...row.items, { ...parsed.data, out: false, back: false }]);
  return ok("Item adicionado.");
}

export async function removeChecklistItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  const index = pickItem(row.items, fd);
  if (index == null) return fail("A lista mudou enquanto você mexia. Recarregue a página.");
  await saveItems(
    row.id,
    row.projectId,
    row.items.filter((_, i) => i !== index),
  );
  return ok("Item removido.");
}

/** Acrescenta os itens de um kit (Câmera A, Áudio, Luz, Drone...). */
export async function addKitToChecklist(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  const kitId = str(fd, "kitId");
  if (!kitId) return fail("Escolha um kit.");
  const kit = await db.query.equipmentKits.findFirst({ where: eq(equipmentKits.id, kitId) });
  if (!kit) return fail("Kit não encontrado.");
  if (!kit.items.length) return fail(`O kit ${kit.name} está vazio.`);
  if (row.items.length + kit.items.length > MAX_ITEMS) return fail("Esse checklist ficaria grande demais.");
  const added = kit.items.map((it) => ({ name: it.name, qty: Math.max(1, Math.round(it.qty || 1)), out: false, back: false }));
  await saveItems(row.id, row.projectId, [...row.items, ...added]);
  return ok(`Kit ${kit.name} adicionado: ${added.length} ${added.length > 1 ? "itens" : "item"}.`);
}

/** Tudo saiu, tudo voltou ou recomeçar a conferência. */
export async function setAllChecklistItems(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  const mode = str(fd, "mode");
  if (mode !== "out" && mode !== "back" && mode !== "reset") return fail("Ação inválida.");
  const items = row.items.map((it) =>
    mode === "reset" ? { ...it, out: false, back: false } : mode === "out" ? { ...it, out: true } : { ...it, out: true, back: true },
  );
  await saveItems(row.id, row.projectId, items);
  return ok(mode === "reset" ? "Conferência zerada." : mode === "out" ? "Tudo marcado como saiu." : "Tudo marcado como voltou.");
}

export async function deleteChecklist(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const row = await load(fd);
  if (!row) return fail("Checklist não encontrado.");
  await db.delete(projectChecklists).where(eq(projectChecklists.id, row.id));
  revalidatePath(`/painel/projetos/${row.projectId}`);
  redirect(`/painel/projetos/${row.projectId}?aba=documentos`);
}
