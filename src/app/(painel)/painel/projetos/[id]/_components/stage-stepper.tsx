"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { STAGES, creativeRuleComplete, type CreativeRuleAnswers } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { moveProjectStage } from "../../actions";
import { CreativeRuleForm } from "./creative-rule-form";
import { countAnswered } from "./meter";
import { callAction } from "./run-action";

const CONCEITO = STAGES.findIndex((s) => s.key === "conceito");

/**
 * O processo criativo da ZRO (documento-mestre §18) em 7 etapas.
 * A etapa atual recebe a luz. Sem trava: dá para ir a qualquer etapa (clicando nela),
 * porque nem todo projeto passa por todas. A regra criativa fica como lembrete.
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
  const lembrar = !complete && idx <= CONCEITO;

  useEffect(() => {
    // No celular a trilha rola: mantém a etapa atual à vista.
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[aria-current=step]");
    if (list && el && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: el.offsetLeft - list.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    }
  }, [idx]);

  function move(to: number) {
    if (to < 0 || to >= STAGES.length || to === idx || pending) return;
    startTransition(async () => {
      setIdx(to);
      const result = await callAction(moveProjectStage, { id: projectId, to: STAGES[to].key });
      if (result.ok) {
        if (result.message) toast.success(result.message);
      } else {
        toast.error(result.error);
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
          return (
            <li
              key={s.key}
              aria-current={state === "current" ? "step" : undefined}
              className="flex min-w-[96px] flex-1 flex-col gap-3 last:min-w-[72px] last:flex-none"
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => move(i)}
                  disabled={pending || state === "current"}
                  title={state === "current" ? undefined : `Ir para ${s.label}`}
                  aria-label={state === "current" ? `${s.label} (etapa atual)` : `Ir para ${s.n} ${s.label}`}
                  className={cn(
                    "relative grid size-9 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-[background-color,color,box-shadow,border-color] duration-500 ease-out-expo disabled:cursor-default",
                    state === "current" && "bg-white text-void shadow-[0_0_0_5px_rgb(255_255_255/0.07),0_0_32px_rgb(255_255_255/0.45)]",
                    state === "done" && "border border-white/35 bg-white/[0.06] text-light hover:border-white/70",
                    state === "next" && "border border-line-strong text-mute hover:border-white/50 hover:text-light",
                  )}
                >
                  {state === "done" ? <Check className="size-4" aria-hidden /> : s.n}
                </button>
                {i < STAGES.length - 1 ? (
                  <span className={cn("mx-2 h-px flex-1", i < idx ? "bg-white/40" : "bg-line-strong")} aria-hidden />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => move(i)}
                disabled={pending || state === "current"}
                tabIndex={-1}
                aria-hidden
                className={cn(
                  "w-fit text-left text-[13px] whitespace-nowrap disabled:cursor-default",
                  state === "current" ? "font-medium text-white" : state === "done" ? "text-ash hover:text-light" : "text-mute hover:text-light",
                )}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {lembrar ? (
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-line bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ash">
            Regra criativa: {answered} de 6 respondidas. <span className="text-mute">É um lembrete, não trava o projeto.</span>
          </p>
          {!showRule ? (
            <Button variant="ghost" size="sm" onClick={() => setShowRule(true)} aria-expanded={false} className="shrink-0">
              Responder agora
            </Button>
          ) : null}
        </div>
      ) : complete && idx === CONCEITO ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-ok">
          <Check className="size-4 shrink-0" aria-hidden /> Regra criativa respondida.
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
