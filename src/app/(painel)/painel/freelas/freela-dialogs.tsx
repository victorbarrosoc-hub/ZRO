"use client";

import { useState } from "react";
import { Archive, MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { CATEGORIES, FREELA_WHATSAPP_DEFAULT, FREELA_WHATSAPP_MAX, PAYMENT_METHODS, RATE_UNITS, freelaWhatsappText, functionOptions } from "@/lib/domain";
import { brl, centsToInput, todayISO } from "@/lib/format";
import {
  addRate,
  createFreelancer,
  deleteFreelancer,
  deleteRate,
  payFreelancerEntry,
  saveFreelaWhatsappMessage,
  toggleFreelancerActive,
  updateFreelancer,
} from "./actions";
import type { EquipmentOption } from "./equipment-picker";
import { FreelaFields, type FreelaDefaults } from "./freela-fields";

export function NewFreelaButton({
  customFunctions = [],
  equipmentCatalog = [],
}: {
  customFunctions?: string[];
  equipmentCatalog?: EquipmentOption[];
}) {
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
      {(state) => <FreelaFields state={state} customFunctions={customFunctions} equipmentCatalog={equipmentCatalog} />}
    </FormModal>
  );
}

export function EditFreelaButton({
  defaults,
  customFunctions = [],
  equipmentCatalog = [],
}: {
  defaults: FreelaDefaults;
  customFunctions?: string[];
  equipmentCatalog?: EquipmentOption[];
}) {
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
      {(state) => (
        <FreelaFields state={state} defaults={defaults} customFunctions={customFunctions} equipmentCatalog={equipmentCatalog} />
      )}
    </FormModal>
  );
}

/** Mensagem do WhatsApp desse freela, com prévia de como chega. */
export function WhatsappMessageButton({ id, name, message }: { id: string; name: string; message: string | null }) {
  return (
    <FormModal
      title="Mensagem do WhatsApp"
      description={`O texto que já vem escrito quando você abre a conversa com ${name.split(" ")[0]}.`}
      action={saveFreelaWhatsappMessage}
      trigger={
        <Button variant="secondary" size="sm">
          <MessageSquareText /> Mensagem
        </Button>
      }
    >
      {(state) => <WhatsappMessageFields state={state} id={id} name={name} message={message} />}
    </FormModal>
  );
}

function WhatsappMessageFields({
  state,
  id,
  name,
  message,
}: {
  state: ActionResult | null;
  id: string;
  name: string;
  message: string | null;
}) {
  const [text, setText] = useState(message ?? FREELA_WHATSAPP_DEFAULT);
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <Field
        label="Mensagem"
        htmlFor="wa-msg"
        error={fieldError(state, "message")}
        hint="Escreva {nome} onde entra o primeiro nome do freela."
      >
        <Textarea
          id="wa-msg"
          name="message"
          rows={4}
          maxLength={FREELA_WHATSAPP_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </Field>
      <div className="grid gap-2">
        <p className="label text-mute">Como chega</p>
        <p className="w-fit max-w-full rounded-2xl rounded-tr-sm border border-line-strong bg-white/[0.06] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line text-white">
          {freelaWhatsappText(text, name)}
        </p>
      </div>
      {text.trim() !== FREELA_WHATSAPP_DEFAULT ? (
        <button
          type="button"
          onClick={() => setText(FREELA_WHATSAPP_DEFAULT)}
          className="w-fit text-[13px] text-ash underline decoration-white/20 underline-offset-4 hover:text-light"
        >
          Voltar para a mensagem padrão
        </button>
      ) : null}
    </>
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
  const options = functionOptions(functions).filter((f) => functions.length === 0 || functions.includes(f.key));
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
