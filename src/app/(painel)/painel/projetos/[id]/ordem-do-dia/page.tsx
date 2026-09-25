import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";

/** As ordens do dia ficam listadas na aba Documentos do projeto. */
export default async function CallSheetsIndex({ params }: PageProps<"/painel/projetos/[id]/ordem-do-dia">) {
  await requireUser();
  const { id } = await params;
  redirect(`/painel/projetos/${id}?aba=documentos`);
}
