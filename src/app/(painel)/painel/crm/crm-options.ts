/**
 * Vocabulário e utilitários do CRM que ainda não existem em `@/lib/domain`.
 * Arquivo comum (sem diretiva): serve às páginas, às actions e aos componentes cliente.
 */
import { LEAD_STAGES, type LeadStage } from "@/lib/domain";
import { dateBR, daysBetween, todayISO } from "@/lib/format";

/** Tipos de atividade que a gente registra à mão no histórico. */
export const ACTIVITY_TYPES = [
  { key: "nota", label: "Nota" },
  { key: "ligacao", label: "Ligação" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "reuniao", label: "Reunião" },
  { key: "email", label: "E-mail" },
] as const;

/** Registro automático de mudança de etapa (não aparece no formulário). */
export const STAGE_ACTIVITY = "etapa";

/** Registros automáticos que vêm dos projetos (services/activity). */
const AUTO_ACTIVITY: Record<string, string> = { projeto: "Projeto", agenda: "Agenda", financeiro: "Financeiro" };

export function activityLabel(type: string) {
  if (type === STAGE_ACTIVITY) return "Etapa";
  return ACTIVITY_TYPES.find((t) => t.key === type)?.label ?? AUTO_ACTIVITY[type] ?? type;
}

/** Sugestões rápidas para o motivo de perda. */
export const LOST_REASONS = [
  "Sem resposta",
  "Preço acima do previsto",
  "Prazo não fechou",
  "Fechou com outra produtora",
  "Projeto adiado ou cancelado",
] as const;

/** Etapas em que o lead ainda está em jogo. */
export const OPEN_STAGES: readonly LeadStage[] = ["novo", "conversa", "orcamento", "negociacao"];

export function isOpenStage(stage: string) {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

export function stageLabel(stage: string) {
  return LEAD_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

/** Chaves de uma lista do domínio, no formato que o z.enum pede. */
export function keysOf<T extends readonly { key: string }[]>(list: T) {
  return list.map((o) => o.key) as [string, ...string[]];
}

/** "hoje", "ontem", "há 5 dias" ou a data, para quando o lead entrou. */
export function sinceLabel(date: Date | number, today = todayISO()) {
  const iso = todayISO(new Date(date));
  const diff = daysBetween(iso, today);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 45) return `há ${diff} dias`;
  return dateBR(iso);
}

/** Retorno combinado já chegou (hoje ou atrasado), para leads em aberto. */
export function followUpDue(lead: { stage: string; followUpAt: string | null }, today = todayISO()) {
  return Boolean(lead.followUpAt && lead.followUpAt <= today && isOpenStage(lead.stage));
}

/** Nome que aparece no cartão: empresa, senão a pessoa. */
export function leadTitle(lead: { company: string | null; name: string }) {
  return lead.company?.trim() || lead.name;
}

export { formatDocument } from "@/lib/format";
