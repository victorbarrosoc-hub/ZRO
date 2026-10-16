"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Clapperboard,
  Copy,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { ActionForm, ConfirmAction, FormModal, SubmitButton } from "@/components/painel/form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/surface";
import { EVENT_TYPES, FUNCTIONS, eventColorHex, optionLabel } from "@/lib/domain";
import { addDaysISO, todayISO } from "@/lib/format";
import type { AgendaEvent, AgendaOptions, Booking } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";
import { newCallSheet } from "@/app/(painel)/painel/projetos/[id]/ordem-do-dia/actions";
import { createEvent, deleteEvent, updateEvent } from "./actions";
import { EventFields, type EventDefaults } from "./agenda-fields";
import { DiariaEnvio } from "./diaria-envio";
import { capitalize, dateRangeLong, dayMonthShort, eventDays, eventEnd, mapsSearchUrl, timeRange } from "./agenda-utils";

type FormState = { mode: "new" | "edit"; defaults: EventDefaults; n: number };

type AgendaContextValue = {
  openEvent: (id: string) => void;
  openNew: (defaults?: EventDefaults) => void;
};

const AgendaContext = createContext<AgendaContextValue | null>(null);

function useAgenda() {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error("Componente da agenda fora do <AgendaProvider>.");
  return ctx;
}

function toDefaults(ev: AgendaEvent): EventDefaults {
  return {
    id: ev.id,
    type: ev.type,
    title: ev.title,
    projectId: ev.projectId,
    date: ev.date,
    endDate: ev.endDate,
    startTime: ev.startTime,
    endTime: ev.endTime,
    location: ev.location,
    notes: ev.notes,
    ownerId: ev.ownerId,
    color: ev.color,
    crew: ev.crew.map((c) => ({ freelancerId: c.freelancerId, function: c.function })),
  };
}

/**
 * Guarda a janela de detalhes e o formulário de evento, uma vez só por tela.
 * Os botões (chips do calendário, "Novo evento", dia vazio) só pedem para abrir.
 */
export function AgendaProvider({
  events,
  options,
  bookings,
  initialEventId,
  showAgendaLink = false,
  children,
}: {
  events: AgendaEvent[];
  options: AgendaOptions;
  bookings: Booking[];
  initialEventId?: string;
  showAgendaLink?: boolean;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<{ id: string; snapshot: AgendaEvent | null } | null>(() =>
    initialEventId ? { id: initialEventId, snapshot: events.find((e) => e.id === initialEventId) ?? null } : null,
  );
  const [viewOpen, setViewOpen] = useState(!!initialEventId);
  const [form, setForm] = useState<FormState | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // A versão atual do evento; se ele acabou de ser excluído, a última vista
  // (assim a janela termina de fechar e o aviso de "excluído" aparece).
  const viewing = view ? (events.find((e) => e.id === view.id) ?? view.snapshot) : null;

  const openEvent = useCallback(
    (id: string) => {
      setView({ id, snapshot: events.find((e) => e.id === id) ?? null });
      setViewOpen(true);
    },
    [events],
  );

  const openForm = useCallback((mode: "new" | "edit", defaults: EventDefaults) => {
    setForm((f) => ({ mode, defaults, n: (f?.n ?? 0) + 1 }));
    setFormOpen(true);
  }, []);

  const openNew = useCallback((defaults: EventDefaults = {}) => openForm("new", defaults), [openForm]);
  const value = useMemo(() => ({ openEvent, openNew }), [openEvent, openNew]);

  function closeView() {
    setViewOpen(false);
    // Tira o ?evento= do endereço para a janela não voltar ao recarregar.
    const url = new URL(window.location.href);
    if (url.searchParams.has("evento")) {
      url.searchParams.delete("evento");
      window.history.replaceState(window.history.state, "", url);
    }
  }

  return (
    <AgendaContext.Provider value={value}>
      {children}

      <Modal open={viewOpen && !!viewing} onOpenChange={(v) => (v ? setViewOpen(true) : closeView())}>
        {viewing ? (
          <EventDetails
            event={viewing}
            showAgendaLink={showAgendaLink}
            onClose={closeView}
            onEdit={() => {
              closeView();
              openForm("edit", toDefaults(viewing));
            }}
            onDuplicate={() => {
              closeView();
              // A cópia começa no dia seguinte ao fim, com a mesma duração.
              const next = addDaysISO(eventEnd(viewing), 1);
              const length = eventDays(viewing);
              openForm("new", {
                ...toDefaults(viewing),
                id: undefined,
                date: next,
                endDate: length > 1 ? addDaysISO(next, length - 1) : null,
              });
            }}
          />
        ) : null}
      </Modal>

      {form ? (
        <FormModal
          key={form.n}
          open={formOpen}
          onOpenChange={setFormOpen}
          title={form.mode === "edit" ? "Editar evento" : "Novo evento"}
          description={
            form.mode === "edit" ? undefined : "Diária, entrega ou reunião. Quem estiver escalado em outro lugar no mesmo dia aparece com aviso."
          }
          action={form.mode === "edit" ? updateEvent : createEvent}
          submitLabel={form.mode === "edit" ? "Salvar" : "Criar evento"}
          size="lg"
        >
          {(state) => (
            <EventFields
              state={state}
              defaults={{ date: todayISO(), ...form.defaults }}
              options={options}
              bookings={bookings}
            />
          )}
        </FormModal>
      ) : null}
    </AgendaContext.Provider>
  );
}

function EventDetails({
  event,
  showAgendaLink,
  onClose,
  onEdit,
  onDuplicate,
}: {
  event: AgendaEvent;
  showAgendaLink: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const time = timeRange(event);
  const days = eventDays(event);
  const conflictsOf = (freelancerId: string) => event.conflicts.filter((c) => c.freelancerId === freelancerId);

  return (
    <ModalContent
      title={event.title}
      description={`${capitalize(dateRangeLong(event.date, event.endDate))}${time ? ` · ${time}` : " · dia todo"}`}
      size="md"
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="light">
            {eventColorHex(event.color) ? (
              <span className="size-2 rounded-full" style={{ background: eventColorHex(event.color)! }} aria-hidden />
            ) : null}
            {optionLabel(EVENT_TYPES, event.type)}
          </Badge>
          {event.ownerName ? <Badge tone="neutral">Agenda de {event.ownerName.split(" ")[0]}</Badge> : null}
          {days > 1 ? <Badge>{days} dias</Badge> : null}
          {event.conflicts.length ? (
            <Badge tone="warn" dot>
              Conflito de equipe
            </Badge>
          ) : null}
        </div>

        <dl className="grid rounded-2xl border border-line">
          <InfoRow icon={<MapPin />} label="Local">
            {event.location ? (
              <a
                href={mapsSearchUrl(event.location)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
              >
                {event.location} <ArrowUpRight className="size-3.5 text-mute" aria-hidden />
              </a>
            ) : (
              <span className="text-mute">Não informado</span>
            )}
          </InfoRow>
          <InfoRow icon={<Clapperboard />} label="Projeto">
            {event.projectId ? (
              <Link
                href={`/painel/projetos/${event.projectId}?aba=agenda`}
                className="underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
              >
                <span className="font-mono text-[12px] text-mute">{event.projectCode}</span> {event.projectTitle}
              </Link>
            ) : (
              <span className="text-mute">Sem projeto</span>
            )}
          </InfoRow>
          {event.projectId && (event.callSheetId || event.type === "diaria") ? (
            <InfoRow icon={<FileText />} label="Ordem do dia">
              {event.callSheetId ? (
                <Link
                  href={`/painel/projetos/${event.projectId}/ordem-do-dia/${event.callSheetId}`}
                  className="underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                >
                  Abrir a ordem do dia
                </Link>
              ) : (
                <ActionForm action={newCallSheet}>
                  <input type="hidden" name="projectId" value={event.projectId} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <SubmitButton variant="subtle" size="sm" pendingLabel="Criando…" className="-my-1">
                    <Plus /> Criar com esta diária
                  </SubmitButton>
                </ActionForm>
              )}
            </InfoRow>
          ) : null}
          {event.type === "diaria" && event.projectId ? (
            <InfoRow icon={<Upload />} label="Material">
              <DiariaEnvio eventId={event.id} />
            </InfoRow>
          ) : null}
        </dl>

        {event.notes ? (
          <div>
            <p className="label mb-1.5 text-mute">Observações</p>
            <p className="text-[14px] whitespace-pre-line text-ash">{event.notes}</p>
          </div>
        ) : null}

        <div>
          <p className="label mb-2 text-mute">Equipe · {event.crew.length}</p>
          {event.crew.length ? (
            <ul className="grid gap-1">
              {event.crew.map((c) => {
                const clash = conflictsOf(c.freelancerId);
                return (
                  <li key={c.freelancerId} className="flex items-start gap-3 rounded-xl py-1.5">
                    <Avatar name={c.name} imageId={c.photoId} size="md" className={cn("size-9", clash.length && "border-warn/50")} />
                    <span className="min-w-0 flex-1">
                      <Link href={`/painel/freelas/${c.freelancerId}`} className="block text-[14px] text-light hover:underline">
                        {c.name}
                      </Link>
                      <span className="block text-[12px] text-mute">{c.function ? optionLabel(FUNCTIONS, c.function) : "Função não definida"}</span>
                      {clash.map((x) => (
                        <span key={x.eventId} className="mt-1 flex items-start gap-1.5 text-[12px] text-warn">
                          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                          <span>
                            Também em “{x.eventTitle}” · {dayMonthShort(x.date)}
                            {x.endDate && x.endDate > x.date ? ` a ${dayMonthShort(x.endDate)}` : ""}
                          </span>
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-mute">Ninguém escalado ainda.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <ConfirmAction
            title="Excluir este evento?"
            description="A equipe escalada sai junto. Uma ordem do dia ligada a ele continua existindo, sem o vínculo."
            confirmLabel="Excluir"
            action={deleteEvent}
            fields={{ id: event.id }}
            onDone={onClose}
            trigger={
              <Button variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 /> Excluir
              </Button>
            }
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {showAgendaLink ? (
              <ButtonLink href={`/painel/agenda?mes=${event.date.slice(0, 7)}&evento=${event.id}`} variant="ghost">
                <CalendarDays /> Ver na agenda
              </ButtonLink>
            ) : null}
            <Button variant="secondary" onClick={onDuplicate}>
              <Copy /> Duplicar
            </Button>
            <Button variant="primary" onClick={onEdit}>
              <Pencil /> Editar
            </Button>
          </div>
        </div>
      </div>
    </ModalContent>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="mt-0.5 text-mute [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <dt className="w-24 shrink-0 text-[13px] text-mute">{label}</dt>
      <dd className="min-w-0 flex-1 text-[14px] text-light">{children}</dd>
    </div>
  );
}

/* ---------------- Botões que abrem as janelas ---------------- */

/** Chip ou linha de evento: abre os detalhes. */
export function EventButton({
  eventId,
  label,
  className,
  style,
  children,
}: {
  eventId: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { openEvent } = useAgenda();
  return (
    <button type="button" onClick={() => openEvent(eventId)} aria-label={label} title={label} className={className} style={style}>
      {children}
    </button>
  );
}

/** Área de um dia no calendário: clicar no vazio cria um evento naquela data. */
export function DayButton({
  date,
  label,
  className,
  style,
  children,
}: {
  date: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const { openNew } = useAgenda();
  return (
    <button type="button" onClick={() => openNew({ date })} aria-label={label} className={className} style={style}>
      {children}
    </button>
  );
}

export function NewEventButton({
  defaults,
  label = "Novo evento",
  variant = "primary",
  size = "md",
  className,
}: {
  defaults?: EventDefaults;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "subtle";
  size?: "sm" | "md";
  className?: string;
}) {
  const { openNew } = useAgenda();
  return (
    <Button variant={variant} size={size} className={className} onClick={() => openNew(defaults)}>
      <Plus /> {label}
    </Button>
  );
}
