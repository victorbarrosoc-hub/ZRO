import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema, transact } from "@/lib/db";
import {
  EQUIPMENT_CATEGORIES,
  cleanEquipmentName,
  equipmentKey,
  guessEquipmentCategory,
  type EquipmentCategory,
} from "@/lib/domain";

const { equipment, freelancerEquipment } = schema;

export function isEquipmentCategory(value: string | null | undefined): value is EquipmentCategory {
  return EQUIPMENT_CATEGORIES.some((c) => c.key === value);
}

/** Item do banco com o mesmo modelo, mesmo escrito de outro jeito ("Sony A7IV" = "Sony A7 IV"). */
export async function findEquipmentByName(name: string, exceptId?: string) {
  const key = equipmentKey(name);
  const all = await db.select().from(equipment);
  return all.find((e) => e.id !== exceptId && equipmentKey(e.name) === key) ?? null;
}

/** Acha o modelo pelo nome ou cria no banco de equipamentos. */
export async function findOrCreateEquipment(rawName: string, category?: string | null) {
  const name = cleanEquipmentName(rawName);
  if (!name) return null;
  const found = await findEquipmentByName(name);
  if (found) return found;
  const [created] = await db
    .insert(equipment)
    .values({ name, category: isEquipmentCategory(category) ? category : guessEquipmentCategory(name) })
    .onConflictDoNothing()
    .returning();
  // Outro cadastro criou o mesmo nome ao mesmo tempo: usa o que ficou.
  return created ?? (await db.query.equipment.findFirst({ where: sql`lower(${equipment.name}) = lower(${name})` })) ?? null;
}

/**
 * Valores do seletor do cadastro → equipamento do freela.
 * "id:<id>" é item do banco; "novo:<categoria>|<nome>" entra no banco agora.
 */
export async function setFreelancerEquipment(freelancerId: string, values: string[]) {
  const ids = new Set<string>();
  for (const value of values) {
    if (value.startsWith("id:")) ids.add(value.slice(3));
    else if (value.startsWith("novo:")) {
      const [category, ...rest] = value.slice(5).split("|");
      const item = await findOrCreateEquipment(rest.join("|"), category);
      if (item) ids.add(item.id);
    }
  }
  const valid = ids.size
    ? (await db.select({ id: equipment.id }).from(equipment).where(inArray(equipment.id, [...ids]))).map((r) => r.id)
    : [];
  await transact((t) => [
    t.delete(freelancerEquipment).where(eq(freelancerEquipment.freelancerId, freelancerId)),
    ...(valid.length ? [t.insert(freelancerEquipment).values(valid.map((equipmentId) => ({ freelancerId, equipmentId })))] : []),
  ]);
}
