import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Clapperboard } from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { TabLinks } from "@/components/painel/bits";
import { PayEntryButton } from "./projetos/[id]/_components/finance-dialogs";
import { CashflowChart } from "@/components/painel/cashflow-chart";
import { HeroFigure, StatTile } from "@/components/painel/stat";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { EVENT_TYPES, eventColorHex, LEAD_STAGES, STAGES, optionLabel, FUNNEL_PROJECT_TYPES, FUNNEL_BUDGETS } from "@/lib/domain";
import { TIMEZONE, brl, brlCompact, dateShort, monthLong, relativeDay, weekdayShort } from "@/lib/format";
import { getCashFlow, getDashboard, getFreelaPayables, getProjectsOverview, type FreelaPayables, type ProjectOverviewRow } from "@/lib/queries/dashboard";
import { getRecurringOverview } from "@/lib/queries/crm";
import { getTaxRate } from "@/lib/queries/projects";
import { conferirRecorrentes } from "@/lib/services/recurring";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visão geral" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLong() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "projetos", label: "Projetos" },
  { key: "freelas", label: "Freelas a pagar" },
  { key: "caixa", label: "Fluxo de caixa" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const user = await requireUser();
  const sp = await searchParams;
  const aba: TabKey = TABS.find((t) => t.key === sp.aba)?.key ?? "resumo";
  // antes dos números: no começo do mês, a cobrança dos contratos recorrentes já entra no previsto
  await conferirRecorrentes(user.id);
  const taxRate = await getTaxRate();
  const [data, flow, overview, payables, recorrentes] = await Promise.all([
    getDashboard(),
    getCashFlow(),
    getProjectsOverview(taxRate),
    getFreelaPayables(),
    getRecurringOverview(),
  ]);
  const firstName = user.name.split(" ")[0];
  const inProduction = data.activeProjects.filter((p) => ["producao", "narrativa", "finalizacao"].includes(p.stage)).length;
  const counts: Partial<Record<TabKey, number>> = { projetos: overview.length, freelas: payables.people.length };

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader label={todayLong()} title={`${greeting()}, ${firstName}.`} />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-12" aria-label="Números do mês">
        <HeroFigure
          className="col-span-2 xl:col-span-4"
          label="Saldo previsto do mês"
          value={brl(data.saldoPrevisto)}
          sub={`${brl(data.recebido)} recebido · ${brl(data.pago)} pago`}
        />
        <StatTile className="xl:col-span-2" label="A receber" value={brlCompact(data.aReceber)} sub="neste mês" />
        <StatTile className="xl:col-span-2" label="A pagar" value={brlCompact(data.aPagar)} sub="neste mês" />
        <Link href="/painel?aba=freelas" scroll={false} className="group block rounded-[22px] xl:col-span-2">
          <StatTile
            className="h-full transition-colors group-hover:border-white/20"
            label="Freelas a pagar"
            value={brlCompact(payables.total)}
            sub={payables.late ? `${brlCompact(payables.late)} vencido` : `${payables.people.length} pessoa${payables.people.length === 1 ? "" : "s"}`}
            tone={payables.late ? "danger" : "default"}
          />
        </Link>
        <Link href="/painel?aba=projetos" scroll={false} className="group block rounded-[22px] xl:col-span-2">
          <StatTile
            className="h-full transition-colors group-hover:border-white/20"
            label="Projetos ativos"
            value={data.activeProjects.length}
            sub={`${inProduction} em produção`}
            icon={<Clapperboard />}
          />
        </Link>
      </section>

      {data.lateIn.count || data.lateOut.count ? (
        <section className={cn("grid grid-cols-1 gap-3", data.lateIn.count && data.lateOut.count ? "lg:grid-cols-2" : null)} aria-label="Atrasados">
          {data.lateIn.count ? (
            <LateBanner kind="entrada" title="Recebimentos atrasados" total={data.lateIn.total} count={data.lateIn.count} first={data.lateIn.items[0]} />
          ) : null}
          {data.lateOut.count ? (
            <LateBanner kind="saida" title="Pagamentos atrasados" total={data.lateOut.total} count={data.lateOut.count} first={data.lateOut.items[0]} />
          ) : null}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6">
        <TabLinks
          active={aba}
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: t.key === "resumo" ? "/painel" : `/painel?aba=${t.key}` }))}
        />
        {aba === "resumo" ? <ResumoTab data={data} recorrentes={recorrentes} /> : null}
        {aba === "projetos" ? <ProjectsOverview rows={overview} today={data.today} /> : null}
        {aba === "freelas" ? <FreelaPayablesList payables={payables} today={data.today} /> : null}
        {aba === "caixa" ? (
          <Card className="min-w-0">
            <CardHeader
              title="Fluxo de caixa"
              action={
                <Link href="/painel/financeiro/fluxo" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
                  Detalhes <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
            <div className="px-3 pt-5 pb-4 sm:px-6">
              <CashflowChart months={flow.months} current={flow.current} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
type Recorrentes = Awaited<ReturnType<typeof getRecurringOverview>>;

function ResumoTab({ data, recorrentes }: { data: Dashboard; recorrentes: Recorrentes }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-7">
        <CardHeader
          title="Próximos 7 dias"
          action={
            <Link href="/painel/agenda" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
              Agenda <ArrowUpRight className="size-3.5" />
            </Link>
          }
        />
        {data.upcoming.length ? (
          <ul className="mt-4 px-3 pb-3">
            {data.upcoming.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={ev.projectId ? `/painel/projetos/${ev.projectId}?aba=agenda` : "/painel/agenda"}
                  className="flex items-start gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="grid w-11 shrink-0 text-center">
                    <span className="label text-mute">{weekdayShort(ev.date)}</span>
                    <span className="text-[20px] leading-tight font-semibold text-white">{Number(ev.date.slice(8, 10))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] text-light">
                      {eventColorHex(ev.color) ? (
                        <span className="size-2 shrink-0 rounded-full" style={{ background: eventColorHex(ev.color)! }} aria-hidden />
                      ) : null}
                      <span className="truncate">{ev.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-mute">
                      {ev.ownerName ? `${ev.ownerName.split(" ")[0]} · ` : ""}
                      {optionLabel(EVENT_TYPES, ev.type)}
                      {ev.startTime ? ` · ${ev.startTime}` : ""}
                      {ev.projectTitle ? ` · ${ev.projectTitle}` : ev.location ? ` · ${ev.location}` : ""}
                    </span>
                  </span>
                  <span className="label shrink-0 pt-1 text-mute">{relativeDay(ev.date, data.today)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Semana livre" />
        )}
      </Card>

      <Card className="xl:col-span-5">
        <CardHeader
          title="Leads em aberto"
          action={
            <Link href="/painel/crm" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
              CRM <ArrowUpRight className="size-3.5" />
            </Link>
          }
        />
        {data.openLeads.length ? (
          <ul className="mt-3 px-3 pb-3">
            {data.openLeads.slice(0, 6).map((lead) => {
              const followLate = lead.followUpAt && lead.followUpAt <= data.today;
              return (
                <li key={lead.id}>
                  <Link href={`/painel/crm/${lead.id}`} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-light">{lead.company ?? lead.clientName ?? lead.name}</span>
                      <span className="block truncate text-[12px] text-mute">
                        {optionLabel(FUNNEL_PROJECT_TYPES, lead.projectType)}
                        {lead.budget ? ` · ${optionLabel(FUNNEL_BUDGETS, lead.budget)}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {followLate ? (
                        <Badge tone="warn" dot>
                          Retornar
                        </Badge>
                      ) : null}
                      <Badge tone={lead.stage === "novo" ? "light" : "neutral"}>{LEAD_STAGES.find((s) => s.key === lead.stage)?.label}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Nenhum lead em aberto" />
        )}
      </Card>

      {recorrentes.clientes.length ? <RecurringContracts rec={recorrentes} /> : null}

      <Card className="xl:col-span-12">
        <CardHeader
          title="Projetos por etapa"
          action={
            <Link href="/painel/projetos" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
              Projetos <ArrowUpRight className="size-3.5" />
            </Link>
          }
        />
        <ol className="mt-5 grid grid-cols-7 gap-1.5 px-5 pb-5 sm:gap-3 sm:px-6 sm:pb-6">
          {STAGES.map((stage) => {
            const count = data.stageCounts[stage.key] ?? 0;
            return (
              <li key={stage.key} className="grid gap-2">
                <div className="flex h-20 items-end rounded-xl bg-white/[0.03] p-1.5">
                  <div
                    className={cn("w-full rounded-lg transition-all", count ? "bg-white/85" : "bg-white/10")}
                    style={{ height: `${count ? Math.max(18, (count / Math.max(1, data.activeProjects.length)) * 100) : 6}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-mute">{stage.n}</span>
                <span className="hidden truncate text-[12px] text-ash sm:block">{stage.label}</span>
                <span className="text-[15px] font-semibold text-white">{count}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

/** Situação da cobrança do mês de um contrato recorrente. */
function cobranca(c: Recorrentes["clientes"][number]) {
  const m = c.mes;
  if (!m.lancado) return { label: "Não lançada", tone: "neutral" as const };
  if (!m.vence) return { label: "Recebida", tone: "ok" as const };
  const dia = Number(m.vence.slice(8, 10));
  if (m.vence < m.hoje) return { label: `Venceu dia ${dia}`, tone: "danger" as const };
  return { label: `Vence dia ${dia}`, tone: "light" as const };
}

/** Contratos recorrentes: quanto rendem por mês e como está o mês de cada um. */
function RecurringContracts({ rec }: { rec: Recorrentes }) {
  const mes = rec.clientes[0].mes.mes;
  const recebido = rec.clientes.reduce((n, c) => n + c.mes.recebido, 0);
  const n = rec.clientes.length;
  return (
    <Card className="min-w-0 xl:col-span-12">
      <CardHeader
        title="Contratos recorrentes"
        action={
          <Link href="/painel/crm/clientes" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
            Clientes <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
      <div className="grid gap-5 px-5 pt-4 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
        <div className="grid content-start gap-1.5">
          <p className="label text-mute">Por mês</p>
          <p className="text-[30px] leading-none font-semibold tracking-[-0.03em] text-white tabular-nums">{brl(rec.total)}</p>
          <p className="text-[13px] text-mute">
            {n} {n === 1 ? "contrato" : "contratos"} · {brl(recebido)} recebido em {monthLong(mes).split(" de ")[0]}
          </p>
        </div>
        <ul className="-mx-3 grid min-w-0 content-start">
          {rec.clientes.map((c) => {
            const st = cobranca(c);
            return (
              <li key={c.id}>
                <Link
                  href={`/painel/crm/clientes/${c.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_6rem_6rem_7.5rem]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={c.name} imageId={c.logoId} logo size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-light">{c.name}</span>
                      <span className="block truncate text-[12px] text-mute tabular-nums">{brl(c.r.value)} por mês</span>
                    </span>
                  </span>
                  <span className="hidden text-[12px] text-mute sm:block">
                    Diárias
                    <span className="block text-[14px] text-light tabular-nums">
                      {c.mes.feitas} de {c.r.days}
                    </span>
                  </span>
                  <span className="hidden text-[12px] text-mute sm:block">
                    Entregas
                    <span className="block text-[14px] text-light tabular-nums">
                      {c.mes.cards.total ? `${c.mes.cards.prontas} de ${c.mes.cards.total}` : "—"}
                    </span>
                  </span>
                  <Badge tone={st.tone} dot={st.tone === "danger"} className="justify-self-end">
                    {st.label}
                  </Badge>
                  <span className="col-span-2 flex gap-4 pl-11 text-[12px] text-mute tabular-nums sm:hidden">
                    <span>
                      Diárias {c.mes.feitas} de {c.r.days}
                    </span>
                    {c.mes.cards.total ? (
                      <span>
                        Entregas {c.mes.cards.prontas} de {c.mes.cards.total}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/** Aba Projetos: cada projeto ativo com cliente, etapa, próxima diária e o dinheiro. */
function ProjectsOverview({ rows, today }: { rows: ProjectOverviewRow[]; today: string }) {
  if (!rows.length) {
    return (
      <Card>
        <EmptyState title="Nenhum projeto ativo" />
      </Card>
    );
  }
  return (
    <Card className="min-w-0 overflow-hidden">
      <ul>
        {rows.map((p) => {
          const late = p.dueDate && p.dueDate < today;
          return (
            <li key={p.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/painel/projetos/${p.id}`}
                className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-white/[0.03] sm:px-6 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] lg:items-center"
              >
                <span className="col-span-2 min-w-0 lg:col-span-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-light">{p.title}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-mute">
                    <span className="font-mono">{p.code}</span>
                    {p.clientName ? <span>· {p.clientName}</span> : null}
                    <span>· {STAGES.find((s) => s.key === p.stage)?.label}</span>
                  </span>
                </span>
                <Figure label="Próxima diária" value={p.nextDiaria ? dateShort(p.nextDiaria) : "—"} />
                <Figure label="Prazo" value={p.dueDate ? dateShort(p.dueDate) : "—"} tone={late ? "danger" : undefined} />
                <Figure label="Contratado" value={p.value ? brlCompact(p.value) : "—"} sub={p.receivable ? `falta receber ${brlCompact(p.receivable)}` : undefined} />
                <Figure label="Equipe a pagar" value={p.crewOpen ? brlCompact(p.crewOpen) : "—"} tone={p.crewOpen ? "warn" : undefined} />
                <Figure
                  label="Margem"
                  value={p.margin != null ? brlCompact(p.margin) : "—"}
                  tone={p.margin != null && p.margin < 0 ? "danger" : undefined}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Figure({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "danger" }) {
  return (
    <span className="min-w-0">
      <span className="block text-[11px] text-mute">{label}</span>
      <span
        className={cn(
          "mt-0.5 block truncate text-[14px] tabular-nums",
          tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-light",
        )}
      >
        {value}
      </span>
      {sub ? <span className="block truncate text-[11px] text-mute">{sub}</span> : null}
    </span>
  );
}

/** Aba Freelas a pagar: quem a ZRO deve, quanto, até quando, de qual projeto. */
function FreelaPayablesList({ payables, today }: { payables: FreelaPayables; today: string }) {
  if (!payables.people.length) {
    return (
      <Card>
        <EmptyState title="Nenhum freela a pagar" />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {payables.people.map((p) => (
        <Card key={p.freelancerId} className={cn("min-w-0", p.late && "border-danger/25")}>
          <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
            <Link href={`/painel/freelas/${p.freelancerId}`} className="flex min-w-0 items-center gap-3 hover:underline">
              <Avatar name={p.name} imageId={p.photoId} size="md" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-light">{p.name}</span>
                {p.pixKey ? <span className="block truncate text-[12px] text-mute">Pix {p.pixKey}</span> : null}
              </span>
            </Link>
            <span className="shrink-0 text-right">
              <span className="block text-[20px] font-semibold tracking-[-0.02em] text-white tabular-nums">{brl(p.open)}</span>
              {p.late ? <span className="block text-[12px] text-danger tabular-nums">{brl(p.late)} vencido</span> : null}
            </span>
          </div>
          <ul className="mt-3 px-2 pb-2 sm:px-3">
            {p.entries.map((e) => {
              const late = e.dueDate < today;
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ash">{e.projectTitle ?? e.description}</span>
                    <span className={cn("block text-[12px] tabular-nums", late ? "text-danger" : "text-mute")}>
                      {late ? "venceu" : "vence"} {dateShort(e.dueDate)} · {brl(e.amount - e.paidAmount)}
                      {e.paidAmount ? ` (de ${brl(e.amount)})` : ""}
                    </span>
                  </span>
                  <PayEntryButton projectId={e.projectId ?? ""} entry={e} label="Pagar" />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function LateBanner({
  kind,
  title,
  total,
  count,
  first,
}: {
  kind: "entrada" | "saida";
  title: string;
  total: number;
  count: number;
  first?: { id: string; description: string; amount: number; paidAmount: number; dueDate: string };
}) {
  return (
    <Link
      href={`/painel/financeiro?status=atrasado&tipo=${kind}`}
      className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-danger/25 bg-danger/[0.04] px-5 py-4 transition-colors hover:border-danger/45"
    >
      <span className="flex items-center gap-3">
        <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
        <span className="text-[14px] text-light">
          {title} <span className="font-semibold text-white">{brl(total)}</span>
          <span className="text-mute">
            {" "}
            · {count} vencido{count > 1 ? "s" : ""}
          </span>
        </span>
      </span>
      {first ? (
        <span className="flex min-w-0 items-center gap-3 text-[13px] text-mute">
          <span className="truncate">
            {first.description} · desde {dateShort(first.dueDate)}
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-ash transition-transform group-hover:rotate-45" aria-hidden />
        </span>
      ) : null}
    </Link>
  );
}
