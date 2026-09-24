/**
 * Tipos de documento de roteiro. Ficam aqui até irem para src/lib/domain.ts
 * (sugestão registrada no relatório do módulo).
 */
export const SCRIPT_KINDS = [
  { key: "roteiro", label: "Roteiro", hint: "Texto corrido: cenas, falas e locução." },
  { key: "decupagem", label: "Decupagem", hint: "O roteiro quebrado em planos, cena a cena." },
  { key: "shotlist", label: "Shot list", hint: "Os planos do set, marcados conforme saem." },
] as const;

export type ScriptKind = (typeof SCRIPT_KINDS)[number]["key"];
export const SCRIPT_KIND_KEYS = SCRIPT_KINDS.map((k) => k.key) as [ScriptKind, ...ScriptKind[]];

export function scriptKindLabel(kind: string | null | undefined) {
  return SCRIPT_KINDS.find((k) => k.key === kind)?.label ?? "Roteiro";
}

/** Decupagem e shot list são tabelas de planos; roteiro é texto. */
export function isShotKind(kind: string | null | undefined) {
  return kind === "decupagem" || kind === "shotlist";
}

export type Shot = {
  scene: string;
  shot: string;
  description: string;
  lens?: string;
  movement?: string;
  done?: boolean;
};

/** Palavras de um texto (para a contagem do roteiro). */
export function wordCount(text: string | null | undefined) {
  const m = (text ?? "").trim().match(/\S+/g);
  return m ? m.length : 0;
}
