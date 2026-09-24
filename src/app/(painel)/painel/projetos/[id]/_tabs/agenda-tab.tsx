/**
 * Aba "Agenda" do projeto. Implementada pelo módulo Agenda.
 * Contrato: componente de servidor que recebe o id do projeto.
 */
import { CalendarDays } from "lucide-react";
import { AgendaProvider, NewEventButton } from "@/app/(painel)/painel/agenda/agenda-dialogs";
import { eachDay, eventEnd } from "@/app/(painel)/painel/agenda/agenda-utils";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { addDaysISO, todayISO } from "@/lib/format";
import { getAgendaOptions, listBookings, listProjectEvents } from "@/lib/queries/agenda";
import { ProjectEventList } from "./agenda-list";

export async function ProjectAgendaTab({ projectId }: { projectId: string }) {
  const today = todayISO();
  const [events, options, bookings] = await Promise.all([
    listProjectEvents(projectId),
    getAgendaOptions(),
    listBookings(addDaysISO(today, -30)),
  ]);

  const upcoming = events.filter((e) => eventEnd(e) >= today);
  const past = events.filter((e) => eventEnd(e) < today).reverse();
  const diariasDone = past.filter((e) => e.type === "diaria").reduce((n, e) => n + eachDay(e.date, eventEnd(e)).length, 0);
  const diariasAhead = upcoming.filter((e) => e.type === "diaria").reduce((n, e) => n + eachDay(e.date, eventEnd(e)).length, 0);
  const conflicts = upcoming.filter((e) => e.conflicts.length).length;

  const summary = events.length
    ? [
        diariasAhead ? `${diariasAhead} diária${diariasAhead > 1 ? "s" : ""} pela frente` : "Nenhuma diária pela frente",
        diariasDone ? `${diariasDone} já feita${diariasDone > 1 ? "s" : ""}` : null,
        conflicts ? `${conflicts} com conflito de equipe` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Diárias, entregas e reuniões deste projeto.";

  return (
    <AgendaProvider events={events} options={options} bookings={bookings} showAgendaLink>
      <Card>
        <CardHeader
          title="Agenda do projeto"
          description={summary}
          action={
            <>
              <ButtonLink href={`/painel/agenda?projeto=${projectId}`} variant="ghost" size="sm" className="hidden sm:inline-flex">
                <CalendarDays /> Ver no calendário
              </ButtonLink>
              <NewEventButton defaults={{ projectId, type: "diaria" }} label="Nova diária" size="sm" />
            </>
          }
        />

        {upcoming.length ? (
          <div className="mt-3">
            <ProjectEventList events={upcoming} today={today} />
          </div>
        ) : (
          <EmptyState
            title={past.length ? "Nada marcado daqui pra frente" : "Nenhum evento ainda"}
            description="Marque as diárias, entregas e reuniões. Quem estiver escalado em dois lugares no mesmo dia aparece com aviso."
          />
        )}

        {past.length ? (
          <div className="border-t border-line pt-4">
            <p className="label px-5 pb-1 text-mute sm:px-6">Já aconteceu · {past.length}</p>
            <ProjectEventList events={past} today={today} past />
          </div>
        ) : null}
      </Card>
    </AgendaProvider>
  );
}
