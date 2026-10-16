/**
 * Calendário do mês (servidor). A marcação sai pronta daqui; só os botões
 * que abrem janelas (chips, dias vazios) são componentes de cliente.
 */
import { AlertTriangle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/surface";
import { EVENT_TYPES, FUNCTIONS, eventColorHex, optionLabel } from "@/lib/domain";
import { dateLong, dateShort, monthShort, relativeDay, weekdayShort } from "@/lib/format";
import type { AgendaEvent } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";
import { DayButton, EventButton } from "./agenda-dialogs";
import {
  WEEKDAY_HEADERS,
  eachDay,
  eventChip,
  eventChipClass,
  eventKicker,
  eventDays,
  eventEnd,
  layoutWeek,
  rangesOverlap,
  timeRange,
  type WeekSegment,
} from "./agenda-utils";

const LANE = 46;
const DAY_HEAD = 36;

function typeLabel(type: string) {
  return optionLabel(EVENT_TYPES, type);
}

/** Tipo com o dono na frente, quando é a agenda de um sócio. */
function kicker(ev: AgendaEvent) {
  return eventKicker(ev, typeLabel(ev.type));
}

/** Texto para leitores de tela e para a dica ao passar o mouse. */
export function eventAriaLabel(ev: AgendaEvent) {
  const parts = [`${kicker(ev)}: ${ev.title}`, eventDays(ev) > 1 ? `${dateShort(ev.date)} a ${dateShort(eventEnd(ev))}` : dateShort(ev.date)];
  const t = timeRange(ev);
  if (t) parts.push(t);
  if (ev.projectCode) parts.push(ev.projectCode);
  if (ev.conflicts.length) parts.push("conflito de equipe");
  return parts.join(" · ");
}

/* ============================== Desktop: grade do mês ============================== */

export function MonthGrid({
  weeks,
  month,
  today,
  events,
}: {
  weeks: string[][];
  month: string;
  today: string;
  events: AgendaEvent[];
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.03),rgb(255_255_255/0.008))]">
      <div className="grid grid-cols-7 border-b border-line" aria-hidden>
        {WEEKDAY_HEADERS.map((d, i) => (
          <div key={d} className={cn("label px-3 py-3", i >= 5 ? "text-mute/70" : "text-mute")}>
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <WeekRow key={week[0]} week={week} month={month} today={today} events={events} />
      ))}
    </div>
  );
}

function WeekRow({ week, month, today, events }: { week: string[]; month: string; today: string; events: AgendaEvent[] }) {
  const { segments, laneCount } = layoutWeek(week, events);
  const rows = laneCount ? `${DAY_HEAD}px repeat(${laneCount}, ${LANE}px) minmax(12px, 1fr)` : `${DAY_HEAD}px minmax(12px, 1fr)`;

  return (
    <div
      className="grid grid-cols-7 border-b border-line last:border-b-0"
      style={{ gridTemplateRows: rows, minHeight: Math.max(116, DAY_HEAD + laneCount * LANE + 16) }}
    >
      {week.map((day, i) => {
        const inMonth = day.slice(0, 7) === month;
        const isToday = day === today;
        const past = day < today;
        const dayNum = Number(day.slice(8, 10));
        return (
          <DayButton
            key={day}
            date={day}
            label={`Novo evento em ${dateLong(day)}`}
            style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
            className={cn(
              "group relative flex flex-col items-start border-l border-line px-2.5 pt-2 text-left transition-colors duration-200 first:border-l-0 hover:bg-white/[0.025] focus-visible:z-20 focus-visible:-outline-offset-2",
              !inMonth && "bg-black/30",
              isToday && "bg-[radial-gradient(120%_90%_at_20%_0%,rgb(255_255_255/0.07),transparent_70%)]",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono text-[12px] tabular-nums",
                  isToday
                    ? "bg-white font-medium text-void shadow-[0_0_0_4px_rgb(255_255_255/0.08),0_0_22px_rgb(255_255_255/0.55)]"
                    : !inMonth
                      ? "text-mute/60"
                      : past
                        ? "text-mute"
                        : "text-light",
                )}
              >
                {dayNum}
              </span>
              {isToday ? <span className="label text-white">Hoje</span> : null}
              {dayNum === 1 && !isToday ? <span className="label text-mute">{monthShort(day.slice(0, 7))}</span> : null}
            </span>
            <Plus className="absolute top-2.5 right-2.5 size-3.5 text-mute opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
          </DayButton>
        );
      })}

      {segments.map((seg) => (
        <Chip key={`${seg.event.id}-${week[0]}`} seg={seg} month={month} today={today} />
      ))}
    </div>
  );
}

function Chip({ seg, month, today }: { seg: WeekSegment<AgendaEvent>; month: string; today: string }) {
  const ev = seg.event;
  const time = ev.startTime ?? "";
  const days = eventDays(ev);
  const outside = eventEnd(ev) < `${month}-01` || ev.date > `${month}-31`;
  const past = eventEnd(ev) < today;
  const conflict = ev.conflicts.length > 0;
  const chip = eventChip(ev);
  return (
    <EventButton
      eventId={ev.id}
      label={eventAriaLabel(ev)}
      style={{ ...chip.style, gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 2 }}
      className={cn(
        "relative z-10 mx-1.5 my-[3px] flex min-w-0 flex-col justify-center overflow-hidden rounded-[10px] border px-2.5 text-left transition-[border-color,background-color,opacity] duration-200 hover:border-white/60 hover:opacity-100 focus-visible:z-30",
        chip.className,
        seg.continuesBefore && "ml-0 rounded-l-none border-l-0",
        seg.continuesAfter && "mr-0 rounded-r-none border-r-0",
        (outside || past) && "opacity-55",
        conflict && "border-warn/60",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 truncate font-mono text-[10px] leading-[1.3] tracking-[0.12em] uppercase",
          chip.kicker,
        )}
      >
        {conflict ? <AlertTriangle className="size-3 shrink-0 text-warn" aria-hidden /> : null}
        <span className="truncate">
          {kicker(ev)}
          {time ? ` · ${time}` : ""}
          {days > 1 ? ` · ${days} dias` : ""}
        </span>
      </span>
      <span className="mt-0.5 truncate text-[12.5px] leading-tight font-medium">{ev.title}</span>
    </EventButton>
  );
}

/* ============================== Legenda ============================== */

export function AgendaLegend({ showConflict }: { showConflict: boolean }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-mute" aria-label="Legenda">
      {EVENT_TYPES.map((t) => (
        <li key={t.key} className="flex items-center gap-2">
          <span className={cn("h-3.5 w-6 rounded-[5px] border", eventChipClass(t.key))} aria-hidden />
          {t.label}
        </li>
      ))}
      {showConflict ? (
        <li className="flex items-center gap-2 text-warn">
          <AlertTriangle className="size-3.5" aria-hidden /> Conflito de equipe: alguém escalado em dois lugares no mesmo dia
        </li>
      ) : null}
      <li className="text-mute/80">Clique num dia vazio para marcar um evento.</li>
    </ul>
  );
}

/* ============================== Celular: mini calendário + lista ============================== */

export function MobileAgenda({
  weeks,
  month,
  today,
  events,
}: {
  weeks: string[][];
  month: string;
  today: string;
  events: AgendaEvent[];
}) {
  const monthDays = eachDay(`${month}-01`, weeks[weeks.length - 1].filter((d) => d.slice(0, 7) === month).at(-1)!);
  const byDay = new Map<string, AgendaEvent[]>();
  for (const day of monthDays) {
    const list = events.filter((ev) => rangesOverlap(ev.date, eventEnd(ev), day, day));
    if (list.length) byDay.set(day, list);
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-card border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.03),rgb(255_255_255/0.008))] p-3">
        <div className="grid grid-cols-7 text-center" aria-hidden>
          {WEEKDAY_HEADERS.map((d) => (
            <span key={d} className="label py-1.5 text-[10px] text-mute">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {weeks.flat().map((day) => {
            const inMonth = day.slice(0, 7) === month;
            if (!inMonth) return <span key={day} aria-hidden />;
            const list = byDay.get(day) ?? [];
            const isToday = day === today;
            const num = Number(day.slice(8, 10));
            const cellClass = cn(
              "relative mx-auto grid size-11 place-items-center rounded-full font-mono text-[13px] tabular-nums transition-colors",
              isToday
                ? "bg-white font-medium text-void shadow-[0_0_20px_rgb(255_255_255/0.5)]"
                : list.length
                  ? "bg-white/[0.07] text-white"
                  : day < today
                    ? "text-mute"
                    : "text-ash hover:bg-white/[0.05]",
            );
            const dots = (
              <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden>
                {list.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={cn("size-1 rounded-full", isToday ? "bg-void" : ev.conflicts.length ? "bg-warn" : "bg-white/80")}
                    style={!isToday && !ev.conflicts.length && eventColorHex(ev.color) ? { background: eventColorHex(ev.color)! } : undefined}
                  />
                ))}
              </span>
            );
            return list.length ? (
              <a key={day} href={`#dia-${day}`} className={cellClass} aria-label={`${dateLong(day)}: ${list.length} evento${list.length > 1 ? "s" : ""}`}>
                {num}
                {dots}
              </a>
            ) : (
              <DayButton key={day} date={day} label={`Novo evento em ${dateLong(day)}`} className={cellClass}>
                {num}
              </DayButton>
            );
          })}
        </div>
      </div>

      {byDay.size ? (
        <ol className="grid gap-7">
          {[...byDay.entries()].map(([day, list]) => (
            <li key={day} id={`dia-${day}`} className="scroll-mt-20">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full text-[17px] font-semibold",
                    day === today ? "bg-white text-void shadow-[0_0_20px_rgb(255_255_255/0.45)]" : "border border-line-strong text-white",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </span>
                <span className="label text-ash">
                  {weekdayShort(day)} · {monthShort(day.slice(0, 7))}
                </span>
                <span className="label ml-auto text-mute">{relativeDay(day, today)}</span>
              </div>
              <ul className="grid gap-2">
                {list.map((ev) => (
                  <li key={ev.id}>
                    <MobileEventRow ev={ev} day={day} today={today} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function MobileEventRow({ ev, day, today }: { ev: AgendaEvent; day: string; today: string }) {
  const days = eventDays(ev);
  const dayIndex = days > 1 ? eachDay(ev.date, day).length : 0;
  return (
    <EventButton
      eventId={ev.id}
      label={eventAriaLabel(ev)}
      className={cn(
        "flex w-full items-stretch gap-3 rounded-2xl border p-3.5 text-left transition-colors hover:border-white/40",
        ev.type === "diaria" ? "border-white/20 bg-white/[0.06]" : "border-line bg-white/[0.02]",
        eventEnd(ev) < today && "opacity-60",
      )}
    >
      <span className="flex w-12 shrink-0 flex-col font-mono text-[12px] tabular-nums">
        <span className="text-light">{ev.startTime ?? "Dia"}</span>
        <span className="text-mute">{ev.endTime ?? (ev.startTime ? "" : "todo")}</span>
      </span>
      <span
        className={cn("min-w-0 flex-1 border-l border-line pl-3", eventColorHex(ev.color) && "border-l-2")}
        style={eventColorHex(ev.color) ? { borderLeftColor: eventColorHex(ev.color)! } : undefined}
      >
        <span className="label block text-[10px] text-mute">
          {kicker(ev)}
          {days > 1 ? ` · dia ${dayIndex} de ${days}` : ""}
        </span>
        <span className="mt-0.5 block text-[15px] leading-snug font-medium text-white">{ev.title}</span>
        {ev.location || ev.projectCode ? (
          <span className="mt-0.5 block truncate text-[13px] text-mute">
            {[ev.location, ev.projectCode].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {ev.crew.length ? (
          <span className="mt-2 block text-[12px] text-ash">
            {ev.crew.map((c) => `${c.name.split(" ")[0]}${c.function ? ` (${optionLabel(FUNCTIONS, c.function).toLowerCase()})` : ""}`).join(", ")}
          </span>
        ) : null}
        {ev.conflicts.length ? (
          <span className="mt-2 block">
            <Badge tone="warn" dot>
              Conflito de equipe
            </Badge>
          </span>
        ) : null}
      </span>
    </EventButton>
  );
}
