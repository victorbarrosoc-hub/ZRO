"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDownUp, ArrowUpRight, Check, ChevronDown, Copy, Printer, UserPlus, Users } from "lucide-react";
import { ActionForm } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlay";
import { Card, CardHeader } from "@/components/ui/surface";
import { EVENT_TYPES, optionLabel } from "@/lib/domain";
import { dateBR } from "@/lib/format";
import type { CrewSuggestion } from "@/lib/queries/documents";
import { cn } from "@/lib/utils";
import { mapsSearchUrl } from "@/app/(painel)/painel/agenda/agenda-utils";
import { copyText } from "../_tabs/documentos-client";
import { saveCallSheet } from "./actions";
import { RowsEditor } from "./rows-editor";
import { callSheetText } from "./sheet-text";

type ScheduleRow = { _k: string; time: string; activity: string; notes: string };
type CrewRow = { _k: string; name: string; role: string; phone: string; call: string };
type ContactRow = { _k: string; name: string; role: string; phone: string };

type SheetState = {
  title: string;
  date: string;
  callTime: string;
  location: string;
  locationUrl: string;
  eventId: string;
  notes: string;
  schedule: ScheduleRow[];
  crew: CrewRow[];
  contacts: ContactRow[];
};

export type CallSheetInput = {
  id: string;
  title: string;
  date: string;
  callTime: string | null;
  location: string | null;
  locationUrl: string | null;
  eventId: string | null;
  notes: string | null;
  schedule: { time: string; activity: string; notes?: string }[];
  crew: { name: string; role: string; phone?: string; call?: string }[];
  contacts: { name: string; role: string; phone?: string }[];
};

type EventOption = {
  id: string;
  type: string;
  title: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  location: string | null;
};

let keySeq = 0;
const nextKey = () => `r${++keySeq}`;

function toState(s: CallSheetInput): SheetState {
  return {
    title: s.title,
    date: s.date,
    callTime: s.callTime ?? "",
    location: s.location ?? "",
    locationUrl: s.locationUrl ?? "",
    eventId: s.eventId ?? "",
    notes: s.notes ?? "",
    schedule: s.schedule.map((r) => ({ _k: nextKey(), time: r.time ?? "", activity: r.activity ?? "", notes: r.notes ?? "" })),
    crew: s.crew.map((r) => ({ _k: nextKey(), name: r.name ?? "", role: r.role ?? "", phone: r.phone ?? "", call: r.call ?? "" })),
    contacts: s.contacts.map((r) => ({ _k: nextKey(), name: r.name ?? "", role: r.role ?? "", phone: r.phone ?? "" })),
  };
}

/** O que vai para o servidor (e o que define "tem alteração não salva"). */
function serialize(s: SheetState) {
  const strip = <T extends { _k: string }>(rows: T[]) => rows.map(({ _k, ...rest }) => (void _k, rest));
  return JSON.stringify({ ...s, schedule: strip(s.schedule), crew: strip(s.crew), contacts: strip(s.contacts) });
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export function CallSheetEditor({
  projectId,
  project,
  sheet,
  events,
  crewByEvent,
  projectCrew,
  printHref,
}: {
  projectId: string;
  project: { code: string; title: string; clientName: string | null; clientContact: string | null; clientPhone: string | null };
  sheet: CallSheetInput;
  events: EventOption[];
  crewByEvent: Record<string, CrewSuggestion[]>;
  projectCrew: CrewSuggestion[];
  printHref: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(() => toState(sheet));
  const [saved, setSaved] = useState(() => serialize(toState(sheet)));
  const json = serialize(state);
  const dirty = json !== saved;
  const dataRef = useRef<HTMLInputElement>(null);
  const thenRef = useRef<HTMLInputElement>(null);
  const submitted = useRef(json);

  const set = <K extends keyof SheetState>(key: K, value: SheetState[K]) => setState((s) => ({ ...s, [key]: value }));

  // Aviso ao sair com alteração não salva.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Ctrl/Cmd + S salva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        dataRef.current?.form?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const linked = events.find((e) => e.id === state.eventId);
  const eventCrew = state.eventId ? (crewByEvent[state.eventId] ?? []) : [];

  function linkEvent(eventId: string) {
    const ev = events.find((e) => e.id === eventId);
    setState((s) => ({
      ...s,
      eventId,
      ...(ev
        ? {
            date: ev.date,
            title: !s.title.trim() || s.title === "Ordem do dia" ? ev.title : s.title,
            location: s.location.trim() ? s.location : (ev.location ?? ""),
            callTime: s.callTime || ev.startTime || "",
          }
        : {}),
    }));
  }

  function pullCrew(list: CrewSuggestion[], source: string) {
    const present = new Set(state.crew.map((c) => norm(c.name)).filter(Boolean));
    const fresh = list.filter((p) => !present.has(norm(p.name)));
    if (!fresh.length) {
      toast.message(`Todo mundo ${source} já está na lista.`);
      return;
    }
    setState((s) => ({
      ...s,
      crew: [
        ...s.crew.filter((c) => c.name.trim() || c.role.trim() || c.phone.trim() || c.call.trim()),
        ...fresh.map((p) => ({ _k: nextKey(), name: p.name, role: p.role, phone: p.phone, call: "" })),
      ],
    }));
    toast.success(`${fresh.length} ${fresh.length > 1 ? "pessoas adicionadas" : "pessoa adicionada"} à equipe.`);
  }

  function addClientContact() {
    if (!project.clientContact) return;
    if (state.contacts.some((c) => norm(c.name) === norm(project.clientContact!))) {
      toast.message("O contato do cliente já está na lista.");
      return;
    }
    set("contacts", [
      ...state.contacts.filter((c) => c.name.trim() || c.role.trim() || c.phone.trim()),
      { _k: nextKey(), name: project.clientContact, role: project.clientName ?? "Cliente", phone: project.clientPhone ?? "" },
    ]);
  }

  function sortSchedule() {
    const withTime = state.schedule.filter((r) => r.time);
    const without = state.schedule.filter((r) => !r.time);
    set("schedule", [...withTime.sort((a, b) => a.time.localeCompare(b.time)), ...without]);
  }

  async function copyWhatsapp() {
    const text = callSheetText(
      {
        ...state,
        schedule: state.schedule,
        crew: state.crew,
        contacts: state.contacts,
      },
      project,
    );
    const ok = await copyText(text);
    if (ok) toast.success("Texto copiado. É só colar no WhatsApp.");
    else toast.error("Não deu para copiar. Tente pela versão para imprimir.");
  }

  /** Imprimir: com alteração pendente, salva antes (o servidor manda para a versão de impressão). */
  function print() {
    if (!dirty) {
      router.push(printHref);
      return;
    }
    const then = thenRef.current;
    if (!then) return;
    then.value = "print";
    then.form?.requestSubmit();
    then.value = "";
  }

  const mapsUrl = state.location.trim() ? mapsSearchUrl(state.location.trim()) : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardHeader title="O dia" description="O essencial para todo mundo chegar no lugar e na hora certa." />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 [&>div]:content-start">
          <Field label="Título" htmlFor="cs-title" className="sm:col-span-2">
            <Input id="cs-title" value={state.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Diária 3 · Pipa" />
          </Field>
          <Field
            label="Diária da agenda"
            htmlFor="cs-event"
            className="sm:col-span-2"
            hint={linked ? `Ligada à agenda: ${dateBR(linked.date)}${linked.startTime ? `, ${linked.startTime}` : ""}.` : "Opcional. Liga esta ordem a um evento do projeto."}
          >
            <Select id="cs-event" value={state.eventId} onChange={(e) => linkEvent(e.target.value)}>
              <option value="">Nenhuma</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {dateBR(ev.date)} · {ev.title}
                  {ev.type !== "diaria" ? ` (${optionLabel(EVENT_TYPES, ev.type).toLowerCase()})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data" htmlFor="cs-date">
            <Input id="cs-date" type="date" value={state.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Chegada da equipe" htmlFor="cs-call">
            <Input id="cs-call" type="time" value={state.callTime} onChange={(e) => set("callTime", e.target.value)} />
          </Field>
          <Field label="Local" htmlFor="cs-location" className="sm:col-span-2">
            <Input id="cs-location" value={state.location} onChange={(e) => set("location", e.target.value)} placeholder="Ex.: SERHS Pipa" />
          </Field>
          <Field
            label="Link do mapa"
            htmlFor="cs-map"
            className="sm:col-span-2 lg:col-span-4"
            hint={
              mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-white/20 underline-offset-4 hover:text-light">
                  Procurar “{state.location.trim()}” no Google Maps <ArrowUpRight className="size-3.5" />
                </a>
              ) : (
                "Cole o link de compartilhar do Google Maps."
              )
            }
          >
            <Input
              id="cs-map"
              type="url"
              inputMode="url"
              value={state.locationUrl}
              onChange={(e) => set("locationUrl", e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Cronograma"
          description="Horário e atividade. Enter numa célula cria a próxima linha."
          action={
            state.schedule.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={sortSchedule}>
                <ArrowDownUp /> Ordenar por horário
              </Button>
            ) : null
          }
        />
        <div className="p-5 sm:p-6">
          <RowsEditor
            id="cs-schedule"
            rows={state.schedule}
            onChange={(rows) => set("schedule", rows)}
            makeRow={() => ({ _k: nextKey(), time: "", activity: "", notes: "" })}
            addLabel="Adicionar horário"
            empty="Nenhum horário ainda. Comece pela saída ou pela chegada da equipe."
            cols={[
              { key: "time", label: "Horário", type: "time", track: "116px", half: true },
              { key: "activity", label: "Atividade", placeholder: "Ex.: Chegada e montagem", track: "minmax(0,1.3fr)" },
              { key: "notes", label: "Observação", placeholder: "Opcional", track: "minmax(0,1fr)" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Equipe"
          description={state.crew.length ? `${state.crew.length} ${state.crew.length > 1 ? "pessoas" : "pessoa"} na ordem do dia` : "Quem vai estar no set."}
          action={
            eventCrew.length ? (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Users /> Puxar equipe <ChevronDown className="-mr-1" />
                  </Button>
                </MenuTrigger>
                <MenuContent className="w-64">
                  <MenuItem onSelect={() => pullCrew(eventCrew, "da diária")}>
                    <Users /> Da diária ligada ({eventCrew.length})
                  </MenuItem>
                  <MenuItem onSelect={() => pullCrew(projectCrew, "do projeto")} disabled={!projectCrew.length}>
                    <Users /> Do projeto ({projectCrew.length})
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => pullCrew(projectCrew, "do projeto")}
                disabled={!projectCrew.length}
                title={projectCrew.length ? undefined : "O projeto ainda não tem equipe."}
              >
                <Users /> Puxar equipe do projeto
              </Button>
            )
          }
        />
        <div className="p-5 sm:p-6">
          <RowsEditor
            id="cs-crew"
            rows={state.crew}
            onChange={(rows) => set("crew", rows)}
            makeRow={() => ({ _k: nextKey(), name: "", role: "", phone: "", call: "" })}
            addLabel="Adicionar pessoa"
            empty={projectCrew.length ? "Ninguém ainda. Use “Puxar equipe” para trazer quem está no projeto." : "Ninguém ainda."}
            cols={[
              { key: "name", label: "Nome", placeholder: "Nome", track: "minmax(0,1.1fr)" },
              { key: "role", label: "Função", placeholder: "Ex.: Direção", track: "minmax(0,1fr)" },
              { key: "phone", label: "Telefone", type: "tel", placeholder: "(84) 90000-0000", track: "156px", half: true },
              { key: "call", label: "Chegada", type: "time", track: "116px", half: true },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Contatos"
          description="Quem procurar no local: recepção, cliente, produção."
          action={
            project.clientContact ? (
              <Button variant="ghost" size="sm" onClick={addClientContact}>
                <UserPlus /> Contato do cliente
              </Button>
            ) : null
          }
        />
        <div className="p-5 sm:p-6">
          <RowsEditor
            id="cs-contacts"
            rows={state.contacts}
            onChange={(rows) => set("contacts", rows)}
            makeRow={() => ({ _k: nextKey(), name: "", role: "", phone: "" })}
            addLabel="Adicionar contato"
            empty="Nenhum contato ainda."
            cols={[
              { key: "name", label: "Nome", placeholder: "Nome", track: "minmax(0,1.1fr)" },
              { key: "role", label: "Quem é", placeholder: "Ex.: Recepção do hotel", track: "minmax(0,1fr)", half: true },
              { key: "phone", label: "Telefone", type: "tel", placeholder: "(84) 90000-0000", track: "180px", half: true },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Observações" description="Autorizações, figurino, alimentação, o que levar." />
        <div className="p-5 sm:p-6">
          <label htmlFor="cs-notes" className="sr-only">
            Observações
          </label>
          <Textarea id="cs-notes" rows={4} value={state.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </Card>

      {/* Barra de salvar: fica presa embaixo enquanto o editor está na tela. */}
      <div
        className="sticky bottom-3 z-30 mt-2"
        onSubmit={() => {
          submitted.current = json;
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line-strong bg-graphite/90 p-2.5 pl-4 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.9)] backdrop-blur-xl">
          <p className={cn("flex items-center gap-2 text-[13px]", dirty ? "text-warn" : "text-mute")} aria-live="polite">
            {dirty ? (
              <>
                <span className="size-1.5 rounded-full bg-warn" aria-hidden /> Alterações não salvas
              </>
            ) : (
              <>
                <Check className="size-3.5" aria-hidden /> Tudo salvo
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={copyWhatsapp} aria-label="Copiar para WhatsApp" title="Copiar para WhatsApp">
              <Copy /> <span className="hidden sm:inline">Copiar para WhatsApp</span>
            </Button>
            <Button variant="secondary" size="md" onClick={print} aria-label="Imprimir" title={dirty ? "Salva e abre a versão para imprimir" : "Versão para imprimir"}>
              <Printer /> <span className="hidden sm:inline">Imprimir</span>
            </Button>
            <ActionForm action={saveCallSheet} onSuccess={() => setSaved(submitted.current)}>
              <input type="hidden" name="id" value={sheet.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <input ref={dataRef} type="hidden" name="data" value={json} />
              <input ref={thenRef} type="hidden" name="then" defaultValue="" />
              <SaveButton dirty={dirty} />
            </ActionForm>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={pending}>
      {pending ? "Salvando…" : "Salvar"}
    </Button>
  );
}
