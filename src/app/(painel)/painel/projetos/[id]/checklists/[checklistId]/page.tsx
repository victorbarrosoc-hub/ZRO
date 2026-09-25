import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { dateLong, relativeDay, todayISO } from "@/lib/format";
import { getChecklist, listKits } from "@/lib/queries/documents";
import { capitalize, weekdayLong } from "@/app/(painel)/painel/agenda/agenda-utils";
import { DeleteDocButton } from "../../_tabs/documentos-client";
import { DocHeader } from "../../_tabs/documentos-ui";
import { deleteChecklist } from "../actions";
import { ChecklistEditor, EditChecklistButton } from "../checklist-editor";

export async function generateMetadata({ params }: PageProps<"/painel/projetos/[id]/checklists/[checklistId]">): Promise<Metadata> {
  await requireUser();
  const { id, checklistId } = await params;
  const data = await getChecklist(id, checklistId);
  return { title: data ? `Checklist · ${data.checklist.title}` : "Checklist" };
}

export default async function ChecklistPage({ params }: PageProps<"/painel/projetos/[id]/checklists/[checklistId]">) {
  await requireUser();
  const { id, checklistId } = await params;
  const [data, kits] = await Promise.all([getChecklist(id, checklistId), listKits()]);
  if (!data) notFound();
  const { project, checklist } = data;
  const today = todayISO();

  return (
    <div className="grid grid-cols-1 gap-8">
      <DocHeader
        project={project}
        kind="Checklist de equipamento"
        title={checklist.title}
        meta={
          checklist.date
            ? `${capitalize(weekdayLong(checklist.date))}, ${dateLong(checklist.date)} · ${relativeDay(checklist.date, today)}`
            : "Sem data"
        }
        actions={
          <>
            <EditChecklistButton checklistId={checklist.id} projectId={project.id} title={checklist.title} date={checklist.date} />
            <DeleteDocButton
              action={deleteChecklist}
              fields={{ id: checklist.id, projectId: project.id }}
              title="Excluir este checklist?"
              description="A lista e a conferência de saída e retorno são apagadas."
            />
          </>
        }
      />
      <ChecklistEditor
        checklistId={checklist.id}
        projectId={project.id}
        items={checklist.items}
        date={checklist.date}
        today={today}
        kits={kits.map((k) => ({ id: k.id, name: k.name, items: k.items }))}
      />
    </div>
  );
}
