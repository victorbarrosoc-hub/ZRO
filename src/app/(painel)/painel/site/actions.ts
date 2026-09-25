"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { bool, fail, fromZod, ok, str, type ActionResult } from "@/lib/actions";
import { CATEGORY_KEYS } from "@/lib/domain";
import { slugify } from "@/lib/utils";
import { parseVideo } from "@/lib/video";
import { imageSrcProblem, normalizeImageUrl } from "./_lib/image-policy";
import { getImagePolicy } from "./_lib/image-policy.server";

const { films, teamMembers, showcaseClients, faqs } = schema;

/* ============================== Utilidades ============================== */

/** O conteúdo mudou: atualiza o site inteiro e as telas do painel indicadas. */
function revalidateSite(...adminPaths: string[]) {
  revalidatePath("/", "layout");
  for (const p of adminPaths) revalidatePath(p);
}

type Orderable = typeof films | typeof teamMembers | typeof showcaseClients | typeof faqs;

async function nextSortOrder(table: Orderable) {
  const [row] = await db.select({ max: sql<number | null>`max(${table.sortOrder})` }).from(table);
  return row?.max == null ? 0 : Number(row.max) + 1;
}

/** Troca o item de lugar com o vizinho e renumera a lista (0, 1, 2...). */
async function moveRow(table: Orderable, id: string, dir: "up" | "down") {
  const rows = await db.select({ id: table.id }).from(table).orderBy(asc(table.sortOrder), asc(table.createdAt));
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return false;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return true;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  const [head, ...tail] = rows.map((r, n) => db.update(table).set({ sortOrder: n }).where(eq(table.id, r.id)));
  await db.batch([head, ...tail]);
  return true;
}

function readMove(fd: FormData): { id: string; dir: "up" | "down" } | null {
  const id = str(fd, "id");
  const dir = fd.get("dir");
  return id && (dir === "up" || dir === "down") ? { id, dir } : null;
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

/* ============================== Filmes ============================== */

const FORMATS = ["16:9", "9:16"] as const;

const CreditSchema = z.object({
  role: z.string().trim().max(60, "Função muito longa."),
  name: z.string().trim().max(80, "Nome muito longo."),
});

const FilmSchema = z.object({
  title: z.string().min(2, "Digite o título.").max(120, "Título muito longo."),
  slug: z
    .string()
    .min(2, "Digite o endereço.")
    .max(80, "Endereço muito longo.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífen."),
  client: z.string().max(80).optional(),
  category: z.enum(CATEGORY_KEYS, { message: "Escolha a categoria." }),
  year: z.number({ message: "Ano inválido." }).int("Ano inválido.").min(1990, "Ano inválido.").max(2100, "Ano inválido.").optional(),
  duration: z.string().max(20, "Duração muito longa.").optional(),
  format: z.enum(FORMATS, { message: "Escolha o formato." }),
  videoUrl: z.string().max(500).optional(),
  posterUrl: z.string().max(500).optional(),
  previewUrl: z.string().max(500).optional(),
  summary: z.string().max(200, "Resumo muito longo: até 200 caracteres.").optional(),
  intention: z.string().max(3000, "Texto muito longo.").optional(),
  credits: z.array(CreditSchema, { message: "Ficha técnica inválida." }).max(40, "Até 40 linhas na ficha técnica."),
  stills: z.array(z.string().max(500), { message: "Lista de imagens inválida." }).max(24, "Até 24 imagens."),
  featured: z.boolean(),
  published: z.boolean(),
});

function readFilm(fd: FormData) {
  const title = str(fd, "title");
  const yearRaw = str(fd, "year");
  const credits = jsonField(fd, "credits");
  const stills = jsonField(fd, "stills");
  const policy = getImagePolicy();

  return FilmSchema.superRefine((data, ctx) => {
    if (data.videoUrl && !parseVideo(data.videoUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["videoUrl"],
        message: "Não reconheci o link. Use Vimeo, YouTube ou um arquivo de vídeo (.mp4) em /media.",
      });
    }
    if (data.previewUrl && parseVideo(data.previewUrl)?.kind !== "file") {
      ctx.addIssue({
        code: "custom",
        path: ["previewUrl"],
        message: "A prévia precisa ser um arquivo de vídeo (.mp4 ou .webm), não um link do Vimeo ou YouTube.",
      });
    }
    const posterProblem = data.posterUrl ? imageSrcProblem(data.posterUrl, policy) : null;
    if (posterProblem) ctx.addIssue({ code: "custom", path: ["posterUrl"], message: posterProblem });
    data.stills.forEach((src, i) => {
      const problem = imageSrcProblem(src, policy);
      if (problem) ctx.addIssue({ code: "custom", path: ["stills"], message: `Imagem ${i + 1}: ${problem}` });
    });
    if (data.credits.some((c) => !c.role || !c.name)) {
      ctx.addIssue({ code: "custom", path: ["credits"], message: "Preencha a função e o nome em cada linha da ficha técnica." });
    }
  }).safeParse({
    title,
    slug: str(fd, "slug") ?? (title ? slugify(title) : undefined),
    client: str(fd, "client"),
    category: str(fd, "category"),
    year: yearRaw ? Number(yearRaw) : undefined,
    duration: str(fd, "duration"),
    format: str(fd, "format") ?? "16:9",
    videoUrl: str(fd, "videoUrl"),
    posterUrl: str(fd, "posterUrl") ? normalizeImageUrl(str(fd, "posterUrl")!) : undefined,
    previewUrl: str(fd, "previewUrl"),
    summary: str(fd, "summary"),
    intention: str(fd, "intention"),
    // Linhas totalmente vazias são ignoradas; repetidas, unificadas.
    credits: Array.isArray(credits)
      ? dedupe(
          credits
            .map((c) => ({ role: String(c?.role ?? "").trim(), name: String(c?.name ?? "").trim() }))
            .filter((c) => c.role || c.name),
          (c) => `${c.role}::${c.name}`,
        )
      : credits,
    stills: Array.isArray(stills)
      ? dedupe(
          stills.map((s) => normalizeImageUrl(String(s ?? ""))).filter(Boolean),
          (s) => s,
        )
      : stills,
    featured: bool(fd, "featured"),
    published: bool(fd, "published"),
  });
}

function dedupe<T>(list: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function filmValues(data: z.infer<typeof FilmSchema>) {
  return {
    title: data.title,
    slug: data.slug,
    client: data.client ?? null,
    category: data.category,
    year: data.year ?? null,
    duration: data.duration ?? null,
    format: data.format,
    videoUrl: data.videoUrl ?? null,
    posterUrl: data.posterUrl ?? null,
    previewUrl: data.previewUrl ?? null,
    summary: data.summary ?? null,
    intention: data.intention ?? null,
    credits: data.credits.length ? data.credits : null,
    stills: data.stills.length ? data.stills : null,
    featured: data.featured,
    published: data.published,
  };
}

const NO_VIDEO_NOTE = "Ainda sem vídeo: no site aparece “Vídeo em breve”.";

export async function saveFilm(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const parsed = readFilm(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const data = parsed.data;

  const current = id ? await db.query.films.findFirst({ where: eq(films.id, id) }) : null;
  if (id && !current) return fail("Filme não encontrado.");
  // O filme do manifesto é achado pelo endereço na página inicial.
  if (current?.slug === "manifesto" && data.slug !== "manifesto") {
    return fail("O endereço do Manifesto precisa continuar “manifesto”.", { slug: ["Este endereço é fixo."] });
  }
  const clash = await db.query.films.findFirst({
    where: id ? and(eq(films.slug, data.slug), ne(films.id, id)) : eq(films.slug, data.slug),
    columns: { id: true, title: true },
  });
  if (clash) {
    return fail(`O endereço /filmes/${data.slug} já é de “${clash.title}”.`, {
      slug: ["Esse endereço já existe. Escolha outro."],
    });
  }

  const values = filmValues(data);
  const note = data.published && !data.videoUrl ? ` ${NO_VIDEO_NOTE}` : "";
  if (current) {
    await db.update(films).set(values).where(eq(films.id, current.id));
    revalidateSite("/painel/site", `/painel/site/filmes/${current.id}`);
    return ok(`Filme salvo.${note}`, current.id);
  }
  const [row] = await db
    .insert(films)
    .values({ ...values, sortOrder: await nextSortOrder(films) })
    .returning({ id: films.id });
  revalidateSite("/painel/site");
  return ok(`Filme criado.${note}`, row.id);
}

export async function deleteFilm(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Filme não encontrado.");
  await db.delete(films).where(eq(films.id, id));
  revalidateSite("/painel/site");
  if (fd.get("from") === "editor") redirect("/painel/site");
  return ok("Filme excluído.");
}

export async function moveFilm(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const move = readMove(fd);
  if (!move || !(await moveRow(films, move.id, move.dir))) return fail("Filme não encontrado.");
  revalidateSite("/painel/site");
  return ok();
}

export async function toggleFilmPublished(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const film = id ? await db.query.films.findFirst({ where: eq(films.id, id) }) : null;
  if (!film) return fail("Filme não encontrado.");
  await db.update(films).set({ published: !film.published }).where(eq(films.id, film.id));
  revalidateSite("/painel/site", `/painel/site/filmes/${film.id}`);
  if (film.published) return ok("Filme tirado do site.");
  return ok(film.videoUrl ? "Filme publicado." : `Filme publicado. ${NO_VIDEO_NOTE}`);
}

export async function toggleFilmFeatured(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const film = id ? await db.query.films.findFirst({ where: eq(films.id, id) }) : null;
  if (!film) return fail("Filme não encontrado.");
  await db.update(films).set({ featured: !film.featured }).where(eq(films.id, film.id));
  revalidateSite("/painel/site", `/painel/site/filmes/${film.id}`);
  return ok(film.featured ? "Destaque removido." : "Filme em destaque.");
}

/* ============================== Equipe ============================== */

const TeamSchema = z.object({
  name: z.string().min(2, "Digite o nome.").max(80),
  role: z.string().min(2, "Digite a função.").max(80),
  quote: z.string().max(220, "Frase muito longa: até 220 caracteres.").optional(),
  photoUrl: z.string().max(500).optional(),
  instagram: z.string().max(60).optional(),
  published: z.boolean(),
});

function readTeam(fd: FormData) {
  const policy = getImagePolicy();
  const photo = str(fd, "photoUrl");
  return TeamSchema.superRefine((data, ctx) => {
    const problem = data.photoUrl ? imageSrcProblem(data.photoUrl, policy) : null;
    if (problem) ctx.addIssue({ code: "custom", path: ["photoUrl"], message: problem });
  }).safeParse({
    name: str(fd, "name"),
    role: str(fd, "role"),
    quote: str(fd, "quote")?.replace(/^[“"]+|[”"]+$/g, ""),
    photoUrl: photo ? normalizeImageUrl(photo) : undefined,
    instagram: str(fd, "instagram")
      ?.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "") || undefined,
    published: bool(fd, "published"),
  });
}

function teamValues(data: z.infer<typeof TeamSchema>) {
  return {
    name: data.name,
    role: data.role,
    quote: data.quote ?? null,
    photoUrl: data.photoUrl ?? null,
    instagram: data.instagram ?? null,
    published: data.published,
  };
}

export async function createTeamMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readTeam(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const [row] = await db
    .insert(teamMembers)
    .values({ ...teamValues(parsed.data), sortOrder: await nextSortOrder(teamMembers) })
    .returning({ id: teamMembers.id });
  revalidateSite("/painel/site/equipe");
  return ok("Pessoa adicionada.", row.id);
}

export async function updateTeamMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Pessoa não encontrada.");
  const parsed = readTeam(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db.update(teamMembers).set(teamValues(parsed.data)).where(eq(teamMembers.id, id));
  revalidateSite("/painel/site/equipe");
  return ok("Dados salvos.");
}

export async function deleteTeamMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Pessoa não encontrada.");
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
  revalidateSite("/painel/site/equipe");
  return ok("Pessoa removida do site.");
}

export async function moveTeamMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const move = readMove(fd);
  if (!move || !(await moveRow(teamMembers, move.id, move.dir))) return fail("Pessoa não encontrada.");
  revalidateSite("/painel/site/equipe");
  return ok();
}

export async function toggleTeamPublished(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const row = id ? await db.query.teamMembers.findFirst({ where: eq(teamMembers.id, id) }) : null;
  if (!row) return fail("Pessoa não encontrada.");
  await db.update(teamMembers).set({ published: !row.published }).where(eq(teamMembers.id, row.id));
  revalidateSite("/painel/site/equipe");
  return ok(row.published ? "Tirado do site." : "Publicado no site.");
}

/* ============================== Clientes no site ============================== */

const ShowcaseSchema = z.object({
  name: z.string().min(1, "Digite o nome.").max(60, "Nome muito longo."),
  published: z.boolean(),
});

function readShowcase(fd: FormData) {
  return ShowcaseSchema.safeParse({ name: str(fd, "name"), published: bool(fd, "published") });
}

export async function createShowcaseClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readShowcase(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db.insert(showcaseClients).values({ ...parsed.data, sortOrder: await nextSortOrder(showcaseClients) });
  revalidateSite("/painel/site/clientes");
  return ok("Cliente adicionado.");
}

export async function updateShowcaseClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Cliente não encontrado.");
  const parsed = readShowcase(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db.update(showcaseClients).set(parsed.data).where(eq(showcaseClients.id, id));
  revalidateSite("/painel/site/clientes");
  return ok("Cliente salvo.");
}

export async function deleteShowcaseClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Cliente não encontrado.");
  await db.delete(showcaseClients).where(eq(showcaseClients.id, id));
  revalidateSite("/painel/site/clientes");
  return ok("Cliente removido do site.");
}

export async function moveShowcaseClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const move = readMove(fd);
  if (!move || !(await moveRow(showcaseClients, move.id, move.dir))) return fail("Cliente não encontrado.");
  revalidateSite("/painel/site/clientes");
  return ok();
}

export async function toggleShowcasePublished(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const row = id ? await db.query.showcaseClients.findFirst({ where: eq(showcaseClients.id, id) }) : null;
  if (!row) return fail("Cliente não encontrado.");
  await db.update(showcaseClients).set({ published: !row.published }).where(eq(showcaseClients.id, row.id));
  revalidateSite("/painel/site/clientes");
  return ok(row.published ? "Tirado do site." : "Publicado no site.");
}

/* ============================== Perguntas frequentes ============================== */

const FaqSchema = z.object({
  question: z.string().min(5, "Digite a pergunta.").max(200, "Pergunta muito longa."),
  answer: z.string().min(5, "Digite a resposta.").max(2000, "Resposta muito longa."),
  published: z.boolean(),
});

function readFaq(fd: FormData) {
  return FaqSchema.safeParse({
    question: str(fd, "question"),
    answer: str(fd, "answer"),
    published: bool(fd, "published"),
  });
}

export async function createFaq(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = readFaq(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db.insert(faqs).values({ ...parsed.data, sortOrder: await nextSortOrder(faqs) });
  revalidateSite("/painel/site/perguntas");
  return ok("Pergunta adicionada.");
}

export async function updateFaq(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Pergunta não encontrada.");
  const parsed = readFaq(fd);
  if (!parsed.success) return fromZod(parsed.error);
  await db.update(faqs).set(parsed.data).where(eq(faqs.id, id));
  revalidateSite("/painel/site/perguntas");
  return ok("Pergunta salva.");
}

export async function deleteFaq(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Pergunta não encontrada.");
  await db.delete(faqs).where(eq(faqs.id, id));
  revalidateSite("/painel/site/perguntas");
  return ok("Pergunta excluída.");
}

export async function moveFaq(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const move = readMove(fd);
  if (!move || !(await moveRow(faqs, move.id, move.dir))) return fail("Pergunta não encontrada.");
  revalidateSite("/painel/site/perguntas");
  return ok();
}

export async function toggleFaqPublished(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const row = id ? await db.query.faqs.findFirst({ where: eq(faqs.id, id) }) : null;
  if (!row) return fail("Pergunta não encontrada.");
  await db.update(faqs).set({ published: !row.published }).where(eq(faqs.id, row.id));
  revalidateSite("/painel/site/perguntas");
  return ok(row.published ? "Pergunta tirada do site." : "Pergunta publicada.");
}
