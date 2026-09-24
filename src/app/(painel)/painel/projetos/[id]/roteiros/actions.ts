"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { fail, fromZod, ok, str, type ActionResult } from "@/lib/actions";
import { SCRIPT_KIND_KEYS, isShotKind, scriptKindLabel } from "./script-kinds";

const { scripts, projects } = schema;

const ShotSchema = z.object({
  scene: z.string().max(20, "Cena: use até 20 caracteres."),
  shot: z.string().max(60, "Plano: use até 60 caracteres."),
  description: z.string().max(600, "Descrição do plano longa demais."),
  lens: z.string().max(40, "Lente: use até 40 caracteres.").optional(),
  movement: z.string().max(80, "Movimento: use até 80 caracteres.").optional(),
  done: z.boolean().optional(),
});

const ScriptSchema = z.object({
  title: z.string({ message: "Dê um título ao documento." }).min(2, "Dê um título ao documento.").max(120, "Título longo demais."),
  content: z.string().max(200_000, "Texto longo demais para um documento só.").optional(),
  shots: z.array(ShotSchema).max(500, "Planos demais para um documento só."),
});

function readShots(raw: string | undefined) {
  if (!raw) return [];
  const list: unknown = JSON.parse(raw);
  if (!Array.isArray(list)) return [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return list
    .map((r) => {
      const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      return {
        scene: text(o.scene),
        shot: text(o.shot),
        description: text(o.description),
        lens: text(o.lens) || undefined,
        movement: text(o.movement) || undefined,
        done: o.done === true ? true : undefined,
      };
    })
    .filter((s) => s.scene || s.shot || s.description || s.lens || s.movement);
}

function revalidateScript(projectId: string, scriptId?: string) {
  revalidatePath(`/painel/projetos/${projectId}`);
  if (scriptId) {
    revalidatePath(`/painel/projetos/${projectId}/roteiros/${scriptId}`);
    revalidatePath(`/painel/projetos/${projectId}/roteiros/${scriptId}/imprimir`);
  }
}

/** Cria um roteiro, decupagem ou shot list e abre o editor. */
export async function newScript(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const projectId = str(fd, "projectId");
  const kind = z.enum(SCRIPT_KIND_KEYS).safeParse(str(fd, "kind"));
  if (!projectId) return fail("Projeto não encontrado.");
  if (!kind.success) return fail("Escolha o tipo de documento.");
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return fail("Projeto não encontrado.");

  const [row] = await db
    .insert(scripts)
    .values({ projectId, kind: kind.data, title: scriptKindLabel(kind.data), content: isShotKind(kind.data) ? null : "", shots: [] })
    .returning({ id: scripts.id });

  revalidateScript(projectId);
  redirect(`/painel/projetos/${projectId}/roteiros/${row.id}`);
}

/** Salva o documento inteiro (o editor manda tudo de uma vez). */
export async function saveScript(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const projectId = str(fd, "projectId");
  if (!id || !projectId) return fail("Documento não encontrado.");
  const [current] = await db
    .select({ id: scripts.id, kind: scripts.kind })
    .from(scripts)
    .where(and(eq(scripts.id, id), eq(scripts.projectId, projectId)))
    .limit(1);
  if (!current) return fail("Esse documento não existe mais.");

  let shots: ReturnType<typeof readShots> = [];
  try {
    shots = isShotKind(current.kind) ? readShots(str(fd, "shots")) : [];
  } catch {
    return fail("Não foi possível ler a lista de planos. Recarregue a página.");
  }
  const rawContent = fd.get("content");
  const parsed = ScriptSchema.safeParse({
    title: str(fd, "title"),
    content: typeof rawContent === "string" ? rawContent.replace(/\r\n/g, "\n") : undefined,
    shots,
  });
  if (!parsed.success) return fromZod(parsed.error);

  await db
    .update(scripts)
    .set(
      isShotKind(current.kind)
        ? { title: parsed.data.title, shots: parsed.data.shots }
        : { title: parsed.data.title, content: parsed.data.content ?? "" },
    )
    .where(eq(scripts.id, id));

  revalidateScript(projectId, id);
  return ok("Salvo.");
}

export async function deleteScript(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = str(fd, "id");
  const projectId = str(fd, "projectId");
  if (!id || !projectId) return fail("Documento não encontrado.");
  await db.delete(scripts).where(and(eq(scripts.id, id), eq(scripts.projectId, projectId)));
  revalidateScript(projectId);
  redirect(`/painel/projetos/${projectId}?aba=documentos`);
}
