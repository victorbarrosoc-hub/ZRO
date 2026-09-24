"use client";

import { fieldError } from "@/components/painel/form";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { FUNCTIONS } from "@/lib/domain";
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
};

/** Campos do cadastro de freela (criar e editar usam os mesmos). */
export function FreelaFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: FreelaDefaults }) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
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

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ash">Funções</legend>
        <div className="flex flex-wrap gap-2">
          {FUNCTIONS.map((fn) => (
            <label key={fn.key} className="cursor-pointer">
              <input
                type="checkbox"
                name="functions"
                value={fn.key}
                defaultChecked={defaults.functions?.includes(fn.key)}
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
        </div>
        {fieldError(state, "functions") ? <p className="mt-2 text-[13px] text-danger">{fieldError(state, "functions")}</p> : null}
      </fieldset>

      <Field label="Equipamento próprio" htmlFor="f-eq">
        <Textarea id="f-eq" name="equipment" rows={2} defaultValue={defaults.equipment ?? ""} placeholder="Ex.: câmera full frame, 2 lentes, gimbal" />
      </Field>
      <Field label="Observações" htmlFor="f-notes">
        <Textarea id="f-notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
      </Field>
    </>
  );
}
