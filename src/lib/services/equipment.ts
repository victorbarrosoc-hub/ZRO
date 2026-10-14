import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema, transact } from "@/lib/db";
import { EQUIPMENT_CATEGORIES, cleanEquipmentName, guessEquipmentCategory, type EquipmentCategory } from "@/lib/domain";

const { equipment, freelancerEquipment } = schema;

export function isEquipmentCategory(value: string | null | undefined): value is EquipmentCategory {
  return EQUIPMENT_CATEGORIES.some((c) => c.key === value);
}

/** Acha o modelo pelo nome (sem diferenciar maiúscula) ou cria no banco de equipamentos. */
export async function findOrCreateEquipment(rawName: string, category?: string | null) {
  const name = cleanEquipmentName(rawName);
  if (!name) return null;
  const found = await db.query.equipment.findFirst({ where: sql`lower(${equipment.name}) = lower(${name})` });
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
