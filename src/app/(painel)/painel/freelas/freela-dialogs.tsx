"use client";

import { Archive, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { CATEGORIES, FUNCTIONS, PAYMENT_METHODS, RATE_UNITS } from "@/lib/domain";
import { brl, centsToInput, todayISO } from "@/lib/format";
import {
  addRate,
  createFreelancer,
  deleteFreelancer,
  deleteRate,
  payFreelancerEntry,
  toggleFreelancerActive,
  updateFreelancer,
} from "./actions";
import { FreelaFields, type FreelaDefaults } from "./freela-fields";

export function NewFreelaButton() {
  return (
    <FormModal
      title="Novo freela"
      description="Cadastro para o banco de freelas da ZRO."
      action={createFreelancer}
      submitLabel="Cadastrar"
      size="lg"
      trigger={
        <Button variant="primary">
          <Plus /> Novo freela
        </Button>
      }
    >
      {(state) => <FreelaFields state={state} />}
    </FormModal>
  );
}

export function EditFreelaButton({ defaults }: { defaults: FreelaDefaults }) {
  return (
    <FormModal
      title="Editar freela"
      action={updateFreelancer}
      size="lg"
      trigger={
        <Button variant="secondary" size="sm">
          <Pencil /> Editar
        </Button>
      }
    >
      {(state) => <FreelaFields state={state} defaults={defaults} />}
    </FormModal>
  );
}

export function ArchiveFreelaButton({ id, active }: { id: string; active: boolean }) {
  return (
    <ConfirmAction
      title={active ? "Arquivar este freela?" : "Reativar este freela?"}
      description={active ? "Ele some da lista principal, mas o histórico continua guardado." : "Ele volta para a lista principal."}
      confirmLabel={active ? "Arquivar" : "Reativar"}
      destructive={false}
      action={toggleFreelancerActive}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="sm">
          <Archive /> {active ? "Arquivar" : "Reativar"}
        </Button>
      }
    />
  );
}

export function DeleteFreelaButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      title={`Excluir ${name}?`}
      description="O cadastro e os valores padrão são apagados. Projetos e lançamentos continuam, sem o vínculo."
      confirmLabel="Excluir"
      action={deleteFreelancer}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger">
          <Trash2 /> Excluir
        </Button>
      }
    />
  );
}

export function AddRateButton({ freelancerId, functions }: { freelancerId: string; functions: string[] }) {
  const options = FUNCTIONS.filter((f) => functions.length === 0 || functions.includes(f.key));
  return (
    <FormModal
      title="Valor padrão"
      description="Entra preenchido quando você escalar este freela num projeto ou orçamento."
      action={addRate}
      successMessage="Valor salvo."
      trigger={
        <Button variant="secondary" size="sm">
          <Plus /> Adicionar valor
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="freelancerId" value={freelancerId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Função" htmlFor="r-fn" error={fieldError(state, "function")}>
              <Select id="r-fn" name="function" defaultValue={options[0]?.key}>
                {options.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de job" htmlFor="r-cat" hint="Deixe em branco para valer em qualquer job.">
              <Select id="r-cat" name="category" defaultValue="">
                <option value="">Qualquer</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.short}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor" htmlFor="r-amount" error={fieldError(state, "amount")}>
              <MoneyInput id="r-amount" name="amount" placeholder="0,00" />
            </Field>
            <Field label="Cobrança" htmlFor="r-unit">
              <Select id="r-unit" name="unit" defaultValue="diaria">
                {RATE_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
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

export function DeleteRateButton({ id, freelancerId }: { id: string; freelancerId: string }) {
  return (
    <ConfirmAction
      title="Remover este valor?"
      confirmLabel="Remover"
      action={deleteRate}
      fields={{ id, freelancerId }}
      trigger={
        <button type="button" className="grid size-8 place-items-center rounded-full text-mute hover:bg-white/[0.06] hover:text-light" aria-label="Remover valor">
          <X className="size-4" />
        </button>
      }
    />
  );
}

export function PayEntryButton({
  entry,
  freelancerId,
}: {
  entry: { id: string; description: string; amount: number; paidAmount: number };
  freelancerId: string;
}) {
  const open = entry.amount - entry.paidAmount;
  return (
    <FormModal
      title="Registrar pagamento"
      description={`${entry.description} · falta ${brl(open)}`}
      action={payFreelancerEntry}
      submitLabel="Registrar"
      size="sm"
      trigger={
        <Button variant="subtle" size="sm">
          Pagar
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="freelancerId" value={freelancerId} />
          <Field label="Valor pago" htmlFor="p-amount" hint="Pode ser parcial." error={fieldError(state, "amount")}>
            <MoneyInput id="p-amount" name="amount" defaultValue={centsToInput(open)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" htmlFor="p-date">
              <Input id="p-date" name="date" type="date" defaultValue={todayISO()} />
            </Field>
            <Field label="Forma" htmlFor="p-method">
              <Select id="p-method" name="method" defaultValue="pix">
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
