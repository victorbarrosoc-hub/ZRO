/**
 * Peças de apresentação do Financeiro (componentes de servidor):
 * abas do módulo, navegação por mês, filtros em link, ícone de tipo
 * e o medidor realizado/previsto dos resumos.
 */
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { TabLinks } from "@/components/painel/bits";
import { FINANCE_KINDS, optionLabel } from "@/lib/domain";
import { monthLong } from "@/lib/format";
import { shiftMonth } from "@/lib/queries/finance";
import { cn } from "@/lib/utils";

/**
 * Cores das marcas de dinheiro, as mesmas do CashflowChart (skill dataviz):
 * recebido 17:1, pago 7,5:1 e previsto 3,8:1 contra a superfície #101010.
 */
export const FLOW_COLORS = {
  recebido: "#f2f2f2",
  pago: "#a3a3a3",
  previsto: "#6f6f6f",
} as const;

/** "setembro de 2026" → "Setembro de 2026" */
export function cap(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ---------------- Abas do módulo ---------------- */

export function FinanceTabs({ active, month }: { active: "lancamentos" | "fluxo" | "impostos"; month?: string | null }) {
  const q = month ? `?mes=${month}` : "";
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "lancamentos", label: "Lançamentos", href: `/painel/financeiro${q}` },
        { key: "fluxo", label: "Fluxo e resultado", href: `/painel/financeiro/fluxo${q}` },
        { key: "impostos", label: "Impostos", href: `/painel/financeiro/impostos${q}` },
      ]}
    />
  );
}

/* ---------------- Navegação por mês ---------------- */

/** Atalhos do mês. Ativo fica marcado sem virar botão principal (o branco cheio é das ações). */
const chip = (active: boolean) =>
  cn(
    "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[13px] whitespace-nowrap transition-colors",
    active
      ? "border-white/40 bg-white/[0.08] text-white"
      : "border-line-strong text-ash hover:border-white/30 hover:text-light",
  );

/**
 * ‹ Setembro de 2026 › · Hoje · Todos os meses.
 * `month` null = todos os meses (as setas partem do mês atual).
 */
export function MonthNav({
  month,
  current,
  hrefFor,
  allowAll = false,
  prefix,
}: {
  month: string | null;
  current: string;
  hrefFor: (month: string) => string;
  allowAll?: boolean;
  /** Texto antes do mês ("Até" → "Até setembro de 2026"). */
  prefix?: string;
}) {
  const ref = month ?? current;
  const prev = shiftMonth(ref, -1);
  const next = shiftMonth(ref, 1);
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto" role="group" aria-label="Mês">
      <div className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-full border border-line bg-white/[0.02] p-1 sm:flex-none">
        <Link
          href={hrefFor(prev)}
          scroll={false}
          className="grid size-9 place-items-center rounded-full text-ash transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={`Mês anterior: ${monthLong(prev)}`}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <p className="min-w-0 truncate px-2 text-center text-[14px] font-medium text-white sm:min-w-[164px]" aria-live="polite">
          {month ? (prefix ? `${prefix} ${monthLong(month)}` : cap(monthLong(month))) : "Todos os meses"}
        </p>
        <Link
          href={hrefFor(next)}
          scroll={false}
          className="grid size-9 place-items-center rounded-full text-ash transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={`Próximo mês: ${monthLong(next)}`}
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <Link href={hrefFor(current)} scroll={false} className={chip(month === current)} aria-current={month === current ? "true" : undefined}>
        Hoje
      </Link>
      {allowAll ? (
        // No celular este atalho vai para dentro de "Filtros" (ver FilterDrawer).
        <Link
          href={hrefFor("todos")}
          scroll={false}
          className={cn(chip(month === null), "hidden sm:inline-flex")}
          aria-current={month === null ? "true" : undefined}
        >
          Todos os meses
        </Link>
      ) : null}
    </div>
  );
}

/* ---------------- Filtro em botões (links) ---------------- */

export function SegmentedLinks({
  label,
  items,
  className,
}: {
  label: string;
  items: { key: string; label: string; href: string; active: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 w-[calc(100%+2rem)] min-w-0 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:max-w-full sm:px-0",
        className,
      )}
    >
      <ul className="flex w-max gap-1 rounded-full border border-line bg-white/[0.02] p-1" role="group" aria-label={label}>
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              scroll={false}
              aria-current={it.active ? "true" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors",
                it.active ? "bg-white text-void" : "text-ash hover:bg-white/[0.06] hover:text-light",
              )}
            >
              {it.label}
              {it.count != null ? (
                <span className={cn("text-[11px] tabular-nums", it.active ? "text-void/60" : "text-mute")}>{it.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Tipo do lançamento ---------------- */

/**
 * Seta entrando (entrada), saindo (saída) ou prédio (imposto). Sem cor: o tipo
 * vai no desenho e no texto. (A seta ↗ fica reservada para links.)
 */
export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kind === "entrada" ? ArrowDownToLine : kind === "imposto" ? Landmark : ArrowUpFromLine;
  const label = optionLabel(FINANCE_KINDS, kind);
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-ash",
        kind === "entrada" && "text-light",
        className,
      )}
      title={label}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ---------------- Medidor realizado / em aberto ---------------- */

/**
 * Barra fina com o que já foi baixado e o que falta, com 2px de respiro
 * entre as partes (skill dataviz). Decorativa: os valores vão no texto ao lado.
 */
export function SplitMeter({ done, open, doneColor }: { done: number; open: number; doneColor: string }) {
  const total = done + open;
  if (total <= 0) return <span className="block h-1.5 rounded-full bg-white/[0.06]" aria-hidden />;
  const pct = Math.min(100, Math.max(0, (done / total) * 100));
  return (
    <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {done > 0 ? <span className="h-full shrink-0" style={{ width: `${pct}%`, background: doneColor }} /> : null}
      {open > 0 ? <span className="h-full flex-1" style={{ background: FLOW_COLORS.previsto }} /> : null}
    </span>
  );
}

/** Item de legenda: quadradinho da cor da marca + texto em cor de texto. */
export function Key({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />
      {children}
    </span>
  );
}

/* ---------------- Links pequenos (projeto, cliente, freela) ---------------- */

export function MetaLinks({
  lead,
  projectId,
  projectCode,
  clientId,
  clientName,
  freelancerId,
  freelancerName,
  extra,
}: {
  /** Primeiro item, em texto (ex.: a categoria). */
  lead?: string | null;
  projectId?: string | null;
  projectCode?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  freelancerId?: string | null;
  freelancerName?: string | null;
  extra?: (string | null | undefined)[];
}) {
  const parts: React.ReactNode[] = [];
  if (lead) parts.push(<span key="l" className="text-ash">{lead}</span>);
  if (projectId && projectCode) {
    parts.push(
      <Link key="p" href={`/painel/projetos/${projectId}?aba=financeiro`} className="font-mono text-[11px] hover:text-light hover:underline">
        {projectCode}
      </Link>,
    );
  }
  if (clientId && clientName) {
    parts.push(
      <Link key="c" href={`/painel/crm/clientes/${clientId}`} className="hover:text-light hover:underline">
        {clientName}
      </Link>,
    );
  }
  if (freelancerId && freelancerName) {
    parts.push(
      <Link key="f" href={`/painel/freelas/${freelancerId}`} className="hover:text-light hover:underline">
        {freelancerName}
      </Link>,
    );
  }
  for (const [i, e] of (extra ?? []).entries()) if (e) parts.push(<span key={`x${i}`}>{e}</span>);
  if (!parts.length) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-mute">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {p}
          {i < parts.length - 1 ? <span aria-hidden>·</span> : null}
        </span>
      ))}
    </span>
  );
}
