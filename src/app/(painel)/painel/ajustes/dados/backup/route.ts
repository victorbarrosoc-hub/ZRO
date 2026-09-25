import { getSessionUser } from "@/lib/auth/dal";
import { todayISO } from "@/lib/format";
import { exportAll } from "@/lib/queries/backup";

/** Backup completo em .json: CRM, orçamentos, projetos, financeiro e o resto. */
export async function GET() {
  if (!(await getSessionUser())) return new Response("Não autorizado.", { status: 401 });

  const backup = await exportAll();
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="zro-backup-${todayISO()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
