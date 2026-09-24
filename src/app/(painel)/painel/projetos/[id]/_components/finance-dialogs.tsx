"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { FINANCE_CATEGORIES, FINANCE_KINDS, PAYMENT_METHODS } from "@/lib/domain";
import { brl, centsToInput, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createProjectEntry, deleteProjectEntry, payProjectEntry } from "../../actions";
import { toastFirst } from "./toast-first";

// Quitar tira o botão da linha; excluir tira a linha; o primeiro lançamento troca a lista vazia.
const payProjectEntryT = toastFirst(payProjectEntry);
const createProjectEntryT = toastFirst(createProjectEntry);
const deleteProjectEntryT = toastFirst(deleteProjectEntry);

type EntryLike = { id: string; kind: string; description: string; amount: number; paidAmount: number };

/** Baixa total ou parcial de um lançamento: "Receber" para entradas, "Pagar" para o resto. */
export function PayEntryButton({ entry, projectId, className }: { entry: EntryLike; projectId: string; className?: string }) {
  const open = Math.max(0, entry.amount - entry.paidAmount);
  const incoming = entry.kind === "entrada";
  return (
    <FormModal
      title={incoming ? "Registrar recebimento" : "Registrar pagamento"}
      description={`${entry.description} · falta ${brl(open)}`}
      action={payProjectEntryT}
      submitLabel="Registrar"
      size="sm"
      trigger={
        <Button variant="subtle" size="sm" className={cn("h-10 lg:h-8", className)}>
          {incoming ? "Registrar recebimento" : "Registrar pagamento"}
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <Field label={incoming ? "Valor recebido" : "Valor pago"} htmlFor={`pay-${entry.id}`} hint="Pode ser parcial." error={fieldError(state, "amount")}>
            <MoneyInput id={`pay-${entry.id}`} name="amount" defaultValue={centsToInput(open)} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" htmlFor={`pay-date-${entry.id}`} error={fieldError(state, "date")}>
              <Input id={`pay-date-${entry.id}`} name="date" type="date" defaultValue={todayISO()} />
            </Field>
            <Field label="Forma" htmlFor={`pay-method-${entry.id}`} error={fieldError(state, "method")}>
              <Select id={`pay-method-${entry.id}`} name="method" defaultValue="pix">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      )}
    </FormModal>
  );
}

function EntryFields({ state, defaultDue }: { state: Parameters<typeof fieldError>[0]; defaultDue: string }) {
  const [kind, setKind] = useState<string>("saida");
  const categories = FINANCE_CATEGORIES.filter((c) => c.kind === kind);
  const [category, setCategory] = useState<string>(categories[0]?.key ?? "");

  return (
    <>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ash">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {FINANCE_KINDS.map((k) => (
            <label key={k.key} className="cursor-pointer">
              <input
                type="radio"
                name="kind"
                value={k.key}
                checked={kind === k.key}
                onChange={() => {
                  setKind(k.key);
                  setCategory(FINANCE_CATEGORIES.find((c) => c.kind === k.key)?.key ?? "");
                }}
                className="peer sr-only"
              />
              <span className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-[13px] text-ash transition-colors peer-checked:border-white peer-checked:bg-white peer-checked:text-void peer-focus-visible:outline-2 peer-focus-visible:outline-white">
                {k.label}
              </span>
            </label>
          ))}
        </div>
        {fieldError(state, "kind") ? <p className="mt-2 text-[13px] text-danger">{fieldError(state, "kind")}</p> : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria" htmlFor="ne-category" error={fieldError(state, "category")}>
          <Select id="ne-category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor" htmlFor="ne-amount" error={fieldError(state, "amount")}>
          <MoneyInput id="ne-amount" name="amount" placeholder="0,00" />
        </Field>
        <Field label="Descrição" htmlFor="ne-description" error={fieldError(state, "description")} className="sm:col-span-2">
          <Input
            id="ne-description"
            name="description"
            placeholder={kind === "entrada" ? "Ex.: Cliente · entrada" : kind === "imposto" ? "Ex.: ISS da nota" : "Ex.: Locação de luz"}
          />
        </Field>
        <Field label="Vencimento" htmlFor="ne-due" error={fieldError(state, "dueDate")}>
          <Input id="ne-due" name="dueDate" type="date" defaultValue={defaultDue} />
        </Field>
        <Field label="Parcela" htmlFor="ne-installment" error={fieldError(state, "installment")} hint="Opcional. Ex.: 1/2">
          <Input id="ne-installment" name="installment" placeholder="1/2" />
        </Field>
      </div>
    </>
  );
}

export function NewEntryButton({ projectId, defaultDue = todayISO() }: { projectId: string; defaultDue?: string }) {
  return (
    <FormModal
      title="Novo lançamento"
      description="Entra no financeiro já ligado a este projeto."
      action={createProjectEntryT}
      submitLabel="Lançar"
      trigger={
        <Button variant="secondary" size="sm">
          <Plus /> Novo lançamento
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <EntryFields state={state} defaultDue={defaultDue} />
        </>
      )}
    </FormModal>
  );
}

export function DeleteEntryButton({ entry, projectId }: { entry: EntryLike; projectId: string }) {
  return (
    <ConfirmAction
      title="Excluir este lançamento?"
      description={`${entry.description} · ${brl(entry.amount)}. As baixas registradas nele também são apagadas.`}
      confirmLabel="Excluir"
      action={deleteProjectEntryT}
      fields={{ entryId: entry.id, projectId }}
      trigger={
        <Button variant="ghost" size="icon" className="text-mute hover:text-danger lg:size-8" aria-label={`Excluir ${entry.description}`}>
          <Trash2 />
        </Button>
      }
    />
  );
}
