"use client";

import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { ActionForm, ConfirmAction, FormModal, SubmitButton, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { IconButton } from "../site/_components/list-controls";
import { createKit, deleteKit, deleteTemplate, duplicateTemplate, updateKit } from "./actions";

/* ============================== Modelos ============================== */

export function DuplicateTemplateButton({ id }: { id: string }) {
  return (
    <ActionForm action={duplicateTemplate}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Duplicando…">
        <Copy /> Duplicar
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      title={`Excluir o modelo “${name}”?`}
      description="Projetos que já existem continuam com as tarefas deles. Só os próximos deixam de usar este modelo."
      confirmLabel="Excluir modelo"
      action={deleteTemplate}
      fields={{ id, from: "editor" }}
      trigger={
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger">
          <Trash2 /> Excluir
        </Button>
      }
    />
  );
}

/* ============================== Kits ============================== */

export type KitDefaults = {
  id?: string;
  name?: string;
  description?: string | null;
  items?: { name: string; qty: number }[];
};

type ItemRow = { key: string; name: string; qty: string };

let keySeq = 0;
const newKey = () => `i${++keySeq}`;

function KitFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: KitDefaults }) {
  const [rows, setRows] = useState<ItemRow[]>(() =>
    defaults.items?.length
      ? defaults.items.map((i) => ({ key: newKey(), name: i.name, qty: String(i.qty) }))
      : [{ key: newKey(), name: "", qty: "1" }],
  );
  const listRef = useRef<HTMLUListElement>(null);
  const itemsJson = JSON.stringify(
    rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), qty: Number(r.qty) })),
  );
  const pieces = rows.reduce((s, r) => s + (r.name.trim() ? Number(r.qty) || 0 : 0), 0);

  function addRow() {
    setRows((list) => [...list, { key: newKey(), name: "", qty: "1" }]);
    // Foca o nome da linha nova.
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("input[data-kit-name]");
      inputs?.[inputs.length - 1]?.focus();
    });
  }

  function update(key: string, patch: Partial<ItemRow>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function move(i: number, dir: -1 | 1) {
    setRows((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="items" value={itemsJson} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do kit" htmlFor="kit-name" error={fieldError(state, "name")}>
          <Input id="kit-name" name="name" defaultValue={defaults.name ?? ""} required autoFocus placeholder="Ex.: Câmera B" />
        </Field>
        <Field label="Descrição" htmlFor="kit-description" error={fieldError(state, "description")}>
          <Input id="kit-description" name="description" defaultValue={defaults.description ?? ""} placeholder="Para que serve" />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 flex w-full items-baseline justify-between gap-4 text-[13px] font-medium text-ash">
          Itens
          <span className="font-normal text-mute">
            {rows.filter((r) => r.name.trim()).length} itens · {pieces} peças
          </span>
        </legend>
        <div className="hidden grid-cols-[minmax(0,1fr)_76px_auto] gap-2 px-1 text-[12px] text-mute sm:grid">
          <span>Item</span>
          <span>Qtd.</span>
          <span className="w-[108px]" />
        </div>
        <ul ref={listRef} className="grid gap-2">
          {rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_76px_auto]">
              <input
                data-kit-name
                aria-label={`Item ${i + 1}`}
                value={r.name}
                maxLength={100}
                placeholder="Nome do item"
                onChange={(e) => update(r.key, { name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === rows.length - 1 && r.name.trim()) addRow();
                  }
                }}
                className="h-10 min-w-0 rounded-xl border border-line-strong bg-white/[0.03] px-3 text-[14px] text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
              />
              <input
                aria-label={`Quantidade do item ${i + 1}`}
                value={r.qty}
                inputMode="numeric"
                maxLength={3}
                onChange={(e) => update(r.key, { qty: e.target.value.replace(/\D/g, "") })}
                onBlur={() => update(r.key, { qty: String(Math.max(1, Number(r.qty) || 1)) })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                className="h-10 min-w-0 rounded-xl border border-line-strong bg-white/[0.03] px-3 text-center text-[14px] text-light tabular-nums focus:border-white/50 focus:outline-none"
              />
              <div className="flex items-center">
                <IconButton label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="hidden sm:grid">
                  <ArrowUp />
                </IconButton>
                <IconButton label="Descer" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="hidden sm:grid">
                  <ArrowDown />
                </IconButton>
                <IconButton
                  label="Remover item"
                  disabled={rows.length === 1 && !r.name}
                  onClick={() => setRows((list) => (list.length === 1 ? [{ key: newKey(), name: "", qty: "1" }] : list.filter((x) => x.key !== r.key)))}
                  className="hover:bg-danger/10 hover:text-danger"
                >
                  <X />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
        {fieldError(state, "items") ? (
          <p className="text-[13px] text-danger" role="alert">
            {fieldError(state, "items")}
          </p>
        ) : null}
        <Button variant="secondary" size="sm" onClick={addRow} className="mt-1 w-fit">
          <Plus /> Adicionar item
        </Button>
      </fieldset>
    </>
  );
}

export function NewKitButton() {
  return (
    <FormModal
      title="Novo kit"
      description="Lista pronta para o checklist de equipamento dos projetos."
      action={createKit}
      submitLabel="Criar kit"
      size="lg"
      trigger={
        <Button variant="primary">
          <Plus /> Novo kit
        </Button>
      }
    >
      {(state) => <KitFields state={state} />}
    </FormModal>
  );
}

export function KitActions({ kit }: { kit: Required<Pick<KitDefaults, "id" | "name">> & KitDefaults }) {
  return (
    <div className="flex items-center gap-1">
      <FormModal
        title={`Editar ${kit.name}`}
        action={updateKit}
        size="lg"
        trigger={
          <Button variant="secondary" size="sm">
            <Pencil /> Editar
          </Button>
        }
      >
        {(state) => <KitFields state={state} defaults={kit} />}
      </FormModal>
      <ConfirmAction
        title={`Excluir o kit “${kit.name}”?`}
        description="Checklists que já foram montados nos projetos continuam como estão."
        confirmLabel="Excluir kit"
        action={deleteKit}
        fields={{ id: kit.id }}
        trigger={
          <IconButton label={`Excluir ${kit.name}`} tip={false} className="hover:bg-danger/10 hover:text-danger">
            <Trash2 />
          </IconButton>
        }
      />
    </div>
  );
}
