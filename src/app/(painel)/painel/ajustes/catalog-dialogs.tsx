"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { CATALOG_GROUPS, CATALOG_UNITS } from "@/lib/domain";
import { centsToInput } from "@/lib/format";
import { IconButton, OrderButtons, ToggleSwitch } from "../site/_components/list-controls";
import {
  createCatalogItem,
  deleteCatalogItem,
  moveCatalogItem,
  toggleCatalogActive,
  updateCatalogItem,
} from "./actions";

export type CatalogDefaults = {
  id?: string;
  name?: string;
  description?: string | null;
  group?: string;
  unit?: string;
  price?: number;
  cost?: number;
  active?: boolean;
};

function CatalogFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: CatalogDefaults }) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Field label="Nome do item" htmlFor="cat-name" error={fieldError(state, "name")}>
        <Input id="cat-name" name="name" defaultValue={defaults.name ?? ""} required autoFocus placeholder="Ex.: Diária extra" />
      </Field>
      <Field label="Descrição" htmlFor="cat-desc" error={fieldError(state, "description")} hint="Vai no orçamento, embaixo do nome.">
        <Textarea id="cat-desc" name="description" rows={2} defaultValue={defaults.description ?? ""} maxLength={300} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grupo" htmlFor="cat-group" error={fieldError(state, "group")}>
          <Select id="cat-group" name="group" defaultValue={defaults.group ?? "extra"}>
            {CATALOG_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cobrado por" htmlFor="cat-unit" error={fieldError(state, "unit")}>
          <Select id="cat-unit" name="unit" defaultValue={defaults.unit ?? "unidade"}>
            {CATALOG_UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Preço" htmlFor="cat-price" error={fieldError(state, "price")} hint="Sugerido no orçamento.">
          <MoneyInput id="cat-price" name="price" defaultValue={centsToInput(defaults.price ?? null)} placeholder="0,00" />
        </Field>
        <Field label="Custo (interno)" htmlFor="cat-cost" error={fieldError(state, "cost")} hint="O cliente não vê. Serve para a margem.">
          <MoneyInput id="cat-cost" name="cost" defaultValue={defaults.cost ? centsToInput(defaults.cost) : ""} placeholder="0,00" />
        </Field>
      </div>
      <Checkbox name="active" defaultChecked={defaults.active ?? true} label="Ativo: aparece na lista ao montar um orçamento" />
    </>
  );
}

export function NewCatalogItemButton() {
  return (
    <FormModal
      title="Novo item do catálogo"
      description="Entra no fim do grupo escolhido."
      action={createCatalogItem}
      submitLabel="Adicionar"
      trigger={
        <Button variant="primary">
          <Plus /> Novo item
        </Button>
      }
    >
      {(state) => <CatalogFields state={state} />}
    </FormModal>
  );
}

/** Nome do item que abre a edição. */
export function EditCatalogItemButton({ item }: { item: Required<Pick<CatalogDefaults, "id" | "name">> & CatalogDefaults }) {
  return (
    <FormModal
      title="Editar item"
      action={updateCatalogItem}
      trigger={
        <button type="button" className="group grid text-left">
          <span className="text-[14px] text-light group-hover:underline group-hover:decoration-white/30 group-hover:underline-offset-4">
            {item.name}
          </span>
          {item.description ? <span className="line-clamp-1 text-[12px] text-mute">{item.description}</span> : null}
        </button>
      }
    >
      {(state) => <CatalogFields state={state} defaults={item} />}
    </FormModal>
  );
}

function PencilTrigger({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <IconButton label={label} tip={false} {...props}>
      <Pencil />
    </IconButton>
  );
}

export function CatalogRowActions({
  item,
  first,
  last,
  quotes,
}: {
  item: Required<Pick<CatalogDefaults, "id" | "name" | "active">> & CatalogDefaults;
  first: boolean;
  last: boolean;
  quotes: number;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <ToggleSwitch
        action={toggleCatalogActive}
        fields={{ id: item.id }}
        checked={item.active}
        label={`${item.name} ativo nos orçamentos`}
        onLabel="Ativo"
        offLabel="Inativo"
      />
      <OrderButtons action={moveCatalogItem} id={item.id} first={first} last={last} name={item.name} />
      <FormModal title="Editar item" action={updateCatalogItem} trigger={<PencilTrigger label={`Editar ${item.name}`} />}>
        {(state) => <CatalogFields state={state} defaults={item} />}
      </FormModal>
      <ConfirmAction
        title={`Excluir “${item.name}”?`}
        description={
          quotes
            ? `Está em ${quotes} orçamento${quotes === 1 ? "" : "s"}: eles continuam com o texto e o valor. Para só tirar da lista, desative.`
            : "Sai do catálogo. Para só tirar da lista dos orçamentos, desative."
        }
        confirmLabel="Excluir item"
        action={deleteCatalogItem}
        fields={{ id: item.id }}
        trigger={
          <IconButton label={`Excluir ${item.name}`} tip={false} className="hover:bg-danger/10 hover:text-danger">
            <Trash2 />
          </IconButton>
        }
      />
    </div>
  );
}
