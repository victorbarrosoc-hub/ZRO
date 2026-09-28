"use client";

import { useState } from "react";
import { Pencil, Receipt, Trash2, UserPlus } from "lucide-react";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { FUNCTIONS, RATE_UNITS, functionOptions, optionLabel } from "@/lib/domain";
import { brl, centsToInput, dateBR, dateShort, parseBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  dailyRate?: number | null;
  /** Diárias do projeto em que a pessoa já está escalada. */
  escalated?: string[];
};

/** Diária do projeto, para escalar direto da equipe. */
export type CrewDiaria = { id: string; date: string; endDate: string | null; title: string; days: number };

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

type Mode = "diaria" | "fechado";

function CrewFields({
  state,
  options,
  category,
  diarias,
  defaults = {},
}: {
  state: ActionResult | null;
  options: CrewOption[];
  category: string;
  diarias: CrewDiaria[];
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
  const [mode, setMode] = useState<Mode>(editing && defaults.dailyRate != null ? "diaria" : editing ? "fechado" : "diaria");
  const [modeTouched, setModeTouched] = useState(editing);
  const [daily, setDaily] = useState(defaults.dailyRate != null ? centsToInput(defaults.dailyRate) : "");
  const [dailyTouched, setDailyTouched] = useState(editing);
  const [picked, setPicked] = useState<string[]>(defaults.escalated ?? []);

  const freela = options.find((o) => o.id === choice);
  const rate = pickRate(freela, func, category);
  const perUnit = rate && rate.unit !== "projeto";
  const n = Math.max(1, Math.round(Number(qty) || 1));
  const suggested = rate ? rate.amount * (perUnit ? n : 1) : null;
  const canPerDay = choice !== "" && choice !== OTHER;
  const effectiveMode: Mode = canPerDay ? mode : "fechado";
  const days = diarias.filter((d) => picked.includes(d.id)).reduce((sum, d) => sum + d.days, 0);
  const dailyCents = parseBRL(daily) ?? 0;

  function autofill(nextChoice: string, nextFunc: string, nextQty: string) {
    const r = pickRate(
      options.find((o) => o.id === nextChoice),
      nextFunc,
      category,
    );
    const count = Math.max(1, Math.round(Number(nextQty) || 1));
    if (r && !amountTouched) setAmount(centsToInput(r.amount * (r.unit !== "projeto" ? count : 1)));
    if (r && r.unit !== "projeto" && !workTouched && mode === "fechado") setWork(`${count} ${unitWord(r.unit, count)}`);
    if (r && r.unit === "diaria" && !dailyTouched) setDaily(centsToInput(r.amount));
    if (r && !modeTouched) setMode(r.unit === "diaria" ? "diaria" : "fechado");
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
      <input type="hidden" name="mode" value={effectiveMode} />
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
            {functionOptions([...options.flatMap((o) => o.functions), func]).map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
                {freela?.functions.includes(f.key) ? " •" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Cobrança">
          <div className="grid h-11 grid-cols-2 gap-1 rounded-full border border-line bg-white/[0.02] p-1" role="radiogroup" aria-label="Cobrança">
            {(
              [
                ["diaria", "Por diária"],
                ["fechado", "Valor fechado"],
              ] as const
            ).map(([key, label]) => {
              const on = effectiveMode === key;
              const disabled = key === "diaria" && !canPerDay;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => {
                    setMode(key);
                    setModeTouched(true);
                  }}
                  className={cn(
                    "rounded-full text-[13px] transition-colors disabled:opacity-40",
                    on ? "bg-white text-void" : "text-ash hover:text-light",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        {effectiveMode === "diaria" ? (
          <>
            <Field label="Valor da diária" htmlFor={`${p}-daily`} error={fieldError(state, "dailyRate")}>
              <MoneyInput
                id={`${p}-daily`}
                name="dailyRate"
                value={daily}
                onChange={(e) => {
                  setDaily(e.target.value);
                  setDailyTouched(true);
                }}
                placeholder="0,00"
              />
            </Field>
            <div className="grid content-end gap-1.5">
              <span className="text-[13px] text-mute">Total</span>
              <p className="flex h-11 items-center text-[17px] font-medium text-white tabular-nums">
                {brl(dailyCents * days)}
                <span className="ml-2 text-[13px] font-normal text-mute">
                  {days} {days === 1 ? "diária" : "diárias"}
                </span>
              </p>
            </div>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-2 text-[13px] text-mute">Diárias</legend>
              <input type="hidden" name="diariasField" value="1" />
              {diarias.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {diarias.map((d) => {
                    const on = picked.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2 text-[13px] transition-colors",
                          on ? "border-white/60 bg-white/[0.06] text-light" : "border-line text-ash hover:border-white/25",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="diarias"
                          value={d.id}
                          checked={on}
                          onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, d.id] : cur.filter((x) => x !== d.id)))}
                          className="size-4 shrink-0 accent-white"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium tabular-nums">
                            {dateShort(d.date)}
                            {d.days > 1 ? ` a ${dateShort(d.endDate)}` : ""}
                          </span>
                          <span className="block truncate text-[12px] text-mute">{d.title}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[13px] text-mute">Nenhuma diária na agenda do projeto.</p>
              )}
            </fieldset>
          </>
        ) : (
          <>
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
            ) : null}
            <Field
              label="Valor"
              htmlFor={`${p}-amount`}
              error={fieldError(state, "amount")}
              className={perUnit ? undefined : "sm:col-span-2"}
              hint={
                rate && suggested != null && centsToInput(suggested) !== amount ? (
                  <button
                    type="button"
                    className="text-light underline decoration-white/30 underline-offset-4 hover:text-white"
                    onClick={() => {
                      setAmount(centsToInput(suggested));
                      setAmountTouched(false);
                    }}
                  >
                    Usar {brl(suggested)} ({brl(rate.amount)} {optionLabel(RATE_UNITS, rate.unit)})
                  </button>
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
            <Field label="Início" htmlFor={`${p}-start`} error={fieldError(state, "startDate")}>
              <Input id={`${p}-start`} name="startDate" type="date" defaultValue={defaults.startDate ?? ""} />
            </Field>
            <Field label="Vencimento" htmlFor={`${p}-due`} error={fieldError(state, "dueDate")}>
              <Input id={`${p}-due`} name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
            </Field>
          </>
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
            placeholder="Ex.: câmera B, edição do lote 1"
          />
        </Field>
      </div>
    </>
  );
}

export function AddCrewButton({
  projectId,
  options,
  category,
  diarias,
}: {
  projectId: string;
  options: CrewOption[];
  category: string;
  diarias: CrewDiaria[];
}) {
  return (
    <FormModal
      title="Adicionar à equipe"
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
          <CrewFields state={state} options={options} category={category} diarias={diarias} />
        </>
      )}
    </FormModal>
  );
}

export function EditCrewButton({
  defaults,
  options,
  category,
  diarias,
  label,
}: {
  defaults: CrewDefaults;
  options: CrewOption[];
  category: string;
  diarias: CrewDiaria[];
  label: string;
}) {
  return (
    <FormModal
      title="Editar equipe"
      action={updateCrewMemberT}
      size="lg"
      trigger={
        <Button variant="ghost" size="icon" className="lg:size-8" aria-label={`Editar ${label}`}>
          <Pencil />
        </Button>
      }
    >
      {(state) => <CrewFields state={state} options={options} category={category} diarias={diarias} defaults={defaults} />}
    </FormModal>
  );
}

export function DeleteCrewButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmAction
      title={`Tirar ${label} da equipe?`}
      description="Sai também das diárias do projeto. Pagamento sem baixa sai do financeiro; o que já foi pago fica."
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
      title="Lançar pagamento?"
      description={`${brl(amount)} para ${label}, vencendo em ${dateBR(dueDate)}.`}
      confirmLabel="Lançar"
      destructive={false}
      action={generateCrewPaymentT}
      fields={{ id }}
      trigger={
        <Button variant="subtle" size="sm" className="h-10 lg:h-8">
          <Receipt /> Lançar pagamento
        </Button>
      }
    />
  );
}
