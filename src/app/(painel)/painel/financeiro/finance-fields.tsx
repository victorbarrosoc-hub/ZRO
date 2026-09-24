"use client";

import { useState } from "react";
import { fieldError } from "@/components/painel/form";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { FINANCE_CATEGORIES, FINANCE_KINDS, type FinanceKind } from "@/lib/domain";
import { centsToInput, todayISO } from "@/lib/format";
import type { FinanceOptions } from "@/lib/queries/finance";
import { cn } from "@/lib/utils";

export type EntryDefaults = {
  id?: string;
  kind?: FinanceKind;
  category?: string;
  description?: string;
  amount?: number;
  dueDate?: string;
  projectId?: string | null;
  clientId?: string | null;
  freelancerId?: string | null;
  installment?: string | null;
  competence?: string | null;
  notes?: string | null;
};

const PLACEHOLDER: Record<FinanceKind, string> = {
  entrada: "Ex.: SERHS · saldo",
  saida: "Ex.: Aluguel de lente para a diária",
  imposto: "Ex.: ISS da nota de setembro",
};

function firstCategory(kind: FinanceKind) {
  return FINANCE_CATEGORIES.find((c) => c.kind === kind)?.key ?? "";
}

/** Campos do lançamento (criar e editar usam os mesmos). Mostra só o que faz sentido para o tipo. */
export function EntryFields({
  state,
  options,
  defaults = {},
  allowRepeat = false,
}: {
  state: ActionResult | null;
  options: FinanceOptions;
  defaults?: EntryDefaults;
  allowRepeat?: boolean;
}) {
  const [kind, setKind] = useState<FinanceKind>(defaults.kind ?? "saida");
  const [category, setCategory] = useState(defaults.category ?? firstCategory(defaults.kind ?? "saida"));
  const [projectId, setProjectId] = useState(defaults.projectId ?? "");
  const [clientId, setClientId] = useState(defaults.clientId ?? "");
  const [repeat, setRepeat] = useState("1");

  const categories = FINANCE_CATEGORIES.filter((c) => c.kind === kind);
  const openProjects = options.projects.filter((p) => p.status === "ativo" || p.status === "pausado" || p.id === defaults.projectId);
  const closedProjects = options.projects.filter((p) => !openProjects.includes(p));
  const freelas = options.freelancers.filter((f) => f.active || f.id === defaults.freelancerId);
  const uid = defaults.id ?? "novo";

  function changeKind(next: FinanceKind) {
    setKind(next);
    if (!FINANCE_CATEGORIES.some((c) => c.key === category && c.kind === next)) setCategory(firstCategory(next));
  }

  function changeProject(id: string) {
    setProjectId(id);
    const project = options.projects.find((p) => p.id === id);
    if (project?.clientId && !clientId) setClientId(project.clientId);
  }

  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ash">Tipo</legend>
        <div className="inline-flex gap-1 rounded-full border border-line bg-white/[0.02] p-1">
          {FINANCE_KINDS.map((k) => (
            <label key={k.key} className="cursor-pointer">
              <input
                type="radio"
                name="kind"
                value={k.key}
                checked={kind === k.key}
                onChange={() => changeKind(k.key)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-9 items-center rounded-full px-4 text-[13px] text-ash transition-colors hover:text-light",
                  "peer-checked:bg-white peer-checked:text-void peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
                )}
              >
                {k.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrição" htmlFor={`e-desc-${uid}`} error={fieldError(state, "description")} className="sm:col-span-2">
          <Input
            id={`e-desc-${uid}`}
            name="description"
            defaultValue={defaults.description}
            placeholder={PLACEHOLDER[kind]}
            maxLength={200}
            required
          />
        </Field>

        <Field label="Categoria" htmlFor={`e-cat-${uid}`} error={fieldError(state, "category")}>
          <Select id={`e-cat-${uid}`} name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Valor" htmlFor={`e-amount-${uid}`} error={fieldError(state, "amount")}>
          <MoneyInput id={`e-amount-${uid}`} name="amount" defaultValue={centsToInput(defaults.amount)} placeholder="0,00" required />
        </Field>

        <Field
          label={allowRepeat && repeat !== "1" ? "Primeiro vencimento" : "Vencimento"}
          htmlFor={`e-due-${uid}`}
          error={fieldError(state, "dueDate")}
        >
          <Input id={`e-due-${uid}`} name="dueDate" type="date" defaultValue={defaults.dueDate ?? todayISO()} required />
        </Field>

        {allowRepeat && repeat !== "1" ? (
          <Field label="Parcela" htmlFor={`e-inst-${uid}`} hint={`Numeradas sozinhas: 1/${repeat}, 2/${repeat}…`}>
            <Input id={`e-inst-${uid}`} disabled value={`1/${repeat} a ${repeat}/${repeat}`} readOnly />
          </Field>
        ) : (
          <Field label="Parcela" htmlFor={`e-inst-${uid}`} hint="Opcional. Ex.: 1/2" error={fieldError(state, "installment")}>
            <Input id={`e-inst-${uid}`} name="installment" defaultValue={defaults.installment ?? ""} maxLength={20} />
          </Field>
        )}

        <Field label="Projeto" htmlFor={`e-proj-${uid}`} hint="Opcional.">
          <Select id={`e-proj-${uid}`} name="projectId" value={projectId} onChange={(e) => changeProject(e.target.value)}>
            <option value="">Sem projeto</option>
            {openProjects.length ? (
              <optgroup label="Em andamento">
                {openProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {closedProjects.length ? (
              <optgroup label="Encerrados">
                {closedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>

        {kind === "entrada" ? (
          <Field label="Cliente" htmlFor={`e-client-${uid}`} hint="Opcional. Vem do projeto quando ele tem cliente.">
            <Select id={`e-client-${uid}`} name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sem cliente</option>
              {options.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : kind === "saida" ? (
          <Field label="Freela" htmlFor={`e-freela-${uid}`} hint="Opcional. Liga o pagamento à ficha do freela.">
            <Select id={`e-freela-${uid}`} name="freelancerId" defaultValue={defaults.freelancerId ?? ""}>
              <option value="">Nenhum</option>
              {freelas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.active ? "" : " (arquivado)"}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="Competência"
            htmlFor={`e-comp-${uid}`}
            hint="Mês a que o imposto se refere. Em branco, o mês anterior ao vencimento."
            error={fieldError(state, "competence")}
          >
            <Input id={`e-comp-${uid}`} name="competence" type="month" defaultValue={defaults.competence ?? ""} placeholder="AAAA-MM" />
          </Field>
        )}

        {allowRepeat ? (
          <Field
            label="Repetir"
            htmlFor={`e-repeat-${uid}`}
            hint="Para custos fixos: um lançamento por mês, no mesmo dia."
            error={fieldError(state, "repeat")}
          >
            <Select id={`e-repeat-${uid}`} name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="1">Não repetir</option>
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  Por {n} meses
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Observações" htmlFor={`e-notes-${uid}`} className="sm:col-span-2" error={fieldError(state, "notes")}>
          <Textarea id={`e-notes-${uid}`} name="notes" rows={2} defaultValue={defaults.notes ?? ""} />
        </Field>
      </div>
    </>
  );
}
