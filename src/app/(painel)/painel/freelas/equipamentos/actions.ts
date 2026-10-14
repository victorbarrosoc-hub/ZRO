"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, ok, str, type ActionResult } from "@/lib/actions";
import { EQUIPMENT_NAME_MAX, cleanEquipmentName } from "@/lib/domain";
import { findOrCreateEquipment, isEquipmentCategory } from "@/lib/services/equipment";

const { equipment } = schema;

const EquipmentSchema = z.object({
  name: z.string({ error: "Digite o nome do equipamento." }).min(1, "Digite o nome do equipamento.").max(EQUIPMENT_NAME_MAX),
  category: z.string().refine(isEquipmentCategory, "Escolha a categoria."),
});

function read(fd: FormData) {
  return EquipmentSchema.safeParse({ name: cleanEquipmentName(str(fd, "name") ?? "") ?? undefined, category: str(fd, "category") });
}

function revalidateEquipment() {
  revalidatePath("/painel/freelas/equipamentos");
  revalidatePath("/painel/freelas", "layout");
}

export async function createEquipment(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const exists = await db.query.equipment.findFirst({ where: sql`lower(${equipment.name}) = lower(${parsed.data.name})` });
  if (exists) return fail("Esse equipamento já está no banco.", { name: ["Esse equipamento já está no banco."] });
  const item = await findOrCreateEquipment(parsed.data.name, parsed.data.category);
  revalidateEquipment();
  return ok("Equipamento adicionado.", item?.id);
}

export async function updateEquipment(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Equipamento não encontrado.");
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const clash = await db.query.equipment.findFirst({
    where: and(sql`lower(${equipment.name}) = lower(${parsed.data.name})`, ne(equipment.id, id)),
  });
  if (clash) return fail("Já existe outro equipamento com esse nome.", { name: ["Já existe outro equipamento com esse nome."] });
  const [row] = await db.update(equipment).set(parsed.data).where(eq(equipment.id, id)).returning({ id: equipment.id });
  if (!row) return fail("Equipamento não encontrado.");
  revalidateEquipment();
  return ok("Equipamento atualizado.");
}

/** Tira do banco e de todos os freelas que tinham. */
export async function deleteEquipment(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Equipamento não encontrado.");
  await db.delete(equipment).where(eq(equipment.id, id));
  revalidateEquipment();
  return ok("Equipamento excluído.");
}
