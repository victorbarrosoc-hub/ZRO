"use client";

import { useState } from "react";
import { Pencil, Receipt, Trash2, UserPlus } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { FUNCTIONS, RATE_UNITS, optionLabel } from "@/lib/domain";
import { brl, centsToInput, dateBR } from "@/lib/format";
import { addCrewMember, deleteCrewMember, generateCrewPayment, updateCrewMember } from "../../actions";
import { toastFirst } from "./run-action";

// Estas respostas mudam a própria linha (ou a lista vazia): o aviso sai antes da tela mudar.
const addCrewMemberT = toastFirst(addCrewMember);
const deleteCrewMemberT = toastFirst(deleteCrewMember);
const generateCrewPaymentT = toastFirst(generateCrewPayment);
const updateCrewMemberT = toastFirst(updateCrewMember);

export type CrewOption = {
  id: string;
  name: string;
  functions: string[];
  active: boolean;
  rates: { function: string; category: string | null; amount: number; unit: string }[];
};

export type CrewDefaults = {
  id?: string;
  freelancerId?: string | null;
  name?: string | null;
  function?: string;
  work?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  amount?: number;
};

const OTHER = "__outro";

/** Mesma regra de defaultRate (queries/freelas): tipo de job > qualquer job > o primeiro. */
function pickRate(f: CrewOption | undefined, fn: string, category: string) {
  if (!f) return null;
  const rates = f.rates.filter((r) => r.function === fn);
  return rates.find((r) => r.category && r.category === category) ?? rates.find((r) => !r.category) ?? rates[0] ?? null;
}

function unitWord(unit: string, n: number) {
  if (unit === "diaria") return n === 1 ? "diária" : "diárias";
  if (unit === "video") return n === 1 ? "vídeo" : "vídeos";
  return "";
}

function CrewFields({
  state,
  options,
  category,
  defaults = {},
}: {
  state: ActionResult | null;
  options: CrewOption[];
  category: string;
  defaults?: CrewDefaults;
}) {
  const editing = Boolean(defaults.id);
  const p = editing ? "ec" : "nc";
  const [choice, setChoice] = useState(defaults.freelancerId ?? (editing ? OTHER : ""));
  const [func, setFunc] = useState<string>(defaults.function ?? FUNCTIONS[0].key);
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState(defaults.amount != null && (editing || defaults.amount > 0) ? centsToInput(defaults.amount) : "");
  const [amountTouched, setAmountTouched] = useState(editing);
  const [work, setWork] = useState(defaults.work ?? "");
  const [workTouched, setWorkTouched] = useState(editing);

  const freela = options.find((o) => o.id === choice);
  const rate = pickRate(freela, func, category);
  const perUnit = rate && rate.unit !== "projeto";
  const n = Math.max(1, Math.round(Number(qty) || 1));
  const suggested = rate ? rate.amount * (perUnit ? n : 1) : null;

  function autofill(nextChoice: string, nextFunc: string, nextQty: string) {
    const r = pickRate(
      options.find((o) => o.id === nextChoice),
      nextFunc,
      category,
    );
    const count = Math.max(1, Math.round(Number(nextQty) || 1));
    if (r && !amountTouched) setAmount(centsToInput(r.amount * (r.unit !== "projeto" ? count : 1)));
    if (r && r.unit !== "projeto" && !workTouched) setWork(`${count} ${unitWord(r.unit, count)}`);
  }

  function onChoice(next: string) {
    setChoice(next);
    const f = options.find((o) => o.id === next);
    let nextFunc = func;
    if (f && f.functions.length && !f.functions.includes(func)) {
      nextFunc = f.functions[0];
      setFunc(nextFunc);
    }
    autofill(next, nextFunc, qty);
  }

  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="freelancerId" value={choice === OTHER ? "" : choice} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quem" htmlFor={`${p}-who`} error={fieldError(state, "freelancerId")} className={choice === OTHER ? undefined : "sm:col-span-2"}>
          <Select id={`${p}-who`} value={choice} onChange={(e) => onChoice(e.target.value)} autoFocus={!editing}>
            <option value="" disabled>
              Escolha no banco de freelas
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.active ? "" : " (arquivado)"}
              </option>
            ))}
            <option value={OTHER}>Outra pessoa (sem cadastro)</option>
          </Select>
        </Field>
        {choice === OTHER ? (
          <Field label="Nome" htmlFor={`${p}-name`} error={fieldError(state, "name")}>
            <Input id={`${p}-name`} name="name" defaultValue={defaults.freelancerId ? "" : (defaults.name ?? "")} placeholder="Nome completo" />
          </Field>
        ) : fieldError(state, "name") ? (
          <p className="-mt-2 text-[13px] text-danger sm:col-span-2" role="alert">
            {fieldError(state, "name")}
          </p>
        ) : null}

        <Field label="Função" htmlFor={`${p}-fn`} error={fieldError(state, "function")}>
          <Select
            id={`${p}-fn`}
            name="function"
            value={func}
            onChange={(e) => {
              setFunc(e.target.value);
              autofill(choice, e.target.value, qty);
            }}
          >
            {FUNCTIONS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
                {freela?.functions.includes(f.key) ? " •" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {perUnit ? (
          <Field label={rate?.unit === "video" ? "Quantos vídeos" : "Quantas diárias"} htmlFor={`${p}-qty`}>
            <Input
              id={`${p}-qty`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                autofill(choice, func, e.target.value);
              }}
            />
          </Field>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}

        <Field label="Trabalho" htmlFor={`${p}-work`} error={fieldError(state, "work")} className="sm:col-span-2">
          <Input
            id={`${p}-work`}
            name="work"
            value={work}
            onChange={(e) => {
              setWork(e.target.value);
              setWorkTouched(true);
            }}
            placeholder="Ex.: 4 diárias, edição do lote 1"
          />
        </Field>
        <Field label="Início" htmlFor={`${p}-start`} error={fieldError(state, "startDate")}>
          <Input id={`${p}-start`} name="startDate" type="date" defaultValue={defaults.startDate ?? ""} />
        </Field>
        <Field label="Prazo" htmlFor={`${p}-due`} error={fieldError(state, "dueDate")} hint="Também é o vencimento do pagamento.">
          <Input id={`${p}-due`} name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
        </Field>
        <Field
          label="Valor"
          htmlFor={`${p}-amount`}
          error={fieldError(state, "amount")}
          className="sm:col-span-2"
          hint={
            rate ? (
              <span className="flex flex-wrap items-center gap-x-2">
                <span>
                  Valor padrão de {freela?.name.split(" ")[0]}: {brl(rate.amount)} {optionLabel(RATE_UNITS, rate.unit)}
                  {perUnit && n > 1 ? ` × ${n} = ${brl(suggested)}` : ""}.
                </span>
                {suggested != null && centsToInput(suggested) !== amount ? (
                  <button
                    type="button"
                    className="text-light underline decoration-white/30 underline-offset-4 hover:text-white"
                    onClick={() => {
                      setAmount(centsToInput(suggested));
                      setAmountTouched(false);
                    }}
                  >
                    Usar
                  </button>
                ) : null}
              </span>
            ) : freela ? (
              "Sem valor padrão para esta função. Cadastre na ficha do freela."
            ) : undefined
          }
        >
          <MoneyInput
            id={`${p}-amount`}
            name="amount"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
            }}
            placeholder="0,00"
          />
        </Field>
      </div>
    </>
  );
}

export function AddCrewButton({ projectId, options, category }: { projectId: string; options: CrewOption[]; category: string }) {
  return (
    <FormModal
      title="Adicionar à equipe"
      description="Escolha no banco de freelas: o valor padrão entra preenchido."
      action={addCrewMemberT}
      submitLabel="Adicionar"
      size="lg"
      trigger={
        <Button variant="secondary" size="sm">
          <UserPlus /> Adicionar à equipe
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <CrewFields state={state} options={options} category={category} />
        </>
      )}
    </FormModal>
  );
}

export function EditCrewButton({ defaults, options, category, label }: { defaults: CrewDefaults; options: CrewOption[]; category: string; label: string }) {
  return (
    <FormModal
      title="Editar equipe"
      description="Se o pagamento já foi gerado, o valor no financeiro acompanha."
      action={updateCrewMemberT}
      size="lg"
      trigger={
        <Button variant="ghost" size="icon" className="lg:size-8" aria-label={`Editar ${label}`}>
          <Pencil />
        </Button>
      }
    >
      {(state) => <CrewFields state={state} options={options} category={category} defaults={defaults} />}
    </FormModal>
  );
}

export function DeleteCrewButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmAction
      title={`Tirar ${label} da equipe?`}
      description="Pagamento gerado e ainda sem nenhuma baixa sai do financeiro junto. O que já foi pago continua registrado."
      confirmLabel="Tirar da equipe"
      action={deleteCrewMemberT}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="icon" className="text-mute hover:text-danger lg:size-8" aria-label={`Tirar ${label} da equipe`}>
          <Trash2 />
        </Button>
      }
    />
  );
}

export function GeneratePaymentButton({
  id,
  label,
  amount,
  dueDate,
}: {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
}) {
  return (
    <ConfirmAction
      title="Gerar pagamento?"
      description={`Cria uma saída de ${brl(amount)} para ${label} no financeiro, com vencimento em ${dateBR(dueDate)}.`}
      confirmLabel="Gerar pagamento"
      destructive={false}
      action={generateCrewPaymentT}
      fields={{ id }}
      trigger={
        <Button variant="subtle" size="sm" className="h-10 lg:h-8">
          <Receipt /> Gerar pagamento
        </Button>
      }
    />
  );
}
