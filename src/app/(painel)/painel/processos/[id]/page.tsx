import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { Badge, Card } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { categoryLabel } from "@/lib/domain";
import { listTemplates } from "@/lib/queries/admin-content";
import { DeleteTemplateButton, DuplicateTemplateButton } from "../processos-dialogs";
import { TemplateEditor } from "../template-editor";

export async function generateMetadata({ params }: PageProps<"/painel/processos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = (await listTemplates()).find((x) => x.id === id);
  return { title: t ? `${t.name} · Modelos` : "Modelo de projeto" };
}

export default async function TemplatePage({ params, searchParams }: PageProps<"/painel/processos/[id]">) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const all = await listTemplates();
  const index = all.findIndex((t) => t.id === id);
  if (index < 0) notFound();
  const template = all[index];
  const otherCategories = all
    .filter((t) => t.id !== id && t.category)
    .map((t) => ({ category: t.category!, name: t.name, older: all.indexOf(t) < index }))
    // Se houver mais de um, o que importa é o mais antigo.
    .sort((a, b) => Number(b.older) - Number(a.older));

  return (
    <div className="grid gap-8">
      <Link href="/painel/processos" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Modelos de projeto
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="label mb-3 text-mute">Modelo de projeto</p>
          <h1 className="text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
            {template.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{template.category ? categoryLabel(template.category) : "Sem categoria"}</Badge>
            <Badge>
              {template.total} tarefa{template.total === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DuplicateTemplateButton id={template.id} />
          <DeleteTemplateButton id={template.id} name={template.name} />
        </div>
      </header>

      {sp.copia === "1" ? (
        <Card className="flex items-start gap-3 p-5">
          <Copy className="mt-0.5 size-4 shrink-0 text-ash" aria-hidden />
          <p className="text-[14px] text-ash">
            Cópia criada. Dê um nome e escolha a categoria: ela nasce sem categoria para não disputar com o original.
          </p>
        </Card>
      ) : null}

      <TemplateEditor
        otherCategories={otherCategories}
        initial={{
          id: template.id,
          name: template.name,
          category: template.category ?? "",
          description: template.description ?? "",
          tasks: template.tasks,
        }}
      />
    </div>
  );
}
