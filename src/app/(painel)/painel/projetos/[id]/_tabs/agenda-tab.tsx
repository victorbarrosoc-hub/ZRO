/**
 * Aba "Agenda" do projeto: diárias, entregas e reuniões, com a equipe escalada e o custo de cada diária.
 * Escalar alguém numa diária já coloca a pessoa na equipe e o pagamento no financeiro (services/team).
 */
import { CalendarDays } from "lucide-react";
import { AgendaProvider, NewEventButton } from "@/app/(painel)/painel/agenda/agenda-dialogs";
import { eventEnd } from "@/app/(painel)/painel/agenda/agenda-utils";
import { StatTile } from "@/components/painel/stat";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { addDaysISO, brl, dateBR, todayISO } from "@/lib/format";
import { getAgendaOptions, listBookings, listProjectEvents } from "@/lib/queries/agenda";
import type { ProjectDetail, ProjectSummary } from "@/lib/queries/projects";
import { NewEntryButton } from "../_components/finance-dialogs";
import { ProjectEventList } from "./agenda-list";

export async function ProjectAgendaTab({ project, summary }: { project: ProjectDetail; summary: ProjectSummary }) {
  const today = todayISO();
  const user = await requireUser();
  const [events, options, bookings] = await Promise.all([
    listProjectEvents(project.id),
    getAgendaOptions(user.id),
    listBookings(addDaysISO(today, -30)),
  ]);

  const upcoming = events.filter((e) => eventEnd(e) >= today);
  const past = events.filter((e) => eventEnd(e) < today).reverse();
  const costs = Object.fromEntries(summary.diarias.map((d) => [d.id, d]));
  const days = project.diarias.reduce((n, d) => n + d.days, 0);
  const daysAhead = project.diarias.filter((d) => (d.endDate ?? d.date) >= today).reduce((n, d) => n + d.days, 0);
  const total = summary.diarias.reduce((n, d) => n + d.total, 0);
  const diarias = project.diarias.map((d) => ({ id: d.id, date: d.date, label: `${dateBR(d.date)} · ${d.title}` }));

  return (
    <AgendaProvider events={events} options={options} bookings={bookings} showAgendaLink>
      <div className="grid grid-cols-1 gap-4">
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Diárias">
          <StatTile label="Diárias" value={days} sub={daysAhead ? `${daysAhead} pela frente` : undefined} />
          <StatTile label="Custo das diárias" value={brl(total)} />
          <StatTile className="col-span-2 sm:col-span-1" label="Por diária" value={days ? brl(Math.round(total / days)) : "—"} />
        </section>

        <Card>
          <CardHeader
            title="Agenda do projeto"
            action={
              <>
                <ButtonLink href={`/painel/agenda?projeto=${project.id}`} variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <CalendarDays /> Calendário
                </ButtonLink>
                {diarias.length ? <NewEntryButton projectId={project.id} diarias={diarias} eventId={diarias[0].id} label="Custo" compact /> : null}
                <NewEventButton defaults={{ projectId: project.id, type: "diaria" }} label="Nova diária" size="sm" />
              </>
            }
          />

          {upcoming.length ? (
            <div className="mt-3">
              <ProjectEventList events={upcoming} today={today} costs={costs} />
            </div>
          ) : (
            <EmptyState title={past.length ? "Nada marcado daqui pra frente" : "Nenhuma diária ainda"} />
          )}

          {past.length ? (
            <div className="border-t border-line pt-4">
              <p className="label px-5 pb-1 text-mute sm:px-6">Já aconteceu · {past.length}</p>
              <ProjectEventList events={past} today={today} costs={costs} past />
            </div>
          ) : null}
        </Card>
      </div>
    </AgendaProvider>
  );
}
