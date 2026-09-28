"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { fieldError } from "@/components/painel/form";
import { ImageField } from "@/components/painel/image-field";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { FUNCTION_MAX, functionOptions, normalizeFunction } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type FreelaDefaults = {
  id?: string;
  name?: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  pixKey?: string | null;
  functions?: string[];
  equipment?: string | null;
  notes?: string | null;
  photoId?: string | null;
};

/** Campos do cadastro de freela (criar e editar usam os mesmos). */
export function FreelaFields({
  state,
  defaults = {},
  customFunctions = [],
}: {
  state: ActionResult | null;
  defaults?: FreelaDefaults;
  /** Funções criadas em outros cadastros (aparecem para todos). */
  customFunctions?: string[];
}) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <ImageField name="photo" kind="foto" currentId={defaults.photoId} displayName={defaults.name} error={fieldError(state, "photo")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="f-name" error={fieldError(state, "name")} className="sm:col-span-2">
          <Input id="f-name" name="name" defaultValue={defaults.name} required autoFocus />
        </Field>
        <Field label="Cidade" htmlFor="f-city">
          <Input id="f-city" name="city" defaultValue={defaults.city ?? "Natal/RN"} />
        </Field>
        <Field label="WhatsApp" htmlFor="f-phone">
          <Input id="f-phone" name="phone" inputMode="tel" defaultValue={defaults.phone ?? ""} placeholder="(84) 90000-0000" />
        </Field>
        <Field label="E-mail" htmlFor="f-email" error={fieldError(state, "email")}>
          <Input id="f-email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </Field>
        <Field label="Instagram" htmlFor="f-ig">
          <Input id="f-ig" name="instagram" defaultValue={defaults.instagram ?? ""} placeholder="usuario" />
        </Field>
        <Field label="Chave Pix" htmlFor="f-pix" className="sm:col-span-2" hint="Fica só aqui, para os pagamentos.">
          <Input id="f-pix" name="pixKey" defaultValue={defaults.pixKey ?? ""} />
        </Field>
      </div>

      <FunctionsField state={state} defaults={defaults.functions ?? []} customFunctions={customFunctions} />

      <Field label="Equipamento próprio" htmlFor="f-eq">
        <Textarea id="f-eq" name="equipment" rows={2} defaultValue={defaults.equipment ?? ""} placeholder="Ex.: câmera full frame, 2 lentes, gimbal" />
      </Field>
      <Field label="Observações" htmlFor="f-notes">
        <Textarea id="f-notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
      </Field>
    </>
  );
}

/**
 * Funções do freela: as padrão, as já criadas em outros cadastros e "Outra função"
 * para criar na hora (fica disponível para todo mundo depois de salvar).
 */
function FunctionsField({
  state,
  defaults,
  customFunctions,
}: {
  state: ActionResult | null;
  defaults: string[];
  customFunctions: string[];
}) {
  const [checked, setChecked] = useState<string[]>(defaults);
  const [added, setAdded] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const options = functionOptions([...customFunctions, ...defaults, ...added]);
  const error = fieldError(state, "functions");

  function toggle(key: string, on: boolean) {
    setChecked((prev) => (on ? [...prev, key] : prev.filter((k) => k !== key)));
  }

  function addDraft() {
    const key = normalizeFunction(draft, options.map((o) => o.key));
    if (!key) return;
    if (!options.some((o) => o.key === key)) setAdded((prev) => [...prev, key]);
    setChecked((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setDraft("");
    setAdding(false);
  }

  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-ash">Funções</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((fn) => (
          <label key={fn.key} className="cursor-pointer">
            <input
              type="checkbox"
              name="functions"
              value={fn.key}
              checked={checked.includes(fn.key)}
              onChange={(e) => toggle(fn.key, e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] text-ash transition-colors",
                "peer-checked:border-white peer-checked:bg-white peer-checked:text-void peer-focus-visible:outline-2 peer-focus-visible:outline-white",
              )}
            >
              {fn.label}
            </span>
          </label>
        ))}
        {adding ? (
          <span className="inline-flex h-9 items-center gap-1 rounded-full border border-white/40 bg-white/[0.04] py-0.5 pr-0.5 pl-3.5">
            <input
              aria-label="Nome da nova função"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter aqui cria a função, não envia o cadastro.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="Ex.: Maquiagem"
              maxLength={FUNCTION_MAX}
              autoFocus
              className="w-36 bg-transparent text-[13px] text-light placeholder:text-mute focus:outline-none"
            />
            <button
              type="button"
              onClick={addDraft}
              disabled={!draft.trim()}
              className="h-8 rounded-full bg-white px-3 text-[12px] font-medium text-void transition-opacity disabled:opacity-40"
            >
              Adicionar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/30 px-3.5 text-[13px] text-light transition-colors hover:border-white/60 hover:bg-white/[0.04]"
          >
            <Plus className="size-3.5" aria-hidden /> Outra função
          </button>
        )}
      </div>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
    </fieldset>
  );
}
