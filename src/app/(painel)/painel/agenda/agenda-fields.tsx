"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fieldError } from "@/components/painel/form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { EVENT_TYPES, FUNCTIONS, optionLabel } from "@/lib/domain";
import { todayISO } from "@/lib/format";
import type { AgendaOptions, Booking } from "@/lib/queries/agenda";
import { cn } from "@/lib/utils";
import { rangesOverlap } from "./agenda-utils";

export type EventDefaults = {
  id?: string;
  type?: string;
  title?: string;
  projectId?: string | null;
  date?: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  crew?: { freelancerId: string; function: string | null }[];
};

/**
 * Campos do evento (criar e editar). Tudo controlado: se o servidor recusar,
 * nada do que foi digitado se perde.
 */
export function EventFields({
  state,
  defaults = {},
  options,
  bookings,
}: {
  state: ActionResult | null;
  defaults?: EventDefaults;
  options: AgendaOptions;
  bookings: Booking[];
}) {
  const [type, setType] = useState(defaults.type ?? "diaria");
  const [title, setTitle] = useState(defaults.title ?? "");
  const [projectId, setProjectId] = useState(defaults.projectId ?? "");
  const [date, setDate] = useState(defaults.date ?? todayISO());
  const [endDate, setEndDate] = useState(defaults.endDate ?? "");
  const [startTime, setStartTime] = useState(defaults.startTime ?? "");
  const [endTime, setEndTime] = useState(defaults.endTime ?? "");
  const [location, setLocation] = useState(defaults.location ?? "");
  const [notes, setNotes] = useState(defaults.notes ?? "");
  const [crew, setCrew] = useState<Record<string, string>>(() =>
    Object.fromEntries((defaults.crew ?? []).map((c) => [c.freelancerId, c.function ?? ""])),
  );

  const activeProjects = options.projects.filter((p) => p.status === "ativo" || p.status === "pausado" || p.id === projectId);
  const otherProjects = options.projects.filter((p) => !activeProjects.includes(p));

  // Freelas ativos + quem já está na equipe (mesmo arquivado).
  const people = options.freelancers.filter((f) => f.active || f.id in crew);

  const end = endDate && endDate > date ? endDate : date;
  const busy = useMemo(() => {
    const map = new Map<string, Booking[]>();
    if (!date) return map;
    for (const b of bookings) {
      if (b.eventId === defaults.id) continue;
      if (!rangesOverlap(b.date, b.endDate && b.endDate > b.date ? b.endDate : b.date, date, end)) continue;
      map.set(b.freelancerId, [...(map.get(b.freelancerId) ?? []), b]);
    }
    return map;
  }, [bookings, date, end, defaults.id]);

  const selectedCount = Object.keys(crew).length;

  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ash">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <label key={t.key} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t.key}
                checked={type === t.key}
                onChange={() => setType(t.key)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-[13px] text-ash transition-colors",
                  "peer-checked:border-white peer-checked:bg-white peer-checked:text-void peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
                )}
              >
                {t.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 [&>div]:content-start">
        <Field label="Título" htmlFor="ev-title" error={fieldError(state, "title")} className="sm:col-span-2">
          <Input
            id="ev-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "diaria" ? "Ex.: Diária 3 · Pipa" : type === "entrega" ? "Ex.: Entrega do lote 1" : "Ex.: Aprovação do corte"}
            aria-invalid={fieldError(state, "title") ? true : undefined}
            autoFocus={!defaults.id}
          />
        </Field>

        <Field label="Projeto" htmlFor="ev-project" hint="Opcional. Reuniões soltas podem ficar sem projeto." className="sm:col-span-2">
          <Select id="ev-project" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Sem projeto</option>
            <optgroup label="Em andamento">
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.title}
                </option>
              ))}
            </optgroup>
            {otherProjects.length ? (
              <optgroup label="Concluídos e cancelados">
                {otherProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>

        <Field label="Data" htmlFor="ev-date" error={fieldError(state, "date")}>
          <Input
            id="ev-date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={fieldError(state, "date") ? true : undefined}
          />
        </Field>
        <Field label="Até" htmlFor="ev-end" hint="Só para eventos de mais de um dia." error={fieldError(state, "endDate")}>
          <Input
            id="ev-end"
            name="endDate"
            type="date"
            value={endDate}
            min={date || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={fieldError(state, "endDate") ? true : undefined}
          />
        </Field>
        <Field label="Início" htmlFor="ev-start" error={fieldError(state, "startTime")}>
          <Input id="ev-start" name="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="Fim" htmlFor="ev-finish" error={fieldError(state, "endTime")}>
          <Input id="ev-finish" name="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
        <Field label="Local" htmlFor="ev-location" className="sm:col-span-2">
          <Input
            id="ev-location"
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex.: SERHS Pipa"
          />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 flex w-full items-baseline justify-between gap-3 text-[13px] font-medium text-ash">
          <span>Equipe</span>
          <span className="text-[12px] font-normal text-mute">
            {selectedCount ? `${selectedCount} escalado${selectedCount > 1 ? "s" : ""}` : "Ninguém escalado"}
          </span>
        </legend>
        {people.length ? (
          <ul className="grid overflow-hidden rounded-field border border-line-strong">
            {people.map((f) => {
              const checked = f.id in crew;
              const clash = busy.get(f.id);
              // As funções do freela primeiro, depois as outras.
              const fnOptions = [
                ...FUNCTIONS.filter((x) => f.functions.includes(x.key)),
                ...FUNCTIONS.filter((x) => !f.functions.includes(x.key)),
              ];
              return (
                <li
                  key={f.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3.5 py-3 last:border-b-0 transition-colors",
                    checked && "bg-white/[0.04]",
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <span className="relative mt-0.5 grid size-5 shrink-0">
                      <input
                        type="checkbox"
                        name="crew"
                        value={f.id}
                        checked={checked}
                        onChange={(e) =>
                          setCrew((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) next[f.id] = f.functions[0] ?? "";
                            else delete next[f.id];
                            return next;
                          })
                        }
                        className="peer size-5 cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-white/[0.03] transition-colors checked:border-white checked:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      />
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="pointer-events-none absolute inset-0 hidden p-[3px] text-void peer-checked:block"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] text-light">
                        {f.name}
                        {!f.active ? <span className="text-mute"> · arquivado</span> : null}
                      </span>
                      <span className="block text-[12px] text-mute">
                        {f.functions.length ? f.functions.map((k) => optionLabel(FUNCTIONS, k)).join(" · ") : "Sem função cadastrada"}
                      </span>
                      {clash ? (
                        <span className="mt-1 flex items-start gap-1.5 text-[12px] text-warn">
                          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                          <span>
                            Já está em {clash.map((b) => `“${b.title}”`).join(" e ")} {end === date ? "nesse dia" : "nesse período"}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {checked ? (
                    <div className="w-full sm:w-52">
                      <label htmlFor={`ev-fn-${f.id}`} className="sr-only">
                        Função de {f.name}
                      </label>
                      <Select
                        id={`ev-fn-${f.id}`}
                        name={`fn:${f.id}`}
                        value={crew[f.id] ?? ""}
                        onChange={(e) => setCrew((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        className="h-10 text-[14px]"
                      >
                        <option value="">Sem função</option>
                        {fnOptions.map((fn) => (
                          <option key={fn.key} value={fn.key}>
                            {fn.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-field border border-dashed border-line-strong px-4 py-3 text-[13px] text-mute">
            Nenhum freela ativo. Cadastre a equipe em Freelas.
          </p>
        )}
      </fieldset>

      <Field label="Observações" htmlFor="ev-notes">
        <Textarea id="ev-notes" name="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </>
  );
}
