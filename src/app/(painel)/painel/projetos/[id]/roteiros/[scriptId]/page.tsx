import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getScript } from "@/lib/queries/documents";
import { DeleteDocButton } from "../../_tabs/documentos-client";
import { DocHeader } from "../../_tabs/documentos-ui";
import { deleteScript } from "../actions";
import { ScriptTextEditor, ShotListEditor } from "../script-editor";
import { isShotKind, scriptKindLabel, SCRIPT_KINDS } from "../script-kinds";

export async function generateMetadata({ params }: PageProps<"/painel/projetos/[id]/roteiros/[scriptId]">): Promise<Metadata> {
  await requireUser();
  const { id, scriptId } = await params;
  const data = await getScript(id, scriptId);
  return { title: data ? `${scriptKindLabel(data.script.kind)} · ${data.script.title}` : "Roteiro" };
}

export default async function ScriptPage({ params }: PageProps<"/painel/projetos/[id]/roteiros/[scriptId]">) {
  await requireUser();
  const { id, scriptId } = await params;
  const data = await getScript(id, scriptId);
  if (!data) notFound();
  const { project, script } = data;
  const kind = SCRIPT_KINDS.find((k) => k.key === script.kind);

  return (
    <div className="grid grid-cols-1 gap-8">
      <DocHeader
        project={project}
        kind={scriptKindLabel(script.kind)}
        title={script.title}
        meta={kind?.hint}
        actions={
          <>
            <ButtonLink href={`/painel/projetos/${project.id}/roteiros/${script.id}/imprimir`} variant="secondary" size="sm">
              <Printer /> Imprimir
            </ButtonLink>
            <DeleteDocButton
              action={deleteScript}
              fields={{ id: script.id, projectId: project.id }}
              title={`Excluir ${scriptKindLabel(script.kind).toLowerCase()}?`}
              description="O documento some do projeto e não dá para desfazer."
            />
          </>
        }
      />
      {isShotKind(script.kind) ? (
        <ShotListEditor scriptId={script.id} projectId={project.id} title={script.title} shots={script.shots} />
      ) : (
        <ScriptTextEditor scriptId={script.id} projectId={project.id} title={script.title} content={script.content ?? ""} />
      )}
    </div>
  );
}
