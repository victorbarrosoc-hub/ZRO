"use server";

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db, schema, transact } from "@/lib/db";
import { bool, fail, fromZod, money, ok, str, type ActionResult } from "@/lib/actions";
import { CATALOG_GROUPS, CATALOG_UNITS } from "@/lib/domain";
import { deleteImages, readImageField, resolveImageField } from "@/lib/services/images";
import { saveSetting } from "@/lib/settings";
import { DEMO_CLEANUP } from "./demo-data";

const { catalogItems, users, loginAttempts } = schema;

/** Configuração mudou: o site (rodapé, privacidade, funil) e o painel leem na hora. */
function revalidateSettings() {
  revalidatePath("/", "layout");
  revalidatePath("/painel/ajustes", "layout");
}

/* ============================== Empresa ============================== */

/** Confere os dígitos do CNPJ (numérico ou alfanumérico, regra de 2026) e formata. */
function formatCnpj(raw: string) {
  const v = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}\d{2}$/.test(v) || /^(\d)\1{13}$/.test(v)) return null;
  const vals = [...v].map((c) => c.charCodeAt(0) - 48);
  const dv = (n: 12 | 13) => {
    const weights = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = weights.reduce((s, w, i) => s + w * vals[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (dv(12) !== vals[12] || dv(13) !== vals[13]) return null;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function normalizeWebsite(raw: string | undefined) {
  if (!raw) return undefined;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const CompanySchema = z.object({
  legalName: z.string().min(3, "Digite a razão social.").max(120, "Razão social muito longa."),
  brand: z.string().min(2, "Digite o nome da marca.").max(60, "Nome muito longo."),
  cnpj: z.string().max(20).optional(),
  address: z.string().max(200, "Endereço muito longo.").optional(),
  email: z.email("E-mail inválido.").optional(),
  financeEmail: z.email("E-mail inválido.").optional(),
  phone: z.string().max(30, "Telefone muito longo.").optional(),
  instagram: z
    .string()
    .max(60)
    .regex(/^[a-zA-Z0-9._]+$/, "Use só o usuário, sem espaço. Ex.: zrofilmes")
    .optional(),
  youtube: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
});

export async function saveCompany(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = CompanySchema.safeParse({
    legalName: str(fd, "legalName"),
    brand: str(fd, "brand"),
    cnpj: str(fd, "cnpj"),
    address: str(fd, "address"),
    email: str(fd, "email")?.toLowerCase(),
    financeEmail: str(fd, "financeEmail")?.toLowerCase(),
    phone: str(fd, "phone"),
    instagram:
      str(fd, "instagram")
        ?.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/^@/, "")
        .replace(/\/.*$/, "") || undefined,
    youtube: str(fd, "youtube"),
    website: str(fd, "website"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const data = parsed.data;

  const cnpj = data.cnpj ? formatCnpj(data.cnpj) : "";
  if (cnpj === null) return fail("CNPJ inválido. Confira os números.", { cnpj: ["CNPJ inválido. Confira os números."] });
  const website = normalizeWebsite(data.website);
  if (website === null) return fail("Endereço do site inválido.", { website: ["Use um endereço como zrofilmes.com.br."] });
  const youtube = normalizeWebsite(data.youtube);
  if (youtube === null || (youtube && !/^https:\/\/(www\.)?youtube\.com\//.test(youtube))) {
    return fail("Link do YouTube inválido.", { youtube: ["Use o link do canal, ex.: youtube.com/@ZROFilmes"] });
  }

  await saveSetting("company", {
    legalName: data.legalName,
    brand: data.brand,
    cnpj,
    address: data.address ?? "",
    email: data.email ?? "",
    financeEmail: data.financeEmail ?? "",
    phone: data.phone ?? "",
    instagram: data.instagram ?? "",
    youtube: youtube ?? "",
    website: website ?? "",
  });
  revalidateSettings();
  return ok("Dados da empresa salvos.");
}

/* ============================== WhatsApp ============================== */

export async function saveWhatsapp(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const digits = (str(fd, "number") ?? "").replace(/\D/g, "");
  let number = "";
  if (digits) {
    if (digits.length === 10 || digits.length === 11) number = `55${digits}`;
    else if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) number = digits;
    else {
      const msg = "Número incompleto. Use DDD + número, ex.: (84) 99999-0000.";
      return fail(msg, { number: [msg] });
    }
  }
  await saveSetting("whatsapp", { number });
  revalidateSettings();
  return ok(number ? "WhatsApp comercial salvo." : "WhatsApp comercial removido.");
}

/* ============================== Impostos ============================== */

export async function saveTaxes(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const raw = (str(fd, "rate") ?? "").replace("%", "").replace(",", ".");
  const rate = raw ? Number(raw) : NaN;
  if (!Number.isFinite(rate) || rate < 0 || rate > 40) {
    const msg = "Digite a alíquota em %, entre 0 e 40. Ex.: 6 ou 6,5.";
    return fail(msg, { rate: [msg] });
  }
  await saveSetting("taxes", { rate: Math.round(rate * 100) / 100 });
  revalidateSettings();
  revalidatePath("/painel/financeiro", "layout");
  revalidatePath("/painel/orcamentos", "layout");
  return ok("Alíquota salva.");
}

/* ============================== Orçamentos ============================== */

const QuoteDefaultsSchema = z.object({
  validityDays: z
    .number({ message: "Digite a validade em dias." })
    .int("Use um número inteiro de dias.")
    .min(1, "Validade mínima: 1 dia.")
    .max(180, "Validade máxima: 180 dias."),
  paymentTerms: z.string().max(300, "Texto muito longo: até 300 caracteres.").optional(),
  conditions: z
    .array(z.string().max(300, "Cada condição pode ter até 300 caracteres."))
    .max(20, "Até 20 condições."),
});

export async function saveQuoteDefaults(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const days = str(fd, "validityDays");
  const parsed = QuoteDefaultsSchema.safeParse({
    validityDays: days ? Number(days) : undefined,
    paymentTerms: str(fd, "paymentTerms"),
    conditions: String(fd.get("conditions") ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim())
      .filter(Boolean),
  });
  if (!parsed.success) return fromZod(parsed.error);
  await saveSetting("quote", {
    validityDays: parsed.data.validityDays,
    paymentTerms: parsed.data.paymentTerms ?? "",
    conditions: parsed.data.conditions,
  });
  revalidateSettings();
  revalidatePath("/painel/orcamentos", "layout");
  return ok("Padrões de orçamento salvos.");
}

/* ============================== Catálogo de preços ============================== */

const GROUP_KEYS = CATALOG_GROUPS.map((g) => g.key) as [string, ...string[]];
const UNIT_KEYS = CATALOG_UNITS.map((u) => u.key) as [string, ...string[]];

const CatalogSchema = z.object({
  name: z.string().min(2, "Digite o nome do item.").max(100, "Nome muito longo."),
  description: z.string().max(300, "Descrição muito longa.").optional(),
  group: z.enum(GROUP_KEYS, { message: "Escolha o grupo." }),
  unit: z.enum(UNIT_KEYS, { message: "Escolha a unidade." }),
  price: z.number({ message: "Digite o preço." }).int().min(0, "Preço inválido.").max(100_000_000, "Preço alto demais."),
  cost: z.number().int().min(0, "Custo inválido.").max(100_000_000, "Custo alto demais."),
  active: z.boolean(),
});

function readCatalog(fd: FormData) {
  return CatalogSchema.safeParse({
    name: str(fd, "name"),
    description: str(fd, "description"),
    group: str(fd, "group"),
    unit: str(fd, "unit"),
    price: money(fd, "price"),
    cost: money(fd, "cost") ?? 0,
    active: bool(fd, "active"),
  });
}

function revalidateCatalog() {
  revalidatePath("/painel/ajustes/catalogo");
  revalidatePath("/painel/orcamentos", "layout");
}

export async function createCatalogItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readCatalog(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db.select({ max: sql<number | null>`max(${catalogItems.sortOrder})`.mapWith(Number) }).from(catalogItems);
  await db.insert(catalogItems).values({
    ...parsed.data,
    description: parsed.data.description ?? null,
    sortOrder: row?.max == null ? 0 : Number(row.max) + 1,
  });
  revalidateCatalog();
  return ok("Item adicionado ao catálogo.");
}

export async function updateCatalogItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Item não encontrado.");
  const parsed = readCatalog(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db
    .update(catalogItems)
    .set({ ...parsed.data, description: parsed.data.description ?? null })
    .where(eq(catalogItems.id, id));
  revalidateCatalog();
  return ok("Item salvo.");
}

export async function toggleCatalogActive(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const item = id ? await db.query.catalogItems.findFirst({ where: eq(catalogItems.id, id) }) : null;
  if (!item) return fail("Item não encontrado.");
  await db.update(catalogItems).set({ active: !item.active }).where(eq(catalogItems.id, item.id));
  revalidateCatalog();
  return ok(item.active ? "Item desativado: some da lista dos orçamentos novos." : "Item ativado.");
}

export async function deleteCatalogItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Item não encontrado.");
  await db.delete(catalogItems).where(eq(catalogItems.id, id));
  revalidateCatalog();
  return ok("Item excluído do catálogo.");
}

/** Sobe/desce dentro do grupo e renumera o catálogo inteiro na ordem dos grupos. */
export async function moveCatalogItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const dir = fd.get("dir") === "up" ? -1 : fd.get("dir") === "down" ? 1 : 0;
  if (!id || !dir) return fail("Item não encontrado.");
  const items = await db
    .select({ id: catalogItems.id, group: catalogItems.group })
    .from(catalogItems)
    .orderBy(asc(catalogItems.sortOrder), asc(catalogItems.createdAt));
  const current = items.find((i) => i.id === id);
  if (!current) return fail("Item não encontrado.");

  const known = CATALOG_GROUPS.map((g) => g.key as string);
  const groups = [...known, ...new Set(items.map((i) => i.group).filter((g) => !known.includes(g)))];
  const ordered = groups.flatMap((g) => {
    const list = items.filter((i) => i.group === g);
    if (g === current.group) {
      const a = list.findIndex((i) => i.id === id);
      const b = a + dir;
      if (b >= 0 && b < list.length) [list[a], list[b]] = [list[b], list[a]];
    }
    return list;
  });
  await transact((t) => ordered.map((item, n) => t.update(catalogItems).set({ sortOrder: n }).where(eq(catalogItems.id, item.id))));
  revalidateCatalog();
  return ok();
}

/* ============================== Conta ============================== */

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Digite a senha atual."),
    next: z.string().min(10, "A nova senha precisa ter pelo menos 10 caracteres.").max(128, "Senha longa demais."),
    confirm: z.string().min(1, "Repita a nova senha."),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "A confirmação não bate com a nova senha." })
  .refine((d) => d.next !== d.current, { path: ["next"], message: "A nova senha precisa ser diferente da atual." });

export async function changePassword(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  // Senha não passa por trim: espaço também é caractere.
  const parsed = PasswordSchema.safeParse({
    current: String(fd.get("current") ?? ""),
    next: String(fd.get("next") ?? ""),
    confirm: String(fd.get("confirm") ?? ""),
  });
  if (!parsed.success) return fromZod(parsed.error);

  // Mesmo freio do login: muitas senhas erradas seguidas travam por 15 minutos.
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000);
  const [fails] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, me.email), eq(loginAttempts.success, false), gte(loginAttempts.createdAt, since)));
  if (Number(fails?.n ?? 0) >= MAX_FAILS) {
    return fail(`Muitas tentativas com senha errada. Espere ${WINDOW_MIN} minutos e tente de novo.`);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, me.id), columns: { id: true, passwordHash: true } });
  if (!user) return fail("Usuário não encontrado.");
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    await db.insert(loginAttempts).values({ email: me.email, ip: null, success: false });
    return fail("A senha atual não confere.", { current: ["A senha atual não confere."] });
  }

  const passwordHash = await hashPassword(parsed.data.next);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  // A sessão é presa à senha: renova a deste aparelho; os outros saem.
  await createSession({ id: me.id, name: me.name, passwordHash });
  revalidatePath("/painel/ajustes/conta");
  return ok("Senha trocada. Os outros aparelhos vão pedir login de novo.");
}

const EmailSchema = z.object({
  email: z.email("Confira o e-mail.").max(120, "E-mail longo demais."),
  current: z.string().min(1, "Digite a senha atual."),
});

/**
 * Troca o e-mail de acesso de quem está logado. Pede a senha atual (mesmo freio do login)
 * e não deixa usar o e-mail de outra conta. A sessão continua: ela é presa à senha, não ao e-mail.
 */
export async function changeEmail(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = EmailSchema.safeParse({
    email: (str(fd, "email") ?? "").toLowerCase(),
    current: String(fd.get("current") ?? ""),
  });
  if (!parsed.success) return fromZod(parsed.error);
  const { email, current } = parsed.data;
  if (email === me.email) return fail("Esse já é o seu e-mail de acesso.", { email: ["Esse já é o seu e-mail de acesso."] });

  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000);
  const [fails] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, me.email), eq(loginAttempts.success, false), gte(loginAttempts.createdAt, since)));
  if (Number(fails?.n ?? 0) >= MAX_FAILS) {
    return fail(`Muitas tentativas com senha errada. Espere ${WINDOW_MIN} minutos e tente de novo.`);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, me.id), columns: { id: true, passwordHash: true } });
  if (!user) return fail("Usuário não encontrado.");
  if (!(await verifyPassword(current, user.passwordHash))) {
    await db.insert(loginAttempts).values({ email: me.email, ip: null, success: false });
    return fail("A senha atual não confere.", { current: ["A senha atual não confere."] });
  }
  const outro = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (outro) return fail("Esse e-mail já é de outra conta.", { email: ["Esse e-mail já é de outra conta."] });

  await db.update(users).set({ email }).where(eq(users.id, user.id));
  revalidatePath("/painel", "layout");
  return ok(`Pronto. Daqui em diante, entre com ${email}.`);
}

/* ============================== Perfil ============================== */

/** Nome e foto de quem está logado (aparecem no menu e nos cards da Pauta). */
export async function saveProfile(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const name = str(fd, "name") ?? "";
  if (name.length < 2) return fail("Digite o seu nome.", { name: ["Digite o seu nome."] });
  if (name.length > 80) return fail("Nome longo demais.", { name: ["Use até 80 caracteres."] });
  const photo = readImageField(fd, "photo");
  if ("error" in photo) return fail(photo.error, { photo: [photo.error] });
  const current = await db.query.users.findFirst({ where: eq(users.id, me.id), columns: { photoId: true } });
  const photoId = await resolveImageField(photo, current?.photoId);
  await db.update(users).set({ name, photoId }).where(eq(users.id, me.id));
  if (current?.photoId && current.photoId !== photoId) await deleteImages([current.photoId]);
  revalidatePath("/painel", "layout");
  return ok("Perfil salvo.");
}

/* ============================== Dados de exemplo ============================== */

export async function deleteDemoData(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  if ((str(fd, "confirm") ?? "").toUpperCase() !== "APAGAR") {
    return fail("Digite APAGAR para confirmar.", { confirm: ["Digite APAGAR para confirmar."] });
  }
  // Tudo numa transação: ou sai tudo, ou nada muda.
  let removed = 0;
  await db.transaction(async (t) => {
    for (const step of DEMO_CLEANUP) {
      const result = (await t.execute(sql.raw(step.sql))) as { count?: number; affectedRows?: number };
      if (step.table) removed += Number(result.count ?? result.affectedRows ?? 0);
    }
  });
  revalidatePath("/painel", "layout");
  revalidatePath("/", "layout");
  return ok(removed ? `Dados de exemplo apagados: ${removed} registros.` : "Não havia dados de exemplo.");
}
