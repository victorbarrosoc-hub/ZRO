/**
 * Medidores simples (skill dataviz: trilho no mesmo tom, preenchimento em branco, sempre com texto ao lado).
 * Sem hooks: servem tanto para componentes de servidor quanto de cliente.
 */
import { CREATIVE_RULE, type CreativeRuleAnswers } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Respostas com conteúdo de verdade (mesmo critério de creativeRuleComplete). */
export function countAnswered(answers: Partial<Record<string, string>> | CreativeRuleAnswers | null | undefined) {
  const a = (answers ?? {}) as Partial<Record<string, string>>;
  return CREATIVE_RULE.filter((q) => (a[q.key] ?? "").trim().length >= 3).length;
}

/** 0.3612 → "36%". Sem base (valor zero), "—". */
export function percent(ratio: number | null | undefined) {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-white/10", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="h-full rounded-full bg-white/80 transition-[width] duration-500 ease-out-expo" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "4 de 6 respondidas", com um segmento por pergunta da regra criativa. */
export function RuleProgress({ answered, className }: { answered: number; className?: string }) {
  const total = CREATIVE_RULE.length;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex flex-1 gap-1"
        role="progressbar"
        aria-label="Perguntas da regra criativa respondidas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < answered ? "bg-white/85" : "bg-white/10")} />
        ))}
      </div>
      <span className="shrink-0 text-[13px] text-ash tabular-nums">
        {answered} de {total} respondidas
      </span>
    </div>
  );
}
