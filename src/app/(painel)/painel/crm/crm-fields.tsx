"use client";

import { useState } from "react";
import { FormSection, fieldError } from "@/components/painel/form";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
  LEAD_SOURCES,
} from "@/lib/domain";
import { addDaysISO, centsToInput, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LOST_REASONS } from "./crm-options";

type Option = { key: string; label: string };

/* ---------------- Peças ---------------- */

/** Grupo de opções em cápsula (rádio ou caixa de seleção), no estilo dos filtros. */
export function ChoiceChips({
  name,
  options,
  type = "radio",
  defaultValue,
  legend,
  error,
}: {
  name: string;
  options: readonly Option[];
  type?: "radio" | "checkbox";
  defaultValue?: string | string[] | null;
  legend?: string;
  error?: string;
}) {
  const selected = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  return (
    <fieldset>
      {legend ? <legend className="mb-2 text-[13px] font-medium text-ash">{legend}</legend> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.key} className="cursor-pointer">
            <input
              type={type}
              name={name}
              value={o.key}
              defaultChecked={selected.includes(o.key)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] text-ash transition-colors hover:border-white/30 hover:text-light",
                "peer-checked:border-white peer-checked:bg-white peer-checked:text-void peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
    </fieldset>
  );
}

/** Select nativo de uma lista do domínio, com a opção vazia "Não informado". */
function OptionSelect({
  id,
  name,
  options,
  defaultValue,
  emptyLabel = "Não informado",
}: {
  id: string;
  name: string;
  options: readonly Option[];
  defaultValue?: string | null;
  emptyLabel?: string | null;
}) {
  return (
    <Select id={id} name={name} defaultValue={defaultValue ?? ""}>
      {emptyLabel != null ? <option value="">{emptyLabel}</option> : null}
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Data de retorno com atalhos (amanhã, 3 dias, 1 semana). */
export function FollowUpInput({ id, name = "followUpAt", defaultValue }: { id: string; name?: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const today = todayISO();
  const shortcuts = [
    { label: "Amanhã", value: addDaysISO(today, 1) },
    { label: "Em 3 dias", value: addDaysISO(today, 3) },
    { label: "Em 1 semana", value: addDaysISO(today, 7) },
  ];
  return (
    <div className="grid gap-2">
      <Input id={id} name={name} type="date" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setValue(s.value)}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-[12px] transition-colors",
              value === s.value ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
            )}
          >
            {s.label}
          </button>
        ))}
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            className="inline-flex h-8 items-center rounded-full px-3 text-[12px] text-mute hover:text-light"
          >
            Sem retorno
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Lead ---------------- */

export type LeadDefaults = {
  id?: string;
  name?: string;
  company?: string | null;
  segment?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  projectType?: string | null;
  budget?: string | null;
  idea?: string | null;
  timing?: string | null;
  city?: string | null;
  days?: string | null;
  videos?: string | null;
  format?: string | null;
  extras?: string[] | null;
  estimatedValue?: number | null;
  followUpAt?: string | null;
  notes?: string | null;
};

/**
 * Campos do lead. "create" é o cadastro manual (curto); "edit" traz também
 * as respostas do funil, para completar o que o cliente contou.
 */
export function LeadFields({
  state,
  defaults = {},
  mode,
}: {
  state: ActionResult | null;
  defaults?: LeadDefaults;
  mode: "create" | "edit";
}) {
  const err = (name: string) => fieldError(state, name);
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormSection title="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="l-name" error={err("name")}>
            <Input id="l-name" name="name" defaultValue={defaults.name} autoFocus={mode === "create"} autoComplete="off" />
          </Field>
          <Field label="Empresa" htmlFor="l-company" error={err("company")}>
            <Input id="l-company" name="company" defaultValue={defaults.company ?? ""} autoComplete="off" />
          </Field>
          <Field label="WhatsApp" htmlFor="l-phone" error={err("phone")}>
            <Input id="l-phone" name="phone" inputMode="tel" defaultValue={defaults.phone ?? ""} placeholder="(84) 90000-0000" />
          </Field>
          <Field label="E-mail" htmlFor="l-email" error={err("email")}>
            <Input id="l-email" name="email" type="email" defaultValue={defaults.email ?? ""} />
          </Field>
          <Field label="Segmento" htmlFor="l-segment" error={err("segment")}>
            <Input id="l-segment" name="segment" defaultValue={defaults.segment ?? ""} placeholder="Ex.: hotelaria, saúde, moda" />
          </Field>
          <Field label="Como chegou" htmlFor="l-source" error={err("source")}>
            <OptionSelect id="l-source" name="source" options={LEAD_SOURCES} defaultValue={defaults.source ?? "whatsapp"} emptyLabel={null} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={mode === "create" ? "Pedido" : "O que o cliente contou"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de projeto" htmlFor="l-type" error={err("projectType")}>
            <OptionSelect id="l-type" name="projectType" options={FUNNEL_PROJECT_TYPES} defaultValue={defaults.projectType} />
          </Field>
          <Field label="Investimento" htmlFor="l-budget" error={err("budget")}>
            <OptionSelect id="l-budget" name="budget" options={FUNNEL_BUDGETS} defaultValue={defaults.budget} />
          </Field>
          {mode === "edit" ? (
            <>
              <Field label="A ideia" htmlFor="l-idea" error={err("idea")} className="sm:col-span-2">
                <Textarea id="l-idea" name="idea" rows={3} defaultValue={defaults.idea ?? ""} />
              </Field>
              <Field label="Quando" htmlFor="l-timing" error={err("timing")}>
                <Input id="l-timing" name="timing" defaultValue={defaults.timing ?? ""} placeholder="Ex.: novembro/2026" />
              </Field>
              <Field label="Onde" htmlFor="l-city" error={err("city")}>
                <Input id="l-city" name="city" defaultValue={defaults.city ?? ""} placeholder="Ex.: Natal/RN" />
              </Field>
              <Field label="Diárias" htmlFor="l-days" error={err("days")}>
                <OptionSelect id="l-days" name="days" options={FUNNEL_DAYS} defaultValue={defaults.days} />
              </Field>
              <Field label="Vídeos" htmlFor="l-videos" error={err("videos")}>
                <OptionSelect id="l-videos" name="videos" options={FUNNEL_VIDEOS} defaultValue={defaults.videos} />
              </Field>
              <Field label="Formato" htmlFor="l-format" error={err("format")} className="sm:col-span-2">
                <OptionSelect id="l-format" name="format" options={FUNNEL_FORMATS} defaultValue={defaults.format} />
              </Field>
            </>
          ) : null}
        </div>
        {mode === "edit" ? (
          <ChoiceChips type="checkbox" name="extras" legend="Extras" options={FUNNEL_EXTRAS} defaultValue={defaults.extras ?? []} error={err("extras")} />
        ) : null}
      </FormSection>

      <FormSection title="Controle">
        <LeadControlInputs state={state} defaults={defaults} />
      </FormSection>
    </>
  );
}

/** Valor estimado, retorno e observações (usados no cadastro e no cartão "Controle"). */
function LeadControlInputs({ state, defaults }: { state: ActionResult | null; defaults: LeadDefaults }) {
  const err = (name: string) => fieldError(state, name);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Valor estimado" htmlFor="l-value" hint="Quanto você imagina que o projeto vale." error={err("estimatedValue")}>
        <MoneyInput id="l-value" name="estimatedValue" defaultValue={centsToInput(defaults.estimatedValue)} placeholder="0,00" />
      </Field>
      <Field label="Retornar em" htmlFor="l-follow" error={err("followUpAt")}>
        <FollowUpInput id="l-follow" defaultValue={defaults.followUpAt} />
      </Field>
      <Field label="Observações" htmlFor="l-notes" error={err("notes")} className="sm:col-span-2">
        <Textarea id="l-notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
      </Field>
    </div>
  );
}

export function LeadControlFields({ state, defaults }: { state: ActionResult | null; defaults: LeadDefaults }) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <LeadControlInputs state={state} defaults={defaults} />
    </>
  );
}

/** Motivo da perda, com atalhos para os motivos mais comuns. */
export function LostReasonField({ state, defaultValue }: { state: ActionResult | null; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {LOST_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setValue(r)}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-[12px] transition-colors",
              value === r ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <Field label="Motivo" htmlFor="lost-reason" error={fieldError(state, "lostReason")}>
        <Textarea
          id="lost-reason"
          name="lostReason"
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="O que aconteceu? Ajuda a entender o funil depois."
        />
      </Field>
    </div>
  );
}

/* ---------------- Cliente ---------------- */

export type ClientDefaults = {
  id?: string;
  name?: string;
  segment?: string | null;
  city?: string | null;
  document?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  source?: string | null;
  notes?: string | null;
};

export function ClientFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: ClientDefaults }) {
  const err = (name: string) => fieldError(state, name);
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <FormSection title="Empresa">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="c-name" error={err("name")} className="sm:col-span-2">
            <Input id="c-name" name="name" defaultValue={defaults.name} autoFocus={!defaults.id} autoComplete="off" />
          </Field>
          <Field label="Segmento" htmlFor="c-segment" error={err("segment")}>
            <Input id="c-segment" name="segment" defaultValue={defaults.segment ?? ""} placeholder="Ex.: hotelaria" />
          </Field>
          <Field label="Cidade" htmlFor="c-city" error={err("city")}>
            <Input id="c-city" name="city" defaultValue={defaults.city ?? (defaults.id ? "" : "Natal/RN")} />
          </Field>
          <Field label="CNPJ ou CPF" htmlFor="c-doc" error={err("document")}>
            <Input id="c-doc" name="document" inputMode="numeric" defaultValue={defaults.document ?? ""} placeholder="Só números ou com pontuação" />
          </Field>
          <Field label="Como chegou" htmlFor="c-source" error={err("source")}>
            <OptionSelect id="c-source" name="source" options={LEAD_SOURCES} defaultValue={defaults.source ?? "indicacao"} emptyLabel={null} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pessoa de contato" htmlFor="c-contact" error={err("contactName")}>
            <Input id="c-contact" name="contactName" defaultValue={defaults.contactName ?? ""} autoComplete="off" />
          </Field>
          <Field label="WhatsApp" htmlFor="c-phone" error={err("phone")}>
            <Input id="c-phone" name="phone" inputMode="tel" defaultValue={defaults.phone ?? ""} placeholder="(84) 90000-0000" />
          </Field>
          <Field label="E-mail" htmlFor="c-email" error={err("email")}>
            <Input id="c-email" name="email" type="email" defaultValue={defaults.email ?? ""} />
          </Field>
          <Field label="Instagram" htmlFor="c-ig" error={err("instagram")}>
            <Input id="c-ig" name="instagram" defaultValue={defaults.instagram ?? ""} placeholder="usuario" />
          </Field>
        </div>
      </FormSection>

      <Field label="Observações" htmlFor="c-notes" error={err("notes")}>
        <Textarea id="c-notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
      </Field>
    </>
  );
}
