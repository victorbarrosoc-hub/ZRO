/**
 * Linhas de evento da aba "Agenda" do projeto (servidor). Clicar abre os
 * detalhes pela janela da agenda.
 */
import { AlertTriangle } from "lucide-react";
import { EventButton } from "@/app/(painel)/painel/agenda/agenda-dialogs";
import { eventAriaLabel } from "@/app/(painel)/painel/agenda/agenda-month";
import { dayMonthShort, eventDays, eventEnd, timeRange } from "@/app/(painel)/painel/agenda/agenda-utils";
import { EVENT_TYPES, FUNCTIONS, optionLabel } from "@/lib/domain";
import { initials, monthShort, relativeDay, weekdayShort } from "@/lib/format";
import type { AgendaEvent } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";

export function ProjectEventList({ events, today, past = false }: { events: AgendaEvent[]; today: string; past?: boolean }) {
  return (
    <ul className={cn("grid grid-cols-1 px-3 pb-3", past && "opacity-60")}>
      {events.map((ev) => (
        <li key={ev.id}>
          <ProjectEventRow ev={ev} today={today} />
        </li>
      ))}
    </ul>
  );
}

function ProjectEventRow({ ev, today }: { ev: AgendaEvent; today: string }) {
  const days = eventDays(ev);
  const time = timeRange(ev);
  const running = ev.date <= today && eventEnd(ev) >= today;
  const meta = [
    optionLabel(EVENT_TYPES, ev.type),
    days > 1 ? `${days} dias, até ${dayMonthShort(eventEnd(ev))}` : null,
    time || "dia todo",
    ev.location,
    ev.callSheetId ? "ordem do dia pronta" : null,
  ].filter(Boolean);

  return (
    <EventButton
      eventId={ev.id}
      label={eventAriaLabel(ev)}
      className="flex w-full items-start gap-4 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span
        className={cn(
          "grid w-12 shrink-0 justify-items-center rounded-xl py-1.5",
          running ? "bg-white text-void shadow-[0_0_22px_rgb(255_255_255/0.35)]" : "text-white",
        )}
      >
        <span className={cn("label text-[10px]", running ? "text-void/70" : "text-mute")}>{weekdayShort(ev.date)}</span>
        <span className="text-[22px] leading-tight font-semibold">{Number(ev.date.slice(8, 10))}</span>
        <span className={cn("label text-[10px]", running ? "text-void/70" : "text-mute")}>{monthShort(ev.date.slice(0, 7))}</span>
      </span>

      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-[15px] leading-snug font-medium text-light">{ev.title}</span>
        <span className="mt-0.5 block text-[13px] text-mute">{meta.join(" · ")}</span>
        {ev.crew.length ? (
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {ev.crew.map((c) => {
              const clash = ev.conflicts.some((x) => x.freelancerId === c.freelancerId);
              return (
                <span
                  key={c.freelancerId}
                  className={cn(
                    "inline-flex h-7 items-center gap-2 rounded-full border py-0.5 pr-3 pl-0.5 text-[12px]",
                    clash ? "border-warn/45 text-warn" : "border-line-strong text-ash",
                  )}
                >
                  <span className="grid size-6 place-items-center rounded-full bg-white/[0.07] text-[10px] font-medium text-light">
                    {initials(c.name)}
                  </span>
                  <span>
                    {c.name.split(" ")[0]}
                    {c.function ? <span className="text-mute"> · {optionLabel(FUNCTIONS, c.function)}</span> : null}
                  </span>
                </span>
              );
            })}
          </span>
        ) : ev.type === "diaria" ? (
          <span className="mt-1.5 block text-[12px] text-mute">Ninguém escalado ainda.</span>
        ) : null}
        {ev.conflicts.length ? (
          <span className="mt-2 flex items-center gap-1.5 text-[12px] text-warn">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {[...new Set(ev.conflicts.map((c) => c.freelancerName.split(" ")[0]))].join(" e ")} também em{" "}
            {[...new Set(ev.conflicts.map((c) => `“${c.eventTitle}”`))].join(", ")}
          </span>
        ) : null}
      </span>

      <span className="label hidden shrink-0 pt-1.5 text-mute sm:block">
        {running && days > 1 ? "em andamento" : relativeDay(ev.date, today)}
      </span>
    </EventButton>
  );
}
