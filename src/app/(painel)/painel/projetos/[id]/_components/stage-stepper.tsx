"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { STAGES, creativeRuleComplete, type CreativeRuleAnswers } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { moveProjectStage } from "../../actions";
import { CreativeRuleForm } from "./creative-rule-form";
import { countAnswered } from "./meter";

const CONCEITO = STAGES.findIndex((s) => s.key === "conceito");

/**
 * O processo criativo da ZRO (documento-mestre §18) em 7 etapas.
 * A etapa atual recebe a luz. Sem a regra criativa respondida, não passa de Conceito.
 */
export function StageStepper({
  projectId,
  stage,
  answers,
}: {
  projectId: string;
  stage: string;
  answers: CreativeRuleAnswers | null;
}) {
  const serverIdx = Math.max(0, STAGES.findIndex((s) => s.key === stage));
  const [idx, setIdx] = useOptimistic(serverIdx);
  const [pending, startTransition] = useTransition();
  const [showRule, setShowRule] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const complete = creativeRuleComplete(answers);
  const answered = countAnswered(answers);
  const current = STAGES[idx];
  const gated = !complete && idx <= CONCEITO;

  useEffect(() => {
    // No celular a trilha rola: mantém a etapa atual à vista.
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[aria-current=step]");
    if (list && el && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: el.offsetLeft - list.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    }
  }, [idx]);

  function move(to: number) {
    if (to < 0 || to >= STAGES.length || pending) return;
    const blocked = to > idx && to > CONCEITO && !complete;
    startTransition(async () => {
      if (!blocked) setIdx(to);
      const fd = new FormData();
      fd.set("id", projectId);
      fd.set("to", STAGES[to].key);
      const result = await moveProjectStage(null, fd);
      if (result.ok) {
        if (result.message) toast.success(result.message);
      } else {
        toast.error(result.error);
        if (result.fieldErrors?.creativeRule) setShowRule(true);
      }
    });
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label text-mute">
            Processo criativo · etapa {current.n} de {String(STAGES.length).padStart(2, "0")}
          </p>
          <p className="mt-2 text-[24px] leading-tight font-semibold tracking-[-0.025em] text-white">{current.label}</p>
          <p className="mt-1 text-[14px] text-ash">{current.hint}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 sm:flex-none" disabled={idx === 0 || pending} onClick={() => move(idx - 1)}>
            <ArrowLeft /> Voltar etapa
          </Button>
          <Button variant="primary" className="flex-1 sm:flex-none" disabled={idx === STAGES.length - 1 || pending} onClick={() => move(idx + 1)}>
            Avançar etapa <ArrowRight />
          </Button>
        </div>
      </div>

      <ol
        ref={listRef}
        aria-label="Etapas do processo criativo"
        className="relative -mx-5 mt-3 flex overflow-x-auto px-5 py-4 [scrollbar-width:none] sm:-mx-6 sm:px-6"
      >
        {STAGES.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "next";
          const lockHere = i === CONCEITO && !complete;
          return (
            <li
              key={s.key}
              aria-current={state === "current" ? "step" : undefined}
              className="flex min-w-[96px] flex-1 flex-col gap-3 last:min-w-[72px] last:flex-none"
            >
              <div className="flex items-center">
                <span
                  className={cn(
                    "relative grid size-9 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-[background-color,color,box-shadow,border-color] duration-500 ease-out-expo",
                    state === "current" && "bg-white text-void shadow-[0_0_0_5px_rgb(255_255_255/0.07),0_0_32px_rgb(255_255_255/0.45)]",
                    state === "done" && "border border-white/35 bg-white/[0.06] text-light",
                    state === "next" && "border border-line-strong text-mute",
                  )}
                >
                  {state === "done" ? <Check className="size-4" aria-hidden /> : s.n}
                </span>
                {i < STAGES.length - 1 ? (
                  lockHere ? (
                    <span className="mx-2 flex flex-1 items-center" title="Travado pela regra criativa">
                      <span className="h-px flex-1 bg-line-strong" />
                      <LockKeyhole className="mx-1.5 size-3.5 text-ash" aria-label="Travado pela regra criativa" />
                      <span className="h-px flex-1 bg-line-strong" />
                    </span>
                  ) : (
                    <span className={cn("mx-2 h-px flex-1", i < idx ? "bg-white/40" : "bg-line-strong")} aria-hidden />
                  )
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[13px] whitespace-nowrap",
                  state === "current" ? "font-medium text-white" : state === "done" ? "text-ash" : "text-mute",
                )}
              >
                {s.label}
                <span className="sr-only">{state === "current" ? " (etapa atual)" : state === "done" ? " (concluída)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {gated ? (
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-line-strong bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-ash" aria-hidden />
            <div>
              <p className="text-[14px] text-light">A regra criativa segura a passagem para Direção.</p>
              <p className="mt-0.5 text-[13px] text-mute">
                {answered} de 6 respondidas. Se não houver resposta clara, o projeto ainda não está pronto.
              </p>
            </div>
          </div>
          {!showRule ? (
            <Button variant="secondary" onClick={() => setShowRule(true)} aria-expanded={false} className="shrink-0">
              Responder agora
            </Button>
          ) : null}
        </div>
      ) : idx === CONCEITO ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-ok">
          <Check className="size-4 shrink-0" aria-hidden /> Regra criativa respondida. O projeto pode avançar para Direção.
        </p>
      ) : null}

      {showRule ? (
        <div id="stepper-regra" className="mt-5 border-t border-line pt-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium text-light">Regra criativa</p>
            <Button variant="ghost" size="sm" onClick={() => setShowRule(false)} aria-expanded aria-controls="stepper-regra">
              Fechar
            </Button>
          </div>
          <CreativeRuleForm projectId={projectId} answers={answers} idPrefix="stepper-regra" />
        </div>
      ) : null}
    </Card>
  );
}
