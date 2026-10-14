"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, list, money, ok, str, type ActionResult } from "@/lib/actions";
import { CATEGORY_KEYS, FUNCTION_MAX, RATE_UNITS, normalizeFunction } from "@/lib/domain";
import { instagramHandle } from "@/lib/format";
import { listCustomFunctions } from "@/lib/queries/freelas";
import { registerPayment } from "@/lib/services/finance";
import { deleteImages, readImageField, resolveImageField } from "@/lib/services/images";

const FreelaSchema = z.object({
  name: z.string().min(2, "Digite o nome."),
  city: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  email: z.email("E-mail inválido.").optional(),
  instagram: z.string().max(60).optional(),
  pixKey: z.string().max(120).optional(),
  functions: z
    .array(z.string().max(FUNCTION_MAX, `Nome de função longo demais (até ${FUNCTION_MAX} letras).`))
    .min(1, "Marque pelo menos uma função.")
    .max(20, "No máximo 20 funções por freela."),
  equipment: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

function readFreela(fd: FormData) {
  return FreelaSchema.safeParse({
    name: str(fd, "name"),
    city: str(fd, "city"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    instagram: instagramHandle(str(fd, "instagram")),
    pixKey: str(fd, "pixKey"),
    functions: list(fd, "functions"),
    equipment: str(fd, "equipment"),
    notes: str(fd, "notes"),
  });
}

/** Funções marcadas → chaves limpas, reaproveitando as que já existem (mesmo nome, outra maiúscula). */
async function cleanFunctions(values: string[]) {
  const existing = await listCustomFunctions();
  const out: string[] = [];
  for (const value of values) {
    const key = normalizeFunction(value, [...existing, ...out]);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Telas que mostram o freela (nome e foto). */
function revalidateFreela(id: string) {
  revalidatePath("/painel/freelas");
  revalidatePath(`/painel/freelas/${id}`);
  revalidatePath("/painel");
  revalidatePath("/painel/agenda");
  revalidatePath("/painel/projetos", "layout");
  revalidatePath("/painel/financeiro", "layout");
}

export async function createFreelancer(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readFreela(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const photo = readImageField(fd, "photo");
  if ("error" in photo) return fail(photo.error, { photo: [photo.error] });
  const functions = await cleanFunctions(parsed.data.functions);
  if (!functions.length) return fail("Marque pelo menos uma função.", { functions: ["Marque pelo menos uma função."] });
  const photoId = await resolveImageField(photo, null);
  const [row] = await db
    .insert(schema.freelancers)
    .values({ ...parsed.data, functions, photoId })
    .returning({ id: schema.freelancers.id });
  revalidatePath("/painel/freelas");
  return ok("Freela cadastrado.", row.id);
}

export async function updateFreelancer(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Freela não encontrado.");
  const parsed = readFreela(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const photo = readImageField(fd, "photo");
  if ("error" in photo) return fail(photo.error, { photo: [photo.error] });
  const current = await db.query.freelancers.findFirst({ where: eq(schema.freelancers.id, id), columns: { photoId: true } });
  if (!current) return fail("Freela não encontrado.");
  const functions = await cleanFunctions(parsed.data.functions);
  if (!functions.length) return fail("Marque pelo menos uma função.", { functions: ["Marque pelo menos uma função."] });
  const photoId = await resolveImageField(photo, current.photoId);
  await db
    .update(schema.freelancers)
    .set({ ...parsed.data, functions, photoId, active: fd.get("active") !== "off" })
    .where(eq(schema.freelancers.id, id));
  if (current.photoId !== photoId) await deleteImages([current.photoId]);
  revalidateFreela(id);
  return ok("Dados atualizados.");
}

export async function toggleFreelancerActive(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Freela não encontrado.");
  const current = await db.query.freelancers.findFirst({ where: eq(schema.freelancers.id, id) });
  if (!current) return fail("Freela não encontrado.");
  await db.update(schema.freelancers).set({ active: !current.active }).where(eq(schema.freelancers.id, id));
  revalidatePath("/painel/freelas");
  revalidatePath(`/painel/freelas/${id}`);
  return ok(current.active ? "Freela arquivado." : "Freela reativado.");
}

export async function deleteFreelancer(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Freela não encontrado.");
  const [row] = await db
    .delete(schema.freelancers)
    .where(eq(schema.freelancers.id, id))
    .returning({ photoId: schema.freelancers.photoId });
  await deleteImages([row?.photoId]);
  revalidatePath("/painel/freelas");
  redirect("/painel/freelas");
}

const RateSchema = z.object({
  freelancerId: z.string().min(1),
  function: z.string({ message: "Escolha a função." }).min(1, "Escolha a função.").max(FUNCTION_MAX, "Função longa demais."),
  category: z.enum(CATEGORY_KEYS).optional(),
  unit: z.enum(RATE_UNITS.map((u) => u.key) as [string, ...string[]]),
  amount: z.number({ message: "Digite o valor." }).int().positive("Digite o valor."),
});

export async function addRate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = RateSchema.safeParse({
    freelancerId: str(fd, "freelancerId"),
    function: str(fd, "function"),
    category: str(fd, "category"),
    unit: str(fd, "unit") ?? "diaria",
    amount: money(fd, "amount"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  await db.insert(schema.freelancerRates).values(parsed.data);
  revalidatePath(`/painel/freelas/${parsed.data.freelancerId}`);
  revalidatePath("/painel/freelas");
  return ok("Valor salvo.");
}

export async function deleteRate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const freelancerId = str(fd, "freelancerId");
  if (!id) return fail("Valor não encontrado.");
  await db.delete(schema.freelancerRates).where(eq(schema.freelancerRates.id, id));
  revalidatePath(`/painel/freelas/${freelancerId}`);
  revalidatePath("/painel/freelas");
  return ok("Valor removido.");
}

/** Quita (ou registra parte de) um pagamento a freela, direto da ficha dele. */
export async function payFreelancerEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const entryId = str(fd, "entryId");
  const freelancerId = str(fd, "freelancerId");
  if (!entryId) return fail("Lançamento não encontrado.");
  try {
    await registerPayment({
      entryId,
      amount: money(fd, "amount"),
      date: str(fd, "date"),
      method: str(fd, "method") ?? "pix",
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível registrar o pagamento.");
  }
  revalidatePath(`/painel/freelas/${freelancerId}`);
  revalidatePath("/painel/freelas");
  revalidatePath("/painel/financeiro");
  revalidatePath("/painel");
  return ok("Pagamento registrado.");
}
