"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { brl, centsToInput, parseBRL } from "@/lib/format";
import { defaultInstallments, installmentLabels } from "@/lib/services/quotes";
import { cn } from "@/lib/utils";
import { approveQuote, refuseQuote } from "../actions";

/** Roda antes de qualquer ação de status: salva o que estiver pendente no editor. */
export type BeforeAction = () => Promise<boolean>;

function useRunner(before?: BeforeAction) {
  const [pending, start] = useTransition();
  function run(
    task: () => Promise<ActionResult | undefined | void>,
    onOk?: (r: Extract<ActionResult, { ok: true }>) => void,
    opts: { silent?: boolean } = {},
  ) {
    start(async () => {
      if (before && !(await before())) return;
      const result = await task();
      if (!result) return; // redirecionou
      if (result.ok) {
        if (result.message && !opts.silent) toast.success(result.message);
        onOk?.(result);
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

/** Confirmação simples para ações de status (enviar, voltar, nova versão, excluir). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  note,
  action,
  before,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  note?: React.ReactNode;
  action: () => Promise<ActionResult | undefined | void>;
  before?: BeforeAction;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRunner(before);
  return (
    <Modal open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent title={title} description={description} size="sm">
        {note ? <div className="mb-5 text-[14px] text-ash">{note}</div> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            disabled={pending}
            onClick={() => run(action, () => setOpen(false))}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}

type Row = { amount: string; dueDate: string };

function rowsFor(total: number, count: number, today: string): Row[] {
  return defaultInstallments(total, count, today).map((p) => ({ amount: centsToInput(p.amount), dueDate: p.dueDate }));
}

/** Aprovar: parcelas (1 a 3), cria o projeto e os recebimentos. */
export function ApproveDialog({
  quoteId,
  total,
  today,
  clientLabel,
  hasLead,
  trigger,
  before,
}: {
  quoteId: string;
  total: number;
  today: string;
  clientLabel: string;
  hasLead: boolean;
  /** Sem gatilho (orçamento já decidido), a janela só continua aberta para mostrar o resultado. */
  trigger: React.ReactNode | null;
  before?: BeforeAction;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(2);
  const [rows, setRows] = useState<Row[]>(() => rowsFor(total, 2, today));
  const [done, setDone] = useState<{ projectId?: string; message?: string } | null>(null);
  const { pending, run } = useRunner(before);

  const labels = installmentLabels(count);
  const cents = rows.map((r) => parseBRL(r.amount) ?? 0);
  const sum = cents.reduce((s, c) => s + c, 0);
  const diff = total - sum;
  const invalidDate = rows.some((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate));

  function reset(open: boolean) {
    if (pending) return;
    setOpen(open);
    if (open) {
      setCount(2);
      setRows(rowsFor(total, 2, today));
      setDone(null);
    }
  }

  function changeCount(n: number) {
    setCount(n);
    setRows(rowsFor(total, n, today));
  }

  function changeAmount(i: number, value: string) {
    setRows((prev) => {
      const next = prev.map((r, j) => (j === i ? { ...r, amount: value } : r));
      // Mexeu numa parcela que não é a última: a última fecha a conta.
      if (i < next.length - 1) {
        const others = next.slice(0, -1).reduce((s, r) => s + (parseBRL(r.amount) ?? 0), 0);
        const last = total - others;
        if (last > 0) next[next.length - 1] = { ...next[next.length - 1], amount: centsToInput(last) };
      }
      return next;
    });
  }

  function submit() {
    const fd = new FormData();
    fd.set("id", quoteId);
    fd.set("installments", JSON.stringify(rows.map((r, i) => ({ amount: cents[i], dueDate: r.dueDate }))));
    // A própria janela mostra o resultado (com o link do projeto): sem toast repetido.
    run(
      () => approveQuote(null, fd),
      (r) => setDone({ projectId: r.id, message: r.message }),
      { silent: true },
    );
  }

  return (
    <Modal open={open} onOpenChange={reset}>
      {trigger ? <ModalTrigger asChild>{trigger}</ModalTrigger> : null}
      <ModalContent
        title={done ? "Orçamento aprovado" : "Aprovar orçamento"}
        description={done ? undefined : "O projeto e os recebimentos são criados na hora."}
        size="md"
      >
        {done ? (
          <div className="grid gap-5">
            <div className="flex items-start gap-3 rounded-2xl border border-ok/30 bg-ok/[0.06] p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
              <div className="text-[14px]">
                <p className="font-medium text-light">{done.message}</p>
                <p className="mt-1 text-ash">
                  {count === 1 ? "1 recebimento lançado" : `${count} recebimentos lançados`} no financeiro.
                  {hasLead ? " O lead foi para Fechado." : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              {done.projectId ? (
                <ButtonLink href={`/painel/projetos/${done.projectId}`} variant="primary">
                  Abrir projeto
                </ButtonLink>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-end justify-between gap-4 rounded-2xl border border-line bg-white/[0.02] p-4">
              <div>
                <p className="text-[13px] text-ash">Total aprovado</p>
                <p className="mt-1 text-[26px] leading-none font-semibold tracking-[-0.03em] text-white">{brl(total)}</p>
              </div>
              <p className="text-right text-[13px] text-mute">{clientLabel}</p>
            </div>

            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ash">Parcelas</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="Número de parcelas">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={count === n}
                    onClick={() => changeCount(n)}
                    className={cn(
                      "h-10 min-w-16 rounded-full border px-4 text-[14px] transition-colors",
                      count === n ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
                    )}
                  >
                    {n === 1 ? "À vista" : `${n}x`}
                  </button>
                ))}
              </div>
            </fieldset>

            <ol className="grid gap-3">
              {rows.map((r, i) => (
                <li key={`${count}-${i}`} className="grid gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_1fr] sm:items-end">
                  <Field label={`${labels[i][0].toUpperCase()}${labels[i].slice(1)} · ${i + 1}/${count}`} htmlFor={`ap-amount-${i}`}>
                    <MoneyInput
                      id={`ap-amount-${i}`}
                      value={r.amount}
                      onChange={(e) => changeAmount(i, e.target.value)}
                      onBlur={(e) => {
                        const c = parseBRL(e.target.value);
                        if (c != null) setRows((prev) => prev.map((x, j) => (j === i ? { ...x, amount: centsToInput(c) } : x)));
                      }}
                    />
                  </Field>
                  <Field label="Vencimento" htmlFor={`ap-date-${i}`}>
                    <Input
                      id={`ap-date-${i}`}
                      type="date"
                      value={r.dueDate}
                      onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))}
                    />
                  </Field>
                </li>
              ))}
            </ol>

            <p
              className={cn("text-[13px]", diff === 0 ? "text-mute" : "text-warn")}
              role={diff === 0 ? undefined : "alert"}
            >
              {diff === 0
                ? `Soma das parcelas: ${brl(sum)}. Fecha com o total.`
                : diff > 0
                  ? `Faltam ${brl(diff)} para fechar o total.`
                  : `As parcelas passam ${brl(-diff)} do total.`}
            </p>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={submit} disabled={pending || diff !== 0 || invalidDate}>
                {pending ? "Aprovando…" : "Aprovar e criar projeto"}
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}

/** Recusar: motivo opcional e, se fizer sentido, o lead vai para Perdido. */
export function RefuseDialog({
  quoteId,
  hasLead,
  otherOpen,
  trigger,
  before,
}: {
  quoteId: string;
  hasLead: boolean;
  otherOpen: number;
  trigger: React.ReactNode;
  before?: BeforeAction;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [markLost, setMarkLost] = useState(otherOpen === 0);
  const { pending, run } = useRunner(before);

  function submit() {
    const fd = new FormData();
    fd.set("id", quoteId);
    fd.set("reason", reason);
    if (hasLead && markLost) fd.set("markLost", "on");
    run(
      () => refuseQuote(null, fd),
      () => setOpen(false),
    );
  }

  return (
    <Modal open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent title="Recusar orçamento" description="Fica registrado com a data de hoje." size="sm">
        <div className="grid gap-5">
          <Field label="Motivo (opcional)" htmlFor="rf-reason" hint="Ajuda a entender o que não fechou.">
            <Textarea
              id="rf-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: acima do orçamento do cliente, data não bateu"
              maxLength={500}
            />
          </Field>
          {hasLead ? (
            otherOpen > 0 ? (
              <p className="text-[13px] text-mute">
                O lead tem outro orçamento em andamento, então continua aberto no CRM.
              </p>
            ) : (
              <Checkbox
                checked={markLost}
                onChange={(e) => setMarkLost(e.target.checked)}
                label="Marcar o lead como perdido no CRM, com este motivo"
              />
            )
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={submit} disabled={pending}>
              {pending ? "Aguarde…" : "Recusar"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

