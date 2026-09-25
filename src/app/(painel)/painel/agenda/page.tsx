import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { EVENT_TYPES } from "@/lib/domain";
import { addDaysISO, todayISO } from "@/lib/format";
import { getAgendaOptions, getEventDate, listBookings, listEventsInRange } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";
import { AgendaProvider, NewEventButton } from "./agenda-dialogs";
import { FilterSelect } from "./agenda-filters";
import { AgendaLegend, MobileAgenda, MonthGrid } from "./agenda-month";
import {
  eachDay,
  eventEnd,
  isDateParam,
  isMonthParam,
  mondayOf,
  monthGrid,
  monthTitle,
  rangesOverlap,
  shiftMonth,
  weekTitle,
} from "./agenda-utils";
import { MobileWeek, WeekBoard } from "./agenda-week";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/painel/agenda">) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = todayISO();

  // Visão: semana (?semana=AAAA-MM-DD, qualquer dia dela) ou mês (?mes=AAAA-MM).
  const semanaParam = one("semana");
  const week = isDateParam(semanaParam) ? mondayOf(semanaParam) : null;
  const eventoId = one("evento");
  let month = isMonthParam(one("mes")) ? one("mes")! : undefined;
  if (!week && !month && eventoId) month = (await getEventDate(eventoId))?.slice(0, 7);
  month ??= (week ?? today).slice(0, 7);

  const tipo = EVENT_TYPES.some((t) => t.key === one("tipo")) ? one("tipo") : undefined;
  const projeto = one("projeto");
  const freela = one("freela");
  const filtered = !!(tipo || projeto || freela);

  const grid = monthGrid(month);
  const range = week ? { start: week, end: addDaysISO(week, 6) } : { start: grid.start, end: grid.end };
  const focus = week ? range : { start: grid.first, end: grid.last };
  const bookingsFrom = addDaysISO(range.start < today ? range.start : today, -7);

  const [events, options, bookings] = await Promise.all([
    listEventsInRange({ start: range.start, end: range.end, type: tipo, projectId: projeto, freelancerId: freela }),
    getAgendaOptions(),
    listBookings(bookingsFrom),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base = week ? { semana: week } : { mes: month };
    const merged = { ...base, tipo, projeto, freela, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/agenda${s ? `?${s}` : ""}`;
  };

  // Resumo do período em foco (o mês inteiro ou a semana).
  const inFocus = events.filter((ev) => rangesOverlap(ev.date, eventEnd(ev), focus.start, focus.end));
  const conflicts = inFocus.filter((ev) => ev.conflicts.length).length;

  const currentWeek = mondayOf(today);
  const isCurrent = week ? week === currentWeek : month === today.slice(0, 7);
  // Ao trocar de visão, fica no mesmo pedaço do calendário.
  const weekOfMonth = month === today.slice(0, 7) ? currentWeek : mondayOf(`${month}-01`);

  return (
    <AgendaProvider
      events={events}
      options={options}
      bookings={bookings}
      initialEventId={eventoId && events.some((e) => e.id === eventoId) ? eventoId : undefined}
    >
      <div className="grid grid-cols-1 gap-6">
        <PageHeader
          label={week ? `Agenda de produções · semana · ${week.slice(0, 4)}` : "Agenda de produções"}
          title={week ? weekTitle(week) : monthTitle(month)}
          actions={
            <NewEventButton
              defaults={{
                ...(projeto ? { projectId: projeto } : {}),
                // Fora do período de hoje, o evento novo já nasce no período que está na tela.
                ...(today < focus.start || today > focus.end ? { date: focus.start } : {}),
              }}
            />
          }
        />

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex items-center gap-1.5" aria-label={week ? "Semana" : "Mês"}>
                <ButtonLink
                  href={week ? qs({ semana: addDaysISO(week, -7) }) : qs({ mes: shiftMonth(month, -1) })}
                  variant="secondary"
                  size="icon"
                  aria-label={week ? "Semana anterior" : "Mês anterior"}
                  scroll={false}
                >
                  <ChevronLeft />
                </ButtonLink>
                <ButtonLink
                  href={week ? qs({ semana: addDaysISO(week, 7) }) : qs({ mes: shiftMonth(month, 1) })}
                  variant="secondary"
                  size="icon"
                  aria-label={week ? "Próxima semana" : "Próximo mês"}
                  scroll={false}
                >
                  <ChevronRight />
                </ButtonLink>
                <ButtonLink
                  href={week ? qs({ semana: currentWeek }) : qs({ mes: undefined })}
                  variant={isCurrent ? "ghost" : "secondary"}
                  className="h-10"
                  scroll={false}
                  aria-current={isCurrent ? "date" : undefined}
                >
                  Hoje
                </ButtonLink>
              </nav>
              <div className="flex rounded-full border border-line bg-white/[0.02] p-1" role="group" aria-label="Visão">
                <ViewLink href={qs({ semana: undefined, mes: month })} active={!week}>
                  Mês
                </ViewLink>
                <ViewLink href={qs({ mes: undefined, semana: week ?? weekOfMonth })} active={!!week}>
                  Semana
                </ViewLink>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <FilterSelect
                param="projeto"
                value={projeto}
                label="Filtrar por projeto"
                allLabel="Todos os projetos"
                options={options.projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.title}` }))}
                className="min-w-0 sm:w-56"
              />
              <FilterSelect
                param="freela"
                value={freela}
                label="Filtrar por freela"
                allLabel="Toda a equipe"
                options={options.freelancers.map((f) => ({ value: f.id, label: f.active ? f.name : `${f.name} (arquivado)` }))}
                className="min-w-0 sm:w-48"
              />
            </div>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Tipo de evento">
            <TypeChip href={qs({ tipo: undefined })} active={!tipo}>
              Todos
            </TypeChip>
            {EVENT_TYPES.map((t) => (
              <TypeChip key={t.key} href={qs({ tipo: t.key })} active={tipo === t.key}>
                {t.label}
              </TypeChip>
            ))}
          </div>
        </div>

        {week ? (
          <>
            <div className="hidden md:block">
              <WeekBoard days={eachDay(range.start, range.end)} today={today} events={events} />
            </div>
            <div className="md:hidden">
              <MobileWeek days={eachDay(range.start, range.end)} today={today} events={events} />
            </div>
          </>
        ) : (
          <>
            <div className="hidden md:block">
              <MonthGrid weeks={grid.weeks} month={month} today={today} events={events} />
            </div>
            <div className="md:hidden">
              <MobileAgenda weeks={grid.weeks} month={month} today={today} events={events} />
            </div>
            {!inFocus.length ? (
              <Card className="md:hidden">
                <EmptyState title={filtered ? "Nada com esse filtro" : week ? "Nada marcado nesta semana" : "Nada marcado neste mês"} />
              </Card>
            ) : null}
          </>
        )}

        <div className="hidden md:block">
          <AgendaLegend showConflict={conflicts > 0} />
        </div>

        {filtered ? (
          <p className="text-[13px] text-mute">
            <Link
              href={qs({ tipo: undefined, projeto: undefined, freela: undefined })}
              className="underline decoration-white/20 underline-offset-4 hover:text-light"
            >
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

function ViewLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center rounded-full px-4 text-[13px] transition-colors",
        active ? "bg-white text-void" : "text-ash hover:bg-white/[0.06] hover:text-light",
      )}
    >
      {children}
    </Link>
  );
}
