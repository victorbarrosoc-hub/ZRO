"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_NAME_MAX } from "@/lib/domain";
import { createEquipment, deleteEquipment, updateEquipment } from "./actions";

type Defaults = { id?: string; name?: string; category?: string };

function EquipmentFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: Defaults }) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Field label="Nome" htmlFor="eq-name" error={fieldError(state, "name")}>
        <Input id="eq-name" name="name" defaultValue={defaults.name} maxLength={EQUIPMENT_NAME_MAX} placeholder="Ex.: Sony FX3" required autoFocus />
      </Field>
      <Field label="Categoria" htmlFor="eq-cat" error={fieldError(state, "category")}>
        <Select id="eq-cat" name="category" defaultValue={defaults.category ?? "camera"}>
          {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function NewEquipmentButton({ category }: { category?: string }) {
  return (
    <FormModal
      title="Novo equipamento"
      action={createEquipment}
      submitLabel="Adicionar"
      trigger={
        <Button variant="primary">
          <Plus /> Novo equipamento
        </Button>
      }
    >
      {(state) => <EquipmentFields state={state} defaults={{ category }} />}
    </FormModal>
  );
}

export function EditEquipmentButton({ id, name, category }: Required<Defaults>) {
  return (
    <FormModal
      title="Editar equipamento"
      action={updateEquipment}
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Editar ${name}`}>
          <Pencil />
        </Button>
      }
    >
      {(state) => <EquipmentFields state={state} defaults={{ id, name, category }} />}
    </FormModal>
  );
}

export function DeleteEquipmentButton({ id, name, owners }: { id: string; name: string; owners: number }) {
  return (
    <ConfirmAction
      title={`Excluir ${name}?`}
      description={
        owners
          ? `Sai do banco e do cadastro de ${owners} freela${owners === 1 ? "" : "s"}.`
          : "Sai do banco de equipamentos."
      }
      confirmLabel="Excluir"
      action={deleteEquipment}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Excluir ${name}`} className="text-mute hover:text-danger">
          <Trash2 />
        </Button>
      }
    />
  );
}
