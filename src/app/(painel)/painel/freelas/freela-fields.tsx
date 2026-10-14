"use client";

import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { fieldError } from "@/components/painel/form";
import { ImageField } from "@/components/painel/image-field";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { FUNCTION_MAX, functionOptions, normalizeFunction } from "@/lib/domain";
import { instagramHandle, instagramUrl, isValidCpf, maskDocument } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EquipmentPicker, type EquipmentOption } from "./equipment-picker";

export type FreelaDefaults = {
  id?: string;
  name?: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  document?: string | null;
  pixKey?: string | null;
  functions?: string[];
  equipment?: EquipmentOption[];
  notes?: string | null;
  photoId?: string | null;
};

/** Campos do cadastro de freela (criar e editar usam os mesmos). */
export function FreelaFields({
  state,
  defaults = {},
  customFunctions = [],
  equipmentCatalog = [],
}: {
  state: ActionResult | null;
  defaults?: FreelaDefaults;
  /** Funções criadas em outros cadastros (aparecem para todos). */
  customFunctions?: string[];
  /** Banco de equipamentos. */
  equipmentCatalog?: EquipmentOption[];
}) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <ImageField name="photo" kind="foto" currentId={defaults.photoId} displayName={defaults.name} error={fieldError(state, "photo")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="f-name" error={fieldError(state, "name")} className="sm:col-span-2">
          <Input id="f-name" name="name" defaultValue={defaults.name} required autoFocus />
        </Field>
        <CpfField defaultValue={defaults.document ?? ""} error={fieldError(state, "document")} />
        <Field label="Cidade" htmlFor="f-city">
          <Input id="f-city" name="city" defaultValue={defaults.city ?? "Natal/RN"} />
        </Field>
        <Field label="WhatsApp" htmlFor="f-phone">
          <Input id="f-phone" name="phone" inputMode="tel" defaultValue={defaults.phone ?? ""} placeholder="(84) 90000-0000" />
        </Field>
        <Field label="E-mail" htmlFor="f-email" error={fieldError(state, "email")}>
          <Input id="f-email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </Field>
        <InstagramField defaultValue={defaults.instagram ?? ""} />
        <Field label="Chave Pix" htmlFor="f-pix" className="sm:col-span-2" hint="Fica só aqui, para os pagamentos.">
          <Input id="f-pix" name="pixKey" defaultValue={defaults.pixKey ?? ""} />
        </Field>
      </div>

      <FunctionsField state={state} defaults={defaults.functions ?? []} customFunctions={customFunctions} />

      <EquipmentPicker catalog={equipmentCatalog} defaults={defaults.equipment ?? []} />
      <Field label="Observações" htmlFor="f-notes">
        <Textarea id="f-notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
      </Field>
    </>
  );
}

/** CPF com máscara enquanto digita (aceita CNPJ, para quem é MEI). */
function CpfField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const [value, setValue] = useState(maskDocument(defaultValue));
  const digits = value.replace(/\D/g, "");
  const wrong = digits.length === 11 && !isValidCpf(digits);
  return (
    <Field label="CPF" htmlFor="f-doc" error={error ?? (wrong ? "Confira os números: esse CPF não fecha." : undefined)}>
      <Input
        id="f-doc"
        name="document"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(maskDocument(e.target.value))}
        placeholder="000.000.000-00"
        className="font-mono"
      />
    </Field>
  );
}

/**
 * @ do Instagram com atalho para o perfil: dali dá para salvar a foto e
 * escolher (ou colar) no campo de foto, sem sair do cadastro.
 */
function InstagramField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const url = instagramUrl(value);
  return (
    <Field label="Instagram" htmlFor="f-ig" hint={url ? "Abra o perfil para salvar a foto e usar aqui em cima." : undefined}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-mute">@</span>
          <Input
            id="f-ig"
            name="instagram"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setValue(instagramHandle(value) ?? "")}
            className="pl-8"
            placeholder="usuario"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px] text-light transition-colors hover:border-white/60 hover:bg-white/[0.04]"
          >
            <ExternalLink className="size-3.5" aria-hidden /> Abrir perfil
          </a>
        ) : null}
      </div>
    </Field>
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
