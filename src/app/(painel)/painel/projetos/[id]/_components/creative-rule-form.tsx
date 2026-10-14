"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ActionForm, SubmitButton, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { CREATIVE_RULE, type CreativeRuleAnswers } from "@/lib/domain";
import { saveCreativeRule } from "../../actions";
import { RuleProgress, countAnswered } from "./meter";
import { toastFirst } from "./run-action";

const saveCreativeRuleT = toastFirst(saveCreativeRule);

const QUOTE = "Se não houver resposta clara, o projeto ainda não está pronto.";

function fromAnswers(answers: CreativeRuleAnswers | null | undefined) {
  return Object.fromEntries(CREATIVE_RULE.map((q) => [q.key, answers?.[q.key] ?? ""])) as Record<string, string>;
}

const number = (i: number) => String(i + 1).padStart(2, "0");

/**
 * As 6 perguntas da regra criativa (documento-mestre §34), salvas juntas.
 * Aparece na visão geral e, como lembrete, dentro do stepper.
 * `collapsible`: com as 6 respondidas, mostra as respostas em texto e edita sob demanda.
 */
export function CreativeRuleForm({
  projectId,
  answers,
  idPrefix = "regra",
  collapsible = false,
}: {
  projectId: string;
  answers: CreativeRuleAnswers | null;
  idPrefix?: string;
  collapsible?: boolean;
}) {
  const serverKey = JSON.stringify(answers ?? {});
  const [base, setBase] = useState(serverKey);
  const [values, setValues] = useState(() => fromAnswers(answers));
  const [editing, setEditing] = useState(() => !collapsible || countAnswered(answers) < CREATIVE_RULE.length);
  // Quando o servidor devolve respostas novas (salvas aqui ou no outro formulário), acompanha.
  if (base !== serverKey) {
    setBase(serverKey);
    setValues(fromAnswers(answers));
  }
  const answered = countAnswered(values);

  if (!editing) {
    return (
      <div className="grid gap-5">
        <RuleProgress answered={countAnswered(answers)} />
        <ol className="grid gap-5">
          {CREATIVE_RULE.map((q, i) => (
            <li key={q.key} className="grid gap-1.5">
              <p className="flex items-baseline gap-3 text-[13px] leading-snug text-mute">
                <span className="font-mono text-[11px]">{number(i)}</span>
                {q.question}
              </p>
              <p className="pl-[29px] text-[15px] leading-relaxed text-light">{answers?.[q.key]}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-mute">{QUOTE}</p>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil /> Editar respostas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ActionForm
      action={saveCreativeRuleT}
      className="grid gap-5"
      onSuccess={() => {
        if (collapsible && answered === CREATIVE_RULE.length) setEditing(false);
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={projectId} />
          <RuleProgress answered={answered} />
          <ol className="grid gap-4">
            {CREATIVE_RULE.map((q, i) => {
              const error = fieldError(state, q.key);
              const filled = values[q.key].trim().length >= 3;
              return (
                <li key={q.key} className="grid gap-2">
                  <label htmlFor={`${idPrefix}-${q.key}`} className="flex items-baseline gap-3 text-[14px] leading-snug text-light">
                    <span className={filled ? "font-mono text-[11px] text-white" : "font-mono text-[11px] text-mute"}>{number(i)}</span>
                    {q.question}
                  </label>
                  <Textarea
                    id={`${idPrefix}-${q.key}`}
                    name={q.key}
                    rows={2}
                    maxLength={1000}
                    className="min-h-0"
                    value={values[q.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [q.key]: e.target.value }))}
                    aria-invalid={error ? true : undefined}
                  />
                  {error ? (
                    <p className="text-[13px] text-danger" role="alert">
                      {error}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-mute">{QUOTE}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {collapsible && countAnswered(answers) === CREATIVE_RULE.length ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setValues(fromAnswers(answers));
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
              <SubmitButton>Salvar respostas</SubmitButton>
            </div>
          </div>
        </>
      )}
    </ActionForm>
  );
}
