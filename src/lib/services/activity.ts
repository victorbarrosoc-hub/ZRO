import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Tipos do histórico automático (os manuais ficam em crm-options). */
export type AutoActivityType = "projeto" | "agenda" | "financeiro" | "arquivos";

/**
 * Histórico automático: o que acontece num projeto aparece também na ficha do cliente (CRM).
 * Tipos: "projeto", "agenda", "financeiro" e "arquivos" (o que chegou pelo Drive).
 */
export async function logProjectActivity(
  projectId: string | null | undefined,
  type: AutoActivityType,
  content: string,
  authorId?: string | null,
) {
  if (!projectId) return;
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { id: true, clientId: true },
  });
  if (!project) return;
  await db.insert(schema.activities).values({
    projectId: project.id,
    clientId: project.clientId,
    type,
    content,
    authorId: authorId ?? null,
  });
  return project.clientId;
}

/** Histórico só do cliente (ex.: arquivos que ele mandou sem escolher projeto). */
export async function logClientActivity(
  clientId: string | null | undefined,
  type: AutoActivityType,
  content: string,
  authorId?: string | null,
) {
  if (!clientId) return;
  const client = await db.query.clients.findFirst({ where: eq(schema.clients.id, clientId), columns: { id: true } });
  if (!client) return;
  await db.insert(schema.activities).values({ clientId: client.id, type, content, authorId: authorId ?? null });
  return client.id;
}
