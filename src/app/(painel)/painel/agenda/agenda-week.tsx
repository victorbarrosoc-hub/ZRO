/**
 * Visão por semana (servidor): uma coluna por dia, com o evento inteiro à
 * mostra (horário, local, equipe). No celular, a semana vira uma lista.
 */
import { AlertTriangle, Plus } from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { EVENT_TYPES, optionLabel } from "@/lib/domain";
import { dateLong, monthShort, relativeDay } from "@/lib/format";
import type { AgendaEvent } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";
import { DayButton, EventButton } from "./agenda-dialogs";
import { MobileEventRow, eventAriaLabel } from "./agenda-month";
import { WEEKDAY_HEADERS, eachDay, eventChipClass, eventDays, eventEnd, eventKicker, rangesOverlap, timeRange } from "./agenda-utils";

function eventsOn(day: string, events: AgendaEvent[]) {
  return events.filter((ev) => rangesOverlap(ev.date, eventEnd(ev), day, day));
}

export function WeekBoard({ days, today, events }: { days: string[]; today: string; events: AgendaEvent[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.03),rgb(255_255_255/0.008))]">
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const list = eventsOn(day, events);
          const isToday = day === today;
          const past = day < today;
          return (
            <section
              key={day}
              aria-label={dateLong(day)}
              className={cn(
                "flex min-h-[460px] min-w-0 flex-col border-l border-line first:border-l-0",
                isToday && "bg-[radial-gradient(140%_60%_at_50%_0%,rgb(255_255_255/0.06),transparent_70%)]",
              )}
            >
              <header className="flex items-center gap-2 border-b border-line px-3 py-3">
                <span className={cn("label", i >= 5 ? "text-mute/70" : "text-mute")}>{WEEKDAY_HEADERS[i]}</span>
                <span
                  className={cn(
                    "grid h-7 min-w-7 place-items-center rounded-full px-1 text-[15px] font-semibold tabular-nums",
                    isToday ? "bg-white text-void shadow-[0_0_0_4px_rgb(255_255_255/0.08),0_0_22px_rgb(255_255_255/0.55)]" : past ? "text-mute" : "text-white",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </span>
                {Number(day.slice(8, 10)) === 1 || i === 0 ? <span className="label text-mute">{monthShort(day.slice(0, 7))}</span> : null}
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {list.map((ev) => (
                  <WeekCard key={ev.id} ev={ev} day={day} today={today} />
                ))}
                <DayButton
                  date={day}
                  label={`Novo evento em ${dateLong(day)}`}
                  className="group flex min-h-14 flex-1 items-start justify-center rounded-xl border border-dashed border-transparent pt-3 text-mute transition-colors hover:border-line-strong hover:text-light focus-visible:border-line-strong"
                >
                  <span className="flex items-center gap-1.5 text-[12px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Plus className="size-3.5" aria-hidden /> Marcar
                  </span>
                </DayButton>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WeekCard({ ev, day, today }: { ev: AgendaEvent; day: string; today: string }) {
  const days = eventDays(ev);
  const index = days > 1 ? eachDay(ev.date, day).length : 0;
  const time = timeRange(ev);
  const conflict = ev.conflicts.length > 0;
  return (
    <EventButton
      eventId={ev.id}
      label={eventAriaLabel(ev)}
      className={cn(
        "grid gap-1 rounded-xl border p-2.5 text-left transition-[border-color,opacity] duration-200 hover:border-white/60",
        eventChipClass(ev.type),
        eventEnd(ev) < today && "opacity-60",
        conflict && "border-warn/60",
      )}
    >
      <span className={cn("flex items-center gap-1.5 font-mono text-[10px] leading-[1.3] tracking-[0.12em] uppercase", ev.type === "diaria" ? "text-white/70" : "text-mute")}>
        {conflict ? <AlertTriangle className="size-3 shrink-0 text-warn" aria-hidden /> : null}
        <span className="truncate">
          {eventKicker(ev, optionLabel(EVENT_TYPES, ev.type))}
          {days > 1 ? ` · ${index}/${days}` : ""}
        </span>
      </span>
      <span className="text-[13px] leading-snug font-medium break-words">{ev.title}</span>
      <span className="font-mono text-[11px] text-ash tabular-nums">{time || "dia todo"}</span>
      {ev.location ? <span className="line-clamp-2 text-[12px] leading-snug text-mute">{ev.location}</span> : null}
      {ev.crew.length ? (
        <span className="flex items-center pt-1">
          {ev.crew.slice(0, 4).map((c) => (
            <span key={c.freelancerId} title={c.name} className="-ml-1.5 first:ml-0">
              <Avatar
                name={c.name}
                imageId={c.photoId}
                size="xs"
                className={cn(
                  "bg-smoke",
                  ev.conflicts.some((x) => x.freelancerId === c.freelancerId) ? "border-warn/70" : "border-void",
                )}
              />
            </span>
          ))}
          {ev.crew.length > 4 ? <span className="ml-1.5 text-[11px] text-mute">+{ev.crew.length - 4}</span> : null}
        </span>
      ) : null}
    </EventButton>
  );
}

export function MobileWeek({ days, today, events }: { days: string[]; today: string; events: AgendaEvent[] }) {
  return (
    <ol className="grid gap-6">
      {days.map((day) => {
        const list = eventsOn(day, events);
        const isToday = day === today;
        return (
          <li key={day}>
            <div className="mb-3 flex items-center gap-3">
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-full text-[17px] font-semibold",
                  isToday ? "bg-white text-void shadow-[0_0_20px_rgb(255_255_255/0.45)]" : "border border-line-strong text-white",
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
              <span className="label text-ash">
                {WEEKDAY_HEADERS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]} · {monthShort(day.slice(0, 7))}
              </span>
              <span className="label ml-auto text-mute">{relativeDay(day, today)}</span>
            </div>
            {list.length ? (
              <ul className="grid gap-2">
                {list.map((ev) => (
                  <li key={ev.id}>
                    <MobileEventRow ev={ev} day={day} today={today} />
                  </li>
                ))}
              </ul>
            ) : (
              <DayButton
                date={day}
                label={`Novo evento em ${dateLong(day)}`}
                className="flex h-12 w-full items-center justify-between rounded-2xl border border-dashed border-line-strong px-4 text-[13px] text-mute transition-colors hover:border-white/30 hover:text-light"
              >
                <span>Livre</span>
                <span className="flex items-center gap-1.5">
                  <Plus className="size-3.5" aria-hidden /> Marcar
                </span>
              </DayButton>
            )}
          </li>
        );
      })}
    </ol>
  );
}
