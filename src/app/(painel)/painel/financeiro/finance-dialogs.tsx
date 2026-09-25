"use client";

import { createContext, use, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Ellipsis, HandCoins, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionForm, ConfirmAction, FormModal, SubmitButton, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal, ModalContent } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { PAYMENT_METHODS, optionLabel, type FinanceKind } from "@/lib/domain";
import { brl, centsToInput, dateBR, monthLong, todayISO } from "@/lib/format";
import type { EntryPayment, FinanceOptions } from "@/lib/queries/finance";
import { cn } from "@/lib/utils";
import { createEntry, deleteEntry, launchDas, payEntry, removePayment, updateEntry } from "./actions";
import { EntryFields } from "./finance-fields";

/* ---------------- Avisos ---------------- */

type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * Mostra o aviso de sucesso assim que o servidor responde. Pagar, editar ou
 * excluir pode tirar a linha da lista (e o formulário junto) antes do aviso
 * padrão do ActionForm aparecer. Erros continuam com o ActionForm.
 */
function withToast(action: FormAction): FormAction {
  return async (prev, fd) => {
    const result = await action(prev, fd);
    if (!result.ok) return result;
    if (result.message) toast.success(result.message);
    return { ...result, message: undefined };
  };
}

const createEntryAction = withToast(createEntry);
const updateEntryAction = withToast(updateEntry);
const deleteEntryAction = withToast(deleteEntry);
const payEntryAction = withToast(payEntry);
const removePaymentAction = withToast(removePayment);
const launchDasAction = withToast(launchDas);

/* ---------------- Opções dos formulários (uma vez por página) ---------------- */

const OptionsContext = createContext<FinanceOptions>({ projects: [], clients: [], freelancers: [] });

/** Deixa projetos, clientes e freelas disponíveis para todos os formulários da página. */
export function FinanceOptionsProvider({ options, children }: { options: FinanceOptions; children: React.ReactNode }) {
  return <OptionsContext value={options}>{children}</OptionsContext>;
}

/* ---------------- Tipos ---------------- */

/** O que os diálogos precisam de um lançamento. */
export type DialogEntry = {
  id: string;
  kind: string;
  category: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  projectId: string | null;
  clientId: string | null;
  freelancerId: string | null;
  installment: string | null;
  competence: string | null;
  notes: string | null;
};

type PayableEntry = Pick<DialogEntry, "id" | "kind" | "description" | "amount" | "paidAmount">;

const isIn = (kind: string) => kind === "entrada";
const payVerb = (kind: string) => (isIn(kind) ? "Receber" : "Pagar");
const payTitle = (kind: string) => (isIn(kind) ? "Registrar recebimento" : "Registrar pagamento");

/* ---------------- Novo lançamento ---------------- */

export function NewEntryButton({
  defaultKind,
  defaultProjectId,
  label = "Novo lançamento",
}: {
  defaultKind?: FinanceKind;
  defaultProjectId?: string;
  label?: string;
}) {
  const options = use(OptionsContext);
  return (
    <FormModal
      title={label}
      description="Entrada, saída ou imposto. Custo fixo pode repetir por alguns meses."
      action={createEntryAction}
      submitLabel="Lançar"
      size="lg"
      trigger={
        <Button variant="primary">
          <Plus /> {label}
        </Button>
      }
    >
      {(state) => (
        <EntryFields state={state} options={options} defaults={{ kind: defaultKind, projectId: defaultProjectId }} allowRepeat />
      )}
    </FormModal>
  );
}

/* ---------------- Baixa (pagamento ou recebimento) ---------------- */

function PayFields({ state, entry }: { state: ActionResult | null; entry: PayableEntry }) {
  const open = Math.max(0, entry.amount - entry.paidAmount);
  const id = entry.id;
  // Controlados, para o valor digitado sobreviver a um erro de validação.
  const [amount, setAmount] = useState(centsToInput(open));
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  return (
    <>
      <input type="hidden" name="entryId" value={id} />
      <Field
        label={isIn(entry.kind) ? "Valor recebido" : "Valor pago"}
        htmlFor={`p-amount-${id}`}
        hint={`Pode ser parcial. Falta ${brl(open)}.`}
        error={fieldError(state, "amount")}
      >
        <MoneyInput id={`p-amount-${id}`} name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" htmlFor={`p-date-${id}`} error={fieldError(state, "date")}>
          <Input id={`p-date-${id}`} name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Forma" htmlFor={`p-method-${id}`} error={fieldError(state, "method")}>
          <Select id={`p-method-${id}`} name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Observação" htmlFor={`p-notes-${id}`} hint="Opcional." error={fieldError(state, "notes")}>
        <Input
          id={`p-notes-${id}`}
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={300}
          placeholder="Ex.: adiantamento de metade"
        />
      </Field>
    </>
  );
}

/** Botão direto de baixa ("Pagar" / "Receber"), usado nas listas. */
export function PayEntryButton({
  entry,
  size = "sm",
  className,
}: {
  entry: PayableEntry;
  size?: "sm" | "md";
  className?: string;
}) {
  const open = Math.max(0, entry.amount - entry.paidAmount);
  return (
    <FormModal
      title={payTitle(entry.kind)}
      description={`${entry.description} · falta ${brl(open)}`}
      action={payEntryAction}
      submitLabel="Registrar"
      size="sm"
      trigger={
        <Button variant="subtle" size={size} className={className} aria-label={`${payVerb(entry.kind)}: ${entry.description}`}>
          {payVerb(entry.kind)}
        </Button>
      }
    >
      {(state) => <PayFields state={state} entry={entry} />}
    </FormModal>
  );
}

/* ---------------- Ver baixas ---------------- */

/** Botão que envia o formulário da lista com o id desta baixa. */
function DeletePaymentSubmit({ paymentId }: { paymentId: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="paymentId" value={paymentId} variant="danger" size="sm" disabled={pending}>
      {pending ? "Excluindo…" : "Excluir baixa"}
    </Button>
  );
}

function PaymentRow({ payment }: { payment: EntryPayment }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-white tabular-nums">{brl(payment.amount)}</p>
        <p className="mt-0.5 text-[13px] text-mute">
          {dateBR(payment.date)} · {optionLabel(PAYMENT_METHODS, payment.method)}
          {payment.notes ? ` · ${payment.notes}` : ""}
        </p>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Manter
          </Button>
          <DeletePaymentSubmit paymentId={payment.id} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="grid size-10 place-items-center rounded-full text-mute transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label={`Excluir a baixa de ${brl(payment.amount)} de ${dateBR(payment.date)}`}
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

function PaymentsDialog({
  entry,
  payments,
  open,
  onOpenChange,
  onPay,
}: {
  entry: DialogEntry;
  payments: EntryPayment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: () => void;
}) {
  const remaining = Math.max(0, entry.amount - entry.paidAmount);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title={isIn(entry.kind) ? "Recebimentos" : "Pagamentos"}
        description={`${entry.description} · ${brl(entry.paidAmount)} de ${brl(entry.amount)}`}
        size="sm"
      >
        {payments.length ? (
          // Um formulário só para a lista: a linha excluída some com a atualização,
          // mas o formulário (e o aviso de sucesso) continua montado.
          <ActionForm action={removePaymentAction}>
            <ul>
              {payments.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </ul>
          </ActionForm>
        ) : (
          <p className="rounded-2xl border border-line px-4 py-6 text-center text-[14px] text-mute">Nenhuma baixa registrada ainda.</p>
        )}
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-mute">{remaining > 0 ? `Falta ${brl(remaining)}` : "Quitado"}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {remaining > 0 ? (
              <Button variant="primary" onClick={onPay}>
                {payTitle(entry.kind)}
              </Button>
            ) : null}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

/* ---------------- Excluir ---------------- */

function DeleteEntryDialog({
  entry,
  paymentsCount,
  open,
  onOpenChange,
}: {
  entry: DialogEntry;
  paymentsCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const description = paymentsCount
    ? `${entry.description}. ${paymentsCount === 1 ? "A baixa registrada" : `As ${paymentsCount} baixas registradas`} (${brl(entry.paidAmount)}) ${paymentsCount === 1 ? "também é apagada" : "também são apagadas"}.`
    : `${entry.description}. Não dá para desfazer.`;
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Excluir este lançamento?" description={description} size="sm">
        <ActionForm action={deleteEntryAction} onSuccess={() => onOpenChange(false)}>
          <input type="hidden" name="id" value={entry.id} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <SubmitButton variant="danger" pendingLabel="Excluindo…">
              Excluir
            </SubmitButton>
          </div>
        </ActionForm>
      </ModalContent>
    </Modal>
  );
}

/* ---------------- Menu de ações da linha ---------------- */

type Dialog = "pay" | "payments" | "edit" | "delete" | null;

/**
 * Menu "⋯" de um lançamento: registrar baixa, ver baixas, editar e excluir.
 * As janelas ficam fora do menu (controladas), para não fecharem junto com ele.
 */
export function EntryActions({
  entry,
  payments,
  showPay = true,
  className,
}: {
  entry: DialogEntry;
  payments: EntryPayment[];
  /** Mostra o botão direto de baixa ao lado do menu. */
  showPay?: boolean;
  className?: string;
}) {
  const options = use(OptionsContext);
  const [dialog, setDialog] = useState<Dialog>(null);
  const openAmount = Math.max(0, entry.amount - entry.paidAmount);
  const toggle = (name: Exclude<Dialog, null>) => (v: boolean) => setDialog(v ? name : null);

  return (
    <div className={cn("flex items-center justify-end gap-1.5", className)}>
      {showPay && openAmount > 0 ? (
        <Button variant="subtle" size="sm" onClick={() => setDialog("pay")} aria-label={`${payVerb(entry.kind)}: ${entry.description}`}>
          {payVerb(entry.kind)}
        </Button>
      ) : null}
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações: ${entry.description}`}>
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem disabled={openAmount <= 0} onSelect={() => setDialog("pay")}>
            <HandCoins /> {payTitle(entry.kind)}
          </MenuItem>
          <MenuItem onSelect={() => setDialog("payments")}>
            <ListChecks /> Ver baixas{payments.length ? ` (${payments.length})` : ""}
          </MenuItem>
          <MenuItem onSelect={() => setDialog("edit")}>
            <Pencil /> Editar
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => setDialog("delete")}>
            <Trash2 /> Excluir
          </MenuItem>
        </MenuContent>
      </Menu>

      <FormModal
        open={dialog === "pay"}
        onOpenChange={toggle("pay")}
        title={payTitle(entry.kind)}
        description={`${entry.description} · falta ${brl(openAmount)}`}
        action={payEntryAction}
        submitLabel="Registrar"
        size="sm"
      >
        {(state) => <PayFields state={state} entry={entry} />}
      </FormModal>

      <PaymentsDialog
        entry={entry}
        payments={payments}
        open={dialog === "payments"}
        onOpenChange={toggle("payments")}
        onPay={() => setDialog("pay")}
      />

      <FormModal
        open={dialog === "edit"}
        onOpenChange={toggle("edit")}
        title="Editar lançamento"
        description={entry.paidAmount > 0 ? `Já baixado: ${brl(entry.paidAmount)}. As baixas não mudam.` : undefined}
        action={updateEntryAction}
        size="lg"
      >
        {(state) => (
          <EntryFields
            state={state}
            options={options}
            defaults={{
              id: entry.id,
              kind: entry.kind as FinanceKind,
              category: entry.category,
              description: entry.description,
              amount: entry.amount,
              dueDate: entry.dueDate,
              projectId: entry.projectId,
              clientId: entry.clientId,
              freelancerId: entry.freelancerId,
              installment: entry.installment,
              competence: entry.competence,
              notes: entry.notes,
            }}
          />
        )}
      </FormModal>

      <DeleteEntryDialog entry={entry} paymentsCount={payments.length} open={dialog === "delete"} onOpenChange={toggle("delete")} />
    </div>
  );
}

/* ---------------- Impostos ---------------- */

export function LaunchDasButton({
  month,
  amount,
  revenue,
  rate,
  dueDate,
  inProgress,
}: {
  month: string;
  amount: number;
  revenue: number;
  rate: number;
  dueDate: string;
  inProgress: boolean;
}) {
  const name = monthLong(month);
  return (
    <ConfirmAction
      title={`Lançar o DAS de ${name}?`}
      description={`Imposto de ${brl(amount)} (${String(rate).replace(".", ",")}% de ${brl(revenue)} recebidos), vencendo em ${dateBR(dueDate)}.${
        inProgress ? " O mês ainda não acabou: o valor considera só o que entrou até hoje." : ""
      } Dá para ajustar depois em Lançamentos.`}
      confirmLabel="Lançar DAS"
      destructive={false}
      action={launchDasAction}
      fields={{ month }}
      trigger={
        <Button variant="secondary" size="sm" aria-label={`Lançar DAS de ${name}`}>
          <Plus /> Lançar DAS
        </Button>
      }
    />
  );
}
