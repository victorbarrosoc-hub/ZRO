import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { EntryStatusBadge, Table, Td, Th } from "@/components/painel/bits";
import { StatTile } from "@/components/painel/stat";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { FINANCE_CATEGORIES } from "@/lib/domain";
import { brl, dateBR, monthLong, todayISO } from "@/lib/format";
import { financeOptions, isMonthKey, monthOf, taxOverview, taxesByMonth } from "@/lib/queries/finance";
import { FinanceTabs, MonthNav, cap } from "../finance-bits";
import { FinanceOptionsProvider, LaunchDasButton, NewEntryButton, PayEntryButton } from "../finance-dialogs";

export const metadata: Metadata = { title: "Impostos" };

type TaxRow = Awaited<ReturnType<typeof taxesByMonth>>["months"][number];

const rateText = (rate: number) => `${String(rate).replace(".", ",")}%`;

function DasStatus({ row }: { row: TaxRow }) {
  if (row.status === "nao-lancado") {
    return row.inProgress ? (
      <Badge>Mês em curso</Badge>
    ) : (
      <Badge tone="warn" dot>
        Não lançado
      </Badge>
    );
  }
  if (row.status === "sem-receita") return <Badge>Sem receita</Badge>;
  return <EntryStatusBadge status={row.status} />;
}

/** Diferença entre o DAS lançado e o estimado, quando passa de R$ 1. */
function Diff({ row }: { row: TaxRow }) {
  if (!row.entries.length) return null;
  const diff = row.launched - row.estimated;
  if (Math.abs(diff) < 100) return null;
  return (
    <span className="mt-0.5 block text-[12px] text-mute">
      {brl(Math.abs(diff))} {diff > 0 ? "acima" : "abaixo"} do estimado
    </span>
  );
}

function DasAction({ row }: { row: TaxRow }) {
  if (row.status === "nao-lancado" && row.estimated > 0) {
    return (
      <LaunchDasButton
        month={row.month}
        amount={row.estimated}
        revenue={row.revenue}
        rate={row.rate}
        dueDate={row.dueDate}
        inProgress={row.inProgress}
      />
    );
  }
  if (row.openEntry) {
    const e = row.openEntry;
    return <PayEntryButton entry={{ id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount }} />;
  }
  return null;
}

export default async function ImpostosPage({ searchParams }: PageProps<"/painel/financeiro/impostos">) {
  await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const current = monthOf(today);
  const mes = typeof sp.mes === "string" && isMonthKey(sp.mes) ? sp.mes : current;
  const year = mes.slice(0, 4);

  const [taxes, overview, options] = await Promise.all([taxesByMonth(mes, 7, today), taxOverview(year, today), financeOptions()]);
  const oldest = taxes.months[taxes.months.length - 1].month;

  return (
    <FinanceOptionsProvider options={options}>
      <div className="grid grid-cols-1 gap-8">
        <PageHeader
          label="Financeiro"
          title="Impostos"
          description="Simples Nacional mês a mês: quanto entrou, o DAS estimado e o que já foi lançado e pago."
          actions={<NewEntryButton defaultKind="imposto" label="Novo imposto" />}
        />

        <FinanceTabs active="impostos" month={mes} />

        <section aria-label="Filtros" className="flex flex-wrap items-center gap-3">
          <MonthNav month={mes} current={current} hrefFor={(m) => `/painel/financeiro/impostos?mes=${m}`} prefix="Até" />
        </section>

        <section aria-label="Resumo dos impostos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            className="justify-start"
            label="A pagar"
            value={brl(overview.openTotal)}
            tone={overview.overdueTotal > 0 ? "danger" : "default"}
            sub={
              overview.openCount ? (
                <>
                  <span className="block">
                    {overview.openCount} lançamento{overview.openCount === 1 ? "" : "s"}
                    {overview.nextDue ? ` · próximo vence ${dateBR(overview.nextDue)}` : ""}
                  </span>
                  {overview.overdueTotal > 0 ? (
                    <span className="mt-1.5 flex items-center gap-1.5 text-danger">
                      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                      {brl(overview.overdueTotal)} atrasado
                    </span>
                  ) : null}
                </>
              ) : (
                "Nenhum imposto em aberto"
              )
            }
          />
          <StatTile className="justify-start" label={`Pagos em ${year}`} value={brl(overview.paidInYear)} sub="DAS e outros impostos, pela data do pagamento" />
          <StatTile
            className="justify-start sm:col-span-2 xl:col-span-1"
            label="Alíquota efetiva"
            value={rateText(taxes.rate)}
            sub={
              <>
                Estimada em{" "}
                <Link href="/painel/ajustes" className="text-ash underline decoration-white/20 underline-offset-4 hover:text-light">
                  Ajustes
                </Link>
                . Vale para o DAS e para o resultado dos projetos.
              </>
            }
          />
        </section>

        <Card className="overflow-hidden">
          <CardHeader
            title="DAS mês a mês"
            description={`${cap(monthLong(oldest))} a ${monthLong(mes)}. Receita pelo que entrou de fato no mês (data da baixa).`}
          />

          <div className="mt-4 hidden md:block">
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th>Competência</Th>
                  <Th align="right">Receita recebida</Th>
                  <Th align="right">Alíquota</Th>
                  <Th align="right">DAS estimado</Th>
                  <Th align="right">DAS lançado</Th>
                  <Th>Vencimento</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {taxes.months.map((row) => (
                  <tr key={row.month} className="transition-colors hover:bg-white/[0.02]">
                    <Td className="whitespace-nowrap">
                      {cap(monthLong(row.month))}
                      {row.inProgress ? <span className="mt-0.5 block text-[12px] text-mute">até hoje</span> : null}
                    </Td>
                    <Td align="right">{brl(row.revenue)}</Td>
                    <Td align="right" className="text-ash">
                      {rateText(row.rate)}
                    </Td>
                    <Td align="right">{brl(row.estimated)}</Td>
                    <Td align="right">
                      {row.entries.length ? brl(row.launched) : <span className="text-mute">—</span>}
                      <Diff row={row} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {row.status === "sem-receita" ? (
                        <span className="text-mute">—</span>
                      ) : (
                        <span className={row.entries.length ? "tabular-nums" : "text-mute tabular-nums"}>{dateBR(row.dueDate)}</span>
                      )}
                    </Td>
                    <Td>
                      <DasStatus row={row} />
                    </Td>
                    <Td align="right" className="w-40">
                      <DasAction row={row} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <ul className="mt-3 border-t border-line md:hidden">
            {taxes.months.map((row) => (
              <li key={row.month} className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] text-light">{cap(monthLong(row.month))}</p>
                    <p className="mt-0.5 text-[12px] text-mute">
                      Receita {brl(row.revenue)}
                      {row.inProgress ? " até hoje" : ""} · {rateText(row.rate)}
                    </p>
                  </div>
                  <DasStatus row={row} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-mute">Estimado</dt>
                    <dd className="text-light tabular-nums">{brl(row.estimated)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-mute">Lançado</dt>
                    <dd className="text-light tabular-nums">{row.entries.length ? brl(row.launched) : "—"}</dd>
                  </div>
                  {row.status !== "sem-receita" ? (
                    <div className="col-span-2 flex items-baseline justify-between gap-2">
                      <dt className="text-mute">Vencimento</dt>
                      <dd className="text-light tabular-nums">{dateBR(row.dueDate)}</dd>
                    </div>
                  ) : null}
                </dl>
                <Diff row={row} />
                <DasActionMobile row={row} />
              </li>
            ))}
          </ul>
        </Card>

        {overview.others.length ? (
          <Card className="overflow-hidden">
            <CardHeader title="Outros impostos em aberto" description="ISS e demais impostos lançados, de qualquer mês." />
            <ul className="mt-3 border-t border-line">
              {overview.others.map((e) => (
                <li
                  key={e.id}
                  className="grid gap-3 border-b border-line px-5 py-3.5 last:border-b-0 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] text-light">{e.description}</p>
                    <p className="mt-0.5 text-[12px] text-mute">
                      {FINANCE_CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}
                      {e.competence && isMonthKey(e.competence) ? ` · competência ${monthLong(e.competence)}` : ""} · vence {dateBR(e.dueDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <EntryStatusBadge status={e.status} />
                    <span className="ml-auto text-[14px] text-white tabular-nums sm:ml-0">{brl(e.open)}</span>
                    <PayEntryButton
                      entry={{ id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount }}
                      className="h-10 sm:h-8"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <p className="flex items-start gap-2 text-[13px] text-ash">
          <Info className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden />
          <span>
            Alíquota efetiva estimada em{" "}
            <Link href="/painel/ajustes" className="underline decoration-white/20 underline-offset-4 hover:text-light">
              Ajustes
            </Link>
            . Confirme os valores com o contador.
          </span>
        </p>
      </div>
    </FinanceOptionsProvider>
  );
}

/** No celular a ação ocupa a largura toda, com alvo de toque de 40px. */
function DasActionMobile({ row }: { row: TaxRow }) {
  const hasAction = (row.status === "nao-lancado" && row.estimated > 0) || Boolean(row.openEntry);
  if (!hasAction) return null;
  return (
    <div className="[&_button]:h-10 [&_button]:w-full">
      <DasAction row={row} />
    </div>
  );
}
