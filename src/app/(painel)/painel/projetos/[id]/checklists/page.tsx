import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";

/** Os checklists ficam listados na aba Documentos do projeto. */
export default async function ChecklistsIndex({ params }: PageProps<"/painel/projetos/[id]/checklists">) {
  await requireUser();
  const { id } = await params;
  redirect(`/painel/projetos/${id}?aba=documentos`);
}
