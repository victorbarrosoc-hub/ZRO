import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { dateLong } from "@/lib/format";
import { getCallSheetEditor } from "@/lib/queries/documents";
import { capitalize, weekdayLong } from "@/app/(painel)/painel/agenda/agenda-utils";
import { DeleteDocButton } from "../../_tabs/documentos-client";
import { DocHeader } from "../../_tabs/documentos-ui";
import { deleteCallSheet } from "../actions";
import { CallSheetEditor } from "../call-sheet-editor";

export async function generateMetadata({ params }: PageProps<"/painel/projetos/[id]/ordem-do-dia/[sheetId]">): Promise<Metadata> {
  await requireUser();
  const { id, sheetId } = await params;
  const data = await getCallSheetEditor(id, sheetId);
  return { title: data ? `Ordem do dia · ${data.sheet.title}` : "Ordem do dia" };
}

export default async function CallSheetPage({ params }: PageProps<"/painel/projetos/[id]/ordem-do-dia/[sheetId]">) {
  await requireUser();
  const { id, sheetId } = await params;
  const data = await getCallSheetEditor(id, sheetId);
  if (!data) notFound();
  const { project, sheet } = data;

  return (
    <div className="grid grid-cols-1 gap-8">
      <DocHeader
        project={project}
        kind="Ordem do dia"
        title={sheet.title}
        meta={`${capitalize(weekdayLong(sheet.date))}, ${dateLong(sheet.date)}${sheet.callTime ? ` · chegada ${sheet.callTime}` : ""}`}
        actions={
          <DeleteDocButton
            action={deleteCallSheet}
            fields={{ id: sheet.id, projectId: project.id }}
            title="Excluir esta ordem do dia?"
            description="Ela some da aba Documentos. A diária na agenda continua."
          />
        }
      />
      <CallSheetEditor
        projectId={project.id}
        project={{
          code: project.code,
          title: project.title,
          clientName: project.clientName,
          clientContact: project.clientContact,
          clientPhone: project.clientPhone,
        }}
        sheet={{
          id: sheet.id,
          title: sheet.title,
          date: sheet.date,
          callTime: sheet.callTime,
          location: sheet.location,
          locationUrl: sheet.locationUrl,
          eventId: sheet.eventId,
          notes: sheet.notes,
          schedule: sheet.schedule,
          crew: sheet.crew,
          contacts: sheet.contacts,
        }}
        events={data.events}
        crewByEvent={data.crewByEvent}
        projectCrew={data.projectCrew}
        printHref={`/painel/projetos/${project.id}/ordem-do-dia/${sheet.id}/imprimir`}
      />
    </div>
  );
}
