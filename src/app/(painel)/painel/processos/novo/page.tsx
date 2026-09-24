import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { CATEGORY_KEYS } from "@/lib/domain";
import { listTemplates } from "@/lib/queries/admin-content";
import { TemplateEditor } from "../template-editor";

export const metadata: Metadata = { title: "Novo modelo de projeto" };

export default async function NewTemplatePage({ searchParams }: PageProps<"/painel/processos/novo">) {
  await requireUser();
  const sp = await searchParams;
  const categoria =
    typeof sp.categoria === "string" && (CATEGORY_KEYS as string[]).includes(sp.categoria) ? sp.categoria : "";
  const all = await listTemplates();

  return (
    <div className="grid gap-8">
      <Link href="/painel/processos" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Modelos de projeto
      </Link>
      <PageHeader
        label="Processos"
        title="Novo modelo"
        description="Monte as tarefas padrão de cada etapa. Dá para ajustar depois, projeto a projeto."
      />
      <TemplateEditor
        otherCategories={all
          .filter((t) => t.category)
          .map((t) => ({ category: t.category!, name: t.name, older: true }))}
        initial={{ name: "", category: categoria, description: "", tasks: [] }}
      />
    </div>
  );
}
