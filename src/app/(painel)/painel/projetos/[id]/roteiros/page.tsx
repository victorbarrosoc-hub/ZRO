import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";

/** Roteiros e shot lists ficam listados na aba Documentos do projeto. */
export default async function ScriptsIndex({ params }: PageProps<"/painel/projetos/[id]/roteiros">) {
  await requireUser();
  const { id } = await params;
  redirect(`/painel/projetos/${id}?aba=documentos`);
}
