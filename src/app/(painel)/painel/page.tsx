import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays, Clapperboard } from "lucide-react";
import { CashflowChart } from "@/components/painel/cashflow-chart";
import { HeroFigure, StatTile } from "@/components/painel/stat";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { EVENT_TYPES, LEAD_STAGES, STAGES, optionLabel, FUNNEL_PROJECT_TYPES, FUNNEL_BUDGETS } from "@/lib/domain";
import { TIMEZONE, brl, dateShort, relativeDay, weekdayShort } from "@/lib/format";
import { getCashFlow, getDashboard } from "@/lib/queries/dashboard";
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

export default async function PainelPage() {
  const user = await requireUser();
  const [data, flow] = await Promise.all([getDashboard(), getCashFlow()]);
  const firstName = user.name.split(" ")[0];
  const inProduction = data.activeProjects.filter((p) => ["producao", "narrativa", "finalizacao"].includes(p.stage)).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        label={todayLong()}
        title={`${greeting()}, ${firstName}.`}
        description="O mês da ZRO em um lugar só: dinheiro, agenda, projetos e leads."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12" aria-label="Números do mês">
        <HeroFigure
          className="sm:col-span-2 xl:col-span-4"
          label="Saldo previsto do mês"
          value={brl(data.saldoPrevisto)}
          sub="Recebido e a receber, menos pago e a pagar"
        />
        <StatTile
          className="xl:col-span-3"
          label="A receber este mês"
          value={brl(data.aReceber)}
          sub={`${brl(data.recebido)} já recebido`}
        />
        <StatTile
          className="xl:col-span-3"
          label="A pagar este mês"
          value={brl(data.aPagar)}
          sub={`${brl(data.pago)} já pago`}
        />
        <StatTile
          className="sm:col-span-2 xl:col-span-2"
          label="Projetos ativos"
          value={data.activeProjects.length}
          sub={`${inProduction} em produção`}
          icon={<Clapperboard />}
        />
      </section>

      {data.lateIn.count || data.lateOut.count ? (
        <section className={cn("grid gap-3", data.lateIn.count && data.lateOut.count ? "lg:grid-cols-2" : null)} aria-label="Atrasados">
          {data.lateIn.count ? (
            <LateBanner kind="entrada" title="Recebimentos atrasados" total={data.lateIn.total} count={data.lateIn.count} first={data.lateIn.items[0]} />
          ) : null}
          {data.lateOut.count ? (
            <LateBanner kind="saida" title="Pagamentos atrasados" total={data.lateOut.total} count={data.lateOut.count} first={data.lateOut.items[0]} />
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-12">
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
                      <span className="block truncate text-[14px] text-light">{ev.title}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-mute">
                        {optionLabel(EVENT_TYPES, ev.type)}
                        {ev.startTime ? ` · ${ev.startTime}` : ""}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </span>
                    </span>
                    <span className="label shrink-0 pt-1 text-mute">{relativeDay(ev.date, data.today)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Semana livre" description="Nenhuma diária, entrega ou reunião nos próximos 7 dias." />
          )}
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader
            title="Leads em aberto"
            description={data.newLeads ? `${data.newLeads} novo${data.newLeads > 1 ? "s" : ""} esperando resposta` : "Nenhum lead novo"}
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
                        <span className="block truncate text-[14px] text-light">
                          {lead.company ?? lead.clientName ?? lead.name}
                        </span>
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
                        <Badge tone={lead.stage === "novo" ? "light" : "neutral"}>
                          {LEAD_STAGES.find((s) => s.key === lead.stage)?.label}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nenhum lead em aberto" description="Os pedidos do site aparecem aqui." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-8">
          <CardHeader
            title="Fluxo de caixa"
            description="Entradas acima da linha, saídas abaixo. Dois meses para trás e três para frente."
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

        <Card className="xl:col-span-4">
          <CardHeader
            title="Projetos por etapa"
            description="O processo criativo da ZRO, de Origem a Entrega."
            action={
              <Link href="/painel/projetos" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
                Projetos <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <ol className="mt-5 grid grid-cols-7 gap-1.5 px-5 sm:px-6">
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
                  <span className="hidden truncate text-[12px] text-ash sm:block xl:hidden 2xl:block">{stage.label}</span>
                  <span className="text-[15px] font-semibold text-white">{count}</span>
                </li>
              );
            })}
          </ol>
          <ul className="mt-5 border-t border-line px-3 py-2">
            {data.activeProjects.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link href={`/painel/projetos/${p.id}`} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-light">{p.title}</span>
                    <span className="font-mono text-[11px] text-mute">{p.code}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Badge>{STAGES.find((s) => s.key === p.stage)?.label}</Badge>
                    <span className="hidden text-[12px] text-mute sm:inline xl:hidden 2xl:inline">{p.dueDate ? `até ${dateShort(p.dueDate)}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

      </section>

      <p className="flex items-center gap-2 text-[12px] text-mute">
        <CalendarDays className="size-3.5" aria-hidden /> Valores do mês pelo vencimento; recebido e pago pela data da baixa.
      </p>
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
