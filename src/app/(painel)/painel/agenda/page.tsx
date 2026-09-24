import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { EVENT_TYPES } from "@/lib/domain";
import { addDaysISO, monthLong, todayISO } from "@/lib/format";
import { getAgendaOptions, getEventDate, listBookings, listEventsInRange } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";
import { AgendaProvider, NewEventButton } from "./agenda-dialogs";
import { FilterSelect } from "./agenda-filters";
import { AgendaLegend, MobileAgenda, MonthGrid } from "./agenda-month";
import { eachDay, eventEnd, isMonthParam, monthGrid, monthTitle, shiftMonth } from "./agenda-utils";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/painel/agenda">) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = todayISO();

  const eventoId = one("evento");
  let month = isMonthParam(one("mes")) ? one("mes")! : undefined;
  if (!month && eventoId) month = (await getEventDate(eventoId))?.slice(0, 7);
  month ??= today.slice(0, 7);

  const tipo = EVENT_TYPES.some((t) => t.key === one("tipo")) ? one("tipo") : undefined;
  const projeto = one("projeto");
  const freela = one("freela");

  const grid = monthGrid(month);
  const bookingsFrom = addDaysISO(grid.start < today ? grid.start : today, -7);
  const [events, options, bookings] = await Promise.all([
    listEventsInRange({ start: grid.start, end: grid.end, type: tipo, projectId: projeto, freelancerId: freela }),
    getAgendaOptions(),
    listBookings(bookingsFrom),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { mes: month, tipo, projeto, freela, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/agenda${s ? `?${s}` : ""}`;
  };

  // Resumo do mês: diárias contam por dia; os outros tipos, por evento.
  const inMonth = events.filter((ev) => ev.date <= grid.last && eventEnd(ev) >= grid.first);
  const count = { diaria: 0, entrega: 0, reuniao: 0, outro: 0 } as Record<string, number>;
  for (const ev of inMonth) {
    if (ev.type === "diaria") {
      const from = ev.date < grid.first ? grid.first : ev.date;
      const to = eventEnd(ev) > grid.last ? grid.last : eventEnd(ev);
      count.diaria += eachDay(from, to).length;
    } else count[ev.type] = (count[ev.type] ?? 0) + 1;
  }
  const conflicts = inMonth.filter((ev) => ev.conflicts.length).length;
  const parts = [
    count.diaria ? `${count.diaria} diária${count.diaria > 1 ? "s" : ""}` : null,
    count.entrega ? `${count.entrega} entrega${count.entrega > 1 ? "s" : ""}` : null,
    count.reuniao ? `${count.reuniao} ${count.reuniao > 1 ? "reuniões" : "reunião"}` : null,
    count.outro ? `${count.outro} outro${count.outro > 1 ? "s" : ""}` : null,
  ].filter(Boolean) as string[];
  const monthName = monthLong(month).split(" ")[0];
  const filtered = !!(tipo || projeto || freela);
  const summary = parts.length
    ? `${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0]} em ${monthName}${filtered ? " (com filtro)" : ""}`
    : filtered
      ? `Nada em ${monthName} com esse filtro.`
      : `Nada marcado em ${monthName} ainda.`;

  const isCurrentMonth = month === today.slice(0, 7);

  return (
    <AgendaProvider
      events={events}
      options={options}
      bookings={bookings}
      initialEventId={eventoId && events.some((e) => e.id === eventoId) ? eventoId : undefined}
    >
      <div className="grid grid-cols-1 gap-6">
        <PageHeader
          label="Agenda de produções"
          title={monthTitle(month)}
          description={
            <>
              {summary}
              {conflicts ? (
                <span className="text-warn">
                  {" "}
                  · {conflicts} com conflito de equipe
                </span>
              ) : null}
            </>
          }
          actions={<NewEventButton defaults={projeto ? { projectId: projeto } : undefined} />}
        />

        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5" aria-label="Mês">
            <ButtonLink href={qs({ mes: shiftMonth(month, -1) })} variant="secondary" size="icon" aria-label="Mês anterior" scroll={false}>
              <ChevronLeft />
            </ButtonLink>
            <ButtonLink href={qs({ mes: shiftMonth(month, 1) })} variant="secondary" size="icon" aria-label="Próximo mês" scroll={false}>
              <ChevronRight />
            </ButtonLink>
            <ButtonLink
              href={qs({ mes: undefined })}
              variant={isCurrentMonth ? "ghost" : "secondary"}
              className="h-10"
              scroll={false}
              aria-current={isCurrentMonth ? "date" : undefined}
            >
              Hoje
            </ButtonLink>
          </nav>

          <div className="-mx-4 flex w-[calc(100%+32px)] gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0 lg:ml-3">
            <TypeChip href={qs({ tipo: undefined })} active={!tipo}>
              Todos
            </TypeChip>
            {EVENT_TYPES.map((t) => (
              <TypeChip key={t.key} href={qs({ tipo: t.key })} active={tipo === t.key}>
                {t.label}
              </TypeChip>
            ))}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto">
            <FilterSelect
              param="projeto"
              value={projeto}
              label="Filtrar por projeto"
              allLabel="Todos os projetos"
              options={options.projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.title}` }))}
              className="min-w-0 lg:w-60"
            />
            <FilterSelect
              param="freela"
              value={freela}
              label="Filtrar por freela"
              allLabel="Toda a equipe"
              options={options.freelancers.map((f) => ({ value: f.id, label: f.active ? f.name : `${f.name} (arquivado)` }))}
              className="min-w-0 lg:w-52"
            />
          </div>
        </div>

        <div className="hidden md:block">
          <MonthGrid weeks={grid.weeks} month={month} today={today} events={events} />
        </div>
        <div className="md:hidden">
          <MobileAgenda weeks={grid.weeks} month={month} today={today} events={events} />
        </div>

        {!inMonth.length ? (
          <Card className="md:hidden">
            <EmptyState
              title={filtered ? "Nada com esse filtro" : `Nada marcado em ${monthName}`}
              description={filtered ? "Tire um filtro ou mude o mês." : "Toque num dia do calendário ou em “Novo evento”."}
            />
          </Card>
        ) : null}

        <div className="hidden md:block">
          <AgendaLegend showConflict={conflicts > 0} />
        </div>

        {filtered ? (
          <p className="text-[13px] text-mute">
            <Link href={qs({ tipo: undefined, projeto: undefined, freela: undefined })} className="underline decoration-white/20 underline-offset-4 hover:text-light">
              Limpar filtros
            </Link>
          </p>
        ) : null}
      </div>
    </AgendaProvider>
  );
}

function TypeChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[13px] whitespace-nowrap transition-colors",
        active ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
      )}
    >
      {children}
    </Link>
  );
}
