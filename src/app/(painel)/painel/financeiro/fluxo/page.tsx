import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays } from "lucide-react";
import { CashflowChart } from "@/components/painel/cashflow-chart";
import { EntryStatusBadge, Table, Td, Th } from "@/components/painel/bits";
import { HeroFigure, StatTile } from "@/components/painel/stat";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { PAYMENT_METHODS, PROJECT_STATUS, optionLabel } from "@/lib/domain";
import { brl, dateBR, dateShort, initials, monthLong, todayISO } from "@/lib/format";
import { getCashFlow } from "@/lib/queries/dashboard";
import { freelasToPay, isMonthKey, monthOf, paidToFreelas, projectResults, type ProjectResult } from "@/lib/queries/finance";
import { FLOW_COLORS, FinanceTabs, MonthNav } from "../finance-bits";
import { PayEntryButton } from "../finance-dialogs";

export const metadata: Metadata = { title: "Fluxo e resultado" };

const pctFormat = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Margem abaixo de 20% pede atenção; negativa é prejuízo. Sempre com texto junto da cor. */
function marginTone(r: { margin: number; marginPct: number | null }) {
  if (r.marginPct == null) return null;
  if (r.margin < 0) return "danger" as const;
  if (r.marginPct < 0.2) return "warn" as const;
  return null;
}

/** "Lívia Campos · edição (lote 1)" dentro do grupo da Lívia → "Edição (lote 1)". */
function withoutName(description: string, name: string) {
  const prefix = `${name} · `;
  if (!description.startsWith(prefix)) return description;
  const rest = description.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function Swatch({ color }: { color: string }) {
  return <span className="block size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />;
}

export default async function FluxoPage({ searchParams }: PageProps<"/painel/financeiro/fluxo">) {
  await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const current = monthOf(today);
  const mes = typeof sp.mes === "string" && isMonthKey(sp.mes) ? sp.mes : current;
  const name = monthLong(mes);
  const past = mes < current;

  const [flow, results, toPay, paid] = await Promise.all([
    getCashFlow(-5, 6, `${mes}-15`),
    projectResults(),
    freelasToPay(today),
    paidToFreelas(mes),
  ]);
  const month = flow.months.find((m) => m.key === mes) ?? flow.months[5];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        label="Financeiro"
        title="Fluxo e resultado"
        description="O que entrou e saiu de fato, o que ainda vai entrar e sair, e quanto sobra de cada projeto."
      />

      <FinanceTabs active="fluxo" month={mes} />

      <section aria-label="Filtros" className="flex flex-wrap items-center gap-3">
        <MonthNav month={mes} current={current} hrefFor={(m) => `/painel/financeiro/fluxo?mes=${m}`} />
      </section>

      <section aria-label={`Números de ${name}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <HeroFigure
          className="sm:col-span-2 xl:col-span-4 xl:row-span-2"
          label={`Saldo previsto de ${name}`}
          value={brl(month.saldo)}
          sub="Recebido e a receber, menos pago e a pagar"
        />
        <StatTile
          className="xl:col-span-4"
          label="Recebido"
          value={brl(month.entradasRealizado)}
          sub="Entradas baixadas no mês"
          icon={<Swatch color={FLOW_COLORS.recebido} />}
        />
        <StatTile
          className="xl:col-span-4"
          label="Pago"
          value={brl(month.saidasRealizado)}
          sub="Saídas e impostos baixados no mês"
          icon={<Swatch color={FLOW_COLORS.pago} />}
        />
        <StatTile
          className="xl:col-span-4"
          label="A receber"
          value={brl(month.entradasPrevisto)}
          sub={past ? "Venceu no mês e segue em aberto" : "Entradas em aberto que vencem no mês"}
          icon={<Swatch color={FLOW_COLORS.previsto} />}
        />
        <StatTile
          className="xl:col-span-4"
          label="A pagar"
          value={brl(month.saidasPrevisto)}
          sub={past ? "Venceu no mês e segue em aberto" : "Saídas e impostos em aberto no mês"}
          icon={<Swatch color={FLOW_COLORS.previsto} />}
        />
      </section>

      <Card className="min-w-0">
        <CardHeader
          title="Fluxo de caixa"
          description="Entradas acima da linha, saídas e impostos abaixo. Cinco meses para trás e seis para frente."
        />
        <div className="px-3 pt-5 pb-4 sm:px-6">
          <CashflowChart months={flow.months} current={mes} />
        </div>
      </Card>

      <ProjectResults data={results} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            title="Freelas a pagar"
            description={
              toPay.count
                ? `${brl(toPay.total)} em aberto com ${toPay.groups.length} ${toPay.groups.length === 1 ? "pessoa" : "pessoas"}, de qualquer mês.`
                : "Nada em aberto."
            }
            action={
              <Link href="/painel/freelas" className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
                Freelas <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          {toPay.groups.length ? (
            <ul className="mt-4 border-t border-line">
              {toPay.groups.map((g) => (
                <li key={g.key} className="border-b border-line px-5 py-4 last:border-b-0 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-[13px] font-medium text-light">
                        {initials(g.name)}
                      </span>
                      <div className="min-w-0">
                        {g.freelancerId ? (
                          <Link href={`/painel/freelas/${g.freelancerId}`} className="block truncate text-[15px] text-light hover:underline">
                            {g.name}
                          </Link>
                        ) : (
                          <p className="truncate text-[15px] text-light">{g.name}</p>
                        )}
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-mute">
                          {g.entries.length} lançamento{g.entries.length === 1 ? "" : "s"} · próximo {dateShort(g.nextDue)}
                          {g.overdue ? (
                            <span className="inline-flex items-center gap-1 text-danger">
                              <AlertTriangle className="size-3" aria-hidden /> tem atrasado
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-[17px] font-semibold tracking-[-0.02em] text-white">{brl(g.open)}</p>
                  </div>
                  <ul className="mt-3 grid gap-2 sm:pl-[52px]">
                    {g.entries.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] text-light">{withoutName(e.description, g.name)}</p>
                          <p className="mt-0.5 text-[12px] text-mute">
                            {e.projectCode ? `${e.projectCode} · ` : ""}vence {dateBR(e.dueDate)}
                            {e.paidAmount > 0 ? ` · ${brl(e.paidAmount)} de ${brl(e.amount)} já pago` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <EntryStatusBadge status={e.status} />
                          <span className="text-[14px] text-white tabular-nums">{brl(e.open)}</span>
                          <PayEntryButton
                            entry={{ id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum freela a pagar" description="Quando alguém entra na equipe de um projeto, o pagamento aparece aqui." />
          )}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title={`Pago aos freelas em ${name}`}
            description={
              paid.payments.length
                ? `${brl(paid.total)} em ${paid.payments.length} pagamento${paid.payments.length === 1 ? "" : "s"}, pela data da baixa.`
                : "Nenhum pagamento a freela no mês."
            }
          />
          {paid.payments.length ? (
            <ul className="mt-3 px-3 pb-3">
              {paid.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    {p.freelancerId && p.freelancerName ? (
                      <Link href={`/painel/freelas/${p.freelancerId}`} className="block truncate text-[14px] text-light hover:underline">
                        {p.freelancerName}
                      </Link>
                    ) : (
                      <p className="truncate text-[14px] text-light">{p.description}</p>
                    )}
                    <p className="truncate text-[12px] text-mute">
                      {dateShort(p.date)} · {optionLabel(PAYMENT_METHODS, p.method)}
                      {p.freelancerName ? ` · ${withoutName(p.description, p.freelancerName)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] text-light tabular-nums">{brl(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pt-3 pb-6 text-[14px] text-mute sm:px-6">Os pagamentos registrados aparecem aqui, mês a mês.</p>
          )}
        </Card>
      </section>

      <p className="flex items-start gap-2 text-[12px] text-mute">
        <CalendarDays className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          Recebido e pago pela data da baixa; a receber e a pagar pelo vencimento. Imposto do projeto estimado com a alíquota de{" "}
          <Link href="/painel/ajustes" className="text-ash underline decoration-white/20 underline-offset-4 hover:text-light">
            Ajustes
          </Link>{" "}
          ({String(results.rate).replace(".", ",")}%).
        </span>
      </p>
    </div>
  );
}

function MarginCell({ r }: { r: { margin: number; marginPct: number | null } }) {
  const tone = marginTone(r);
  const pct = r.marginPct == null ? "—" : pctFormat.format(r.marginPct);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="font-medium text-white">{brl(r.margin)}</span>
      {tone ? (
        <Badge tone={tone} dot>
          {tone === "danger" ? "Prejuízo" : "Margem baixa"} · {pct}
        </Badge>
      ) : (
        <span className="text-[12px] text-mute">{pct}</span>
      )}
    </span>
  );
}

function ProjectResults({ data }: { data: Awaited<ReturnType<typeof projectResults>> }) {
  const rate = String(data.rate).replace(".", ",");
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Resultado por projeto"
        description={`Contratado, menos custos e imposto estimado (${rate}%). Do início de cada projeto até hoje.`}
      />
      {data.projects.length ? (
        <>
          <div className="mt-4 hidden md:block">
            <Table minWidth={940}>
              <thead>
                <tr>
                  <Th>Projeto</Th>
                  <Th align="right">Contratado</Th>
                  <Th align="right">Recebido</Th>
                  <Th align="right">A receber</Th>
                  <Th align="right">Custos</Th>
                  <Th align="right">Imposto est.</Th>
                  <Th align="right">Margem</Th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/painel/projetos/${p.id}?aba=financeiro`} className="text-light hover:underline">
                        {p.title}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[11px] text-mute">
                        {p.code}
                        {p.status !== "ativo" ? ` · ${optionLabel(PROJECT_STATUS, p.status).toLowerCase()}` : ""}
                      </span>
                    </Td>
                    <Td align="right">
                      {p.value > 0 ? brl(p.value) : <span className="text-[12px] text-mute">sem valor</span>}
                    </Td>
                    <Td align="right">{brl(p.received)}</Td>
                    <Td align="right" className="text-ash">
                      {brl(p.toReceive)}
                      {p.unscheduled > 0 ? <span className="mt-0.5 block text-[12px] text-mute">+ {brl(p.unscheduled)} sem lançamento</span> : null}
                    </Td>
                    <Td align="right">
                      {brl(p.costs)}
                      {p.costsOpen > 0 ? <span className="mt-0.5 block text-[12px] text-mute">{brl(p.costsOpen)} a pagar</span> : null}
                    </Td>
                    <Td align="right" className="text-ash">
                      {brl(p.tax)}
                    </Td>
                    <Td align="right">
                      <MarginCell r={p} />
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td className="border-b-0 text-mute">Total</Td>
                  <Td align="right" className="border-b-0">
                    {brl(data.totals.value)}
                  </Td>
                  <Td align="right" className="border-b-0">
                    {brl(data.totals.received)}
                  </Td>
                  <Td align="right" className="border-b-0 text-ash">
                    {brl(data.totals.toReceive)}
                  </Td>
                  <Td align="right" className="border-b-0">
                    {brl(data.totals.costs)}
                  </Td>
                  <Td align="right" className="border-b-0 text-ash">
                    {brl(data.totals.tax)}
                  </Td>
                  <Td align="right" className="border-b-0">
                    <MarginCell r={data.totals} />
                  </Td>
                </tr>
              </tfoot>
            </Table>
          </div>

          <ul className="mt-3 border-t border-line md:hidden">
            {data.projects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          title="Nenhum projeto com valores"
          description="Com valor contratado ou lançamentos ligados, o projeto aparece aqui com a margem."
        />
      )}
      {data.hiddenCount > 0 ? (
        <p className="border-t border-line px-5 py-3 text-[12px] text-mute sm:px-6">
          {data.hiddenCount} projeto{data.hiddenCount === 1 ? "" : "s"} sem valor contratado nem lançamentos {data.hiddenCount === 1 ? "ficou" : "ficaram"} de fora.
        </p>
      ) : null}
    </Card>
  );
}

function ProjectCard({ p }: { p: ProjectResult }) {
  const rows: [string, string][] = [
    ["Contratado", p.value > 0 ? brl(p.value) : "sem valor"],
    ["Recebido", brl(p.received)],
    ["A receber", brl(p.toReceive)],
    ["Custos", brl(p.costs)],
    ["Imposto est.", brl(p.tax)],
  ];
  return (
    <li className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/painel/projetos/${p.id}?aba=financeiro`} className="text-[15px] text-light hover:underline">
            {p.title}
          </Link>
          <span className="mt-0.5 block font-mono text-[11px] text-mute">{p.code}</span>
        </div>
        <MarginCell r={p} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="text-mute">{k}</dt>
            <dd className="text-light tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
