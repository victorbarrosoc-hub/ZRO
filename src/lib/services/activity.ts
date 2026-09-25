import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Histórico automático: o que acontece num projeto aparece também na ficha do cliente (CRM).
 * Tipos: "projeto", "agenda" e "financeiro" (os manuais ficam em crm-options).
 */
export async function logProjectActivity(
  projectId: string | null | undefined,
  type: "projeto" | "agenda" | "financeiro",
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
