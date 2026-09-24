/**
 * Peças de interface do CRM renderizadas no servidor (lista de atividades,
 * orçamentos, projetos, filtros). Os botões interativos vêm de crm-dialogs.
 */
import Link from "next/link";
import { ArrowRightLeft, Mail, MessageCircle, Phone, StickyNote, Users } from "lucide-react";
import { ProjectStatusBadge, QuoteStatusBadge, StageBadge } from "@/components/painel/bits";
import { brl, dateShort, dateTimeBR } from "@/lib/format";
import type { ActivityRow, ProjectRow, QuoteRow } from "@/lib/queries/crm";
import { cn } from "@/lib/utils";
import { DeleteActivityButton } from "./crm-dialogs";
import { STAGE_ACTIVITY, activityLabel, leadTitle } from "./crm-options";

/* ---------------- Filtro em cápsula ---------------- */

export function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
        active ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------- Histórico ---------------- */

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  nota: StickyNote,
  ligacao: Phone,
  whatsapp: MessageCircle,
  reuniao: Users,
  email: Mail,
  [STAGE_ACTIVITY]: ArrowRightLeft,
};

export function ActivityTimeline({ items, showLead }: { items: ActivityRow[]; showLead?: boolean }) {
  return (
    <ol className="grid">
      {items.map((a, i) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
        const system = a.type === STAGE_ACTIVITY;
        return (
          <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < items.length - 1 ? (
              <span aria-hidden className="absolute top-11 bottom-1 left-[19px] w-px bg-line" />
            ) : null}
            <span
              className={cn(
                "relative grid size-10 shrink-0 place-items-center rounded-full border bg-ink",
                system ? "border-line text-mute" : "border-line-strong text-light",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-3">
                <p className="pt-1.5 text-[12px] leading-snug text-mute">
                  <span className={cn("font-medium", system ? "text-ash" : "text-light")}>{activityLabel(a.type)}</span>
                  {a.authorName ? ` · ${a.authorName}` : ""} · <time>{dateTimeBR(a.createdAt)}</time>
                </p>
                <DeleteActivityButton id={a.id} />
              </div>
              <p className={cn("mt-1 text-[14px] leading-relaxed whitespace-pre-line", system ? "text-mute" : "text-ash")}>
                {a.content}
              </p>
              {showLead && a.leadId ? (
                <Link
                  href={`/painel/crm/${a.leadId}`}
                  className="mt-1.5 inline-block text-[12px] text-mute underline decoration-white/15 underline-offset-4 hover:text-light"
                >
                  No lead {leadTitle({ company: a.leadCompany, name: a.leadName ?? "sem nome" })}
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Orçamentos e projetos ---------------- */

export function QuoteList({ quotes }: { quotes: QuoteRow[] }) {
  return (
    <ul className="grid gap-0.5">
      {quotes.map((q) => (
        <li key={q.id}>
          <Link
            href={`/painel/orcamentos/${q.id}`}
            className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-light">{q.title}</span>
              <span className="font-mono text-[11px] text-mute">
                {q.number}
                {q.version > 1 ? ` v${q.version}` : ""} · {dateShort(q.issueDate)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5">
              {q.total ? <span className="text-[13px] text-light">{brl(q.total)}</span> : null}
              <QuoteStatusBadge status={q.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  return (
    <ul className="grid gap-0.5">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/painel/projetos/${p.id}`}
            className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-light">{p.title}</span>
              <span className="font-mono text-[11px] text-mute">{p.code}</span>
            </span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <StageBadge stage={p.stage} />
              {p.status !== "ativo" ? <ProjectStatusBadge status={p.status} /> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Pergunta e resposta ---------------- */

export function Answer({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const empty = children == null || children === "" || children === "—";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="label text-mute">{label}</dt>
      <dd className={cn("mt-1.5 text-[15px] leading-snug", empty ? "text-mute" : "text-light")}>{empty ? "—" : children}</dd>
    </div>
  );
}
