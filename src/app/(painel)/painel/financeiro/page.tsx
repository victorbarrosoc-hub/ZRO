import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { EntryStatusBadge, Table, Td, Th } from "@/components/painel/bits";
import { SearchField } from "@/components/painel/search-field";
import { StatTile } from "@/components/painel/stat";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { FINANCE_CATEGORIES, type EntryStatus, type FinanceKind } from "@/lib/domain";
import { brl, dateBR, monthLong, relativeDay, todayISO } from "@/lib/format";
import {
  financeOptions,
  isMonthKey,
  listEntries,
  monthOf,
  type FinanceEntryRow,
  type KindTotals,
} from "@/lib/queries/finance";
import { FLOW_COLORS, FinanceTabs, KindIcon, Key, MetaLinks, MonthNav, SegmentedLinks, SplitMeter, cap } from "./finance-bits";
import { EntryActions, FinanceOptionsProvider, NewEntryButton, PayEntryButton, type DialogEntry } from "./finance-dialogs";
import { FilterDrawer, ProjectFilter } from "./finance-filters";

export const metadata: Metadata = { title: "Lançamentos" };

const KINDS: { key: FinanceKind; label: string }[] = [
  { key: "entrada", label: "Entradas" },
  { key: "saida", label: "Saídas" },
  { key: "imposto", label: "Impostos" },
];

const STATUSES: { key: EntryStatus; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "parcial", label: "Parcial" },
  { key: "atrasado", label: "Atrasado" },
  { key: "pago", label: "Pago" },
];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function categoryLabel(key: string) {
  return FINANCE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function toDialog(e: FinanceEntryRow): DialogEntry {
  return {
    id: e.id,
    kind: e.kind,
    category: e.category,
    description: e.description,
    amount: e.amount,
    paidAmount: e.paidAmount,
    dueDate: e.dueDate,
    projectId: e.projectId,
    clientId: e.clientId,
    freelancerId: e.freelancerId,
    installment: e.installment,
    competence: e.competence,
    notes: e.notes,
  };
}

function extras(e: FinanceEntryRow) {
  return [
    e.installment ? `parcela ${e.installment}` : null,
    e.kind === "imposto" && e.competence && isMonthKey(e.competence) ? `competência ${monthLong(e.competence)}` : null,
  ];
}

export default async function LancamentosPage({ searchParams }: PageProps<"/painel/financeiro">) {
  await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const current = monthOf(today);

  const tipo = KINDS.find((k) => k.key === one(sp.tipo))?.key;
  const status = STATUSES.find((s) => s.key === one(sp.status))?.key;
  const projeto = one(sp.projeto) || undefined;
  const q = one(sp.q)?.trim() || undefined;
  const mes = one(sp.mes);
  // Sem ?mes: o mês atual. O link "atrasados" do painel vem sem mês e mostra todos os meses.
  const month: string | null = mes === "todos" ? null : isMonthKey(mes) ? mes : status === "atrasado" ? null : current;

  const [{ entries, summary, kindCounts, statusCounts }, options] = await Promise.all([
    listEntries({ month, kind: tipo, status, project: projeto, q }, today),
    financeOptions(),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = { mes: month ?? "todos", tipo, status, projeto, q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/painel/financeiro?${params}`;
  };

  const scope = month ? monthLong(month) : "todos os meses";
  const projectName =
    projeto === "sem" ? "sem projeto" : projeto ? options.projects.find((p) => p.id === projeto)?.code : undefined;
  const hasFilters = Boolean(tipo || status || projeto);

  return (
    <FinanceOptionsProvider options={options}>
      <div className="grid grid-cols-1 gap-8">
        <PageHeader
          label="Financeiro"
          title="Lançamentos"
          actions={<NewEntryButton defaultKind={tipo} defaultProjectId={projeto && projeto !== "sem" ? projeto : undefined} />}
        />

        <FinanceTabs active="lancamentos" month={month} />

        <section aria-label="Filtros" className="flex flex-wrap items-center gap-3">
          <MonthNav month={month} current={current} hrefFor={(m) => qs({ mes: m })} allowAll />
          <SearchField placeholder="Buscar lançamento" className="min-w-0 flex-1 md:max-w-80 lg:ml-auto" />
          <FilterDrawer active={[tipo, status, projeto].filter(Boolean).length}>
            <SegmentedLinks
              label="Período"
              className="sm:hidden"
              items={[
                { key: "mes", label: "Um mês", href: qs({ mes: month ?? current }), active: month !== null },
                { key: "todos", label: "Todos os meses", href: qs({ mes: "todos" }), active: month === null },
              ]}
            />
            <SegmentedLinks
              label="Tipo"
              items={[
                { key: "todos", label: "Todos", href: qs({ tipo: undefined }), active: !tipo, count: kindCounts.todos },
                ...KINDS.map((k) => ({
                  key: k.key,
                  label: k.label,
                  href: qs({ tipo: k.key }),
                  active: tipo === k.key,
                  count: kindCounts[k.key],
                })),
              ]}
            />
            <SegmentedLinks
              label="Status"
              items={[
                { key: "todos", label: "Todos", href: qs({ status: undefined }), active: !status, count: statusCounts.todos },
                ...STATUSES.map((s) => ({
                  key: s.key,
                  label: s.label,
                  href: qs({ status: s.key }),
                  active: status === s.key,
                  count: statusCounts[s.key],
                })),
              ]}
            />
            <ProjectFilter key={projeto ?? ""} value={projeto} projects={options.projects} className="md:w-56" />
          </FilterDrawer>
        </section>

        <section
          aria-label="Resumo do recorte"
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4"
        >
          <MoneyTile label="Entradas" totals={summary.entrada} doneLabel="recebido" openLabel="a receber" doneColor={FLOW_COLORS.recebido} off={Boolean(tipo && tipo !== "entrada")} />
          <MoneyTile label="Saídas" totals={summary.saida} doneLabel="pago" openLabel="a pagar" doneColor={FLOW_COLORS.pago} off={Boolean(tipo && tipo !== "saida")} />
          <MoneyTile label="Impostos" totals={summary.imposto} doneLabel="pago" openLabel="a pagar" doneColor={FLOW_COLORS.pago} off={Boolean(tipo && tipo !== "imposto")} />
          <StatTile
            className="w-[82%] shrink-0 snap-start justify-start sm:w-auto"
            label="Saldo previsto"
            value={tipo ? "—" : brl(summary.saldoPrevisto)}
            sub={
              tipo ? (
                "Aparece com todos os tipos"
              ) : (
                <>
                  <span className="block text-ash">{brl(summary.saldoRealizado)} realizado</span>
                  <span className="mt-1 block">Entradas menos saídas e impostos</span>
                </>
              )
            }
          />
        </section>

        <Card className="overflow-hidden">
          <CardHeader
            title={`${entries.length} lançamento${entries.length === 1 ? "" : "s"}`}
            description={[
              cap(scope),
              tipo ? KINDS.find((k) => k.key === tipo)?.label.toLowerCase() : null,
              status ? STATUSES.find((s) => s.key === status)?.label.toLowerCase() : null,
              projectName,
              q ? `busca “${q}”` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />

          {entries.length ? (
            <>
              {/* Desktop e tablet: tabela */}
              <div className="mt-4 hidden md:block">
                <Table minWidth={820}>
                  <thead>
                    <tr>
                      <Th>Vencimento</Th>
                      <Th>Lançamento</Th>
                      <Th align="right">Valor</Th>
                      <Th align="right">Baixado</Th>
                      <Th>Status</Th>
                      <Th>
                        <span className="sr-only">Ações</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="transition-colors hover:bg-white/[0.02]">
                        <Td className="w-32 whitespace-nowrap">
                          <span className="block tabular-nums">{dateBR(e.dueDate)}</span>
                          {e.open > 0 ? <span className="mt-0.5 block text-[12px] text-mute">{relativeDay(e.dueDate, today)}</span> : null}
                        </Td>
                        <Td>
                          <div className="flex items-start gap-3">
                            <KindIcon kind={e.kind} />
                            <div className="min-w-0 pt-1">
                              <p className="leading-snug">{e.description}</p>
                              <MetaLinks
                                projectId={e.projectId}
                                projectCode={e.projectCode}
                                clientId={e.clientId}
                                clientName={e.clientName}
                                freelancerId={e.freelancerId}
                                freelancerName={e.freelancerName}
                                lead={categoryLabel(e.category)}
                                extra={extras(e)}
                              />
                            </div>
                          </div>
                        </Td>
                        <Td align="right" className="whitespace-nowrap">
                          {brl(e.amount)}
                        </Td>
                        <Td align="right" className="whitespace-nowrap text-ash">
                          {brl(e.paidAmount)}
                          {e.paidAmount > 0 && e.open > 0 ? (
                            <span className="mt-0.5 block text-[12px] text-mute">falta {brl(e.open)}</span>
                          ) : null}
                        </Td>
                        <Td>
                          <EntryStatusBadge status={e.status} />
                        </Td>
                        <Td align="right" className="w-40">
                          <EntryActions entry={toDialog(e)} payments={e.payments} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Celular: cartões */}
              <ul className="mt-3 border-t border-line md:hidden">
                {entries.map((e) => (
                  <li key={e.id} className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0">
                    <div className="flex items-start gap-3">
                      <KindIcon kind={e.kind} />
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[15px] leading-snug text-light">{e.description}</p>
                        <MetaLinks
                          projectId={e.projectId}
                          projectCode={e.projectCode}
                          clientId={e.clientId}
                          clientName={e.clientName}
                          freelancerId={e.freelancerId}
                          freelancerName={e.freelancerName}
                          extra={extras(e)}
                        />
                      </div>
                      <EntryActions entry={toDialog(e)} payments={e.payments} showPay={false} className="-mt-1 -mr-2" />
                    </div>
                    <div className="flex items-end justify-between gap-3 pl-11">
                      <div className="min-w-0">
                        <p className="text-[18px] leading-tight font-semibold tracking-[-0.02em] text-white">{brl(e.amount)}</p>
                        <p className="mt-1 text-[12px] text-mute">
                          {categoryLabel(e.category)} · vence {dateBR(e.dueDate)}
                          {e.open > 0 ? ` (${relativeDay(e.dueDate, today)})` : ""}
                        </p>
                        {e.paidAmount > 0 && e.open > 0 ? (
                          <p className="text-[12px] text-mute">
                            {brl(e.paidAmount)} baixado · falta {brl(e.open)}
                          </p>
                        ) : null}
                      </div>
                      <EntryStatusBadge status={e.status} />
                    </div>
                    {e.open > 0 ? (
                      <div className="pl-11">
                        <PayEntryButton
                          entry={{ id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount }}
                          size="md"
                          className="w-full"
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyList month={month} status={status} q={q} hasFilters={hasFilters} qs={qs} tipo={tipo} projeto={projeto} />
          )}
        </Card>

      </div>
    </FinanceOptionsProvider>
  );
}

/** Resumo de um tipo: total do recorte, medidor baixado/em aberto e o atrasado. */
function MoneyTile({
  label,
  totals,
  doneLabel,
  openLabel,
  doneColor,
  off,
}: {
  label: string;
  totals: KindTotals;
  doneLabel: string;
  openLabel: string;
  doneColor: string;
  off: boolean;
}) {
  const className = "w-[82%] shrink-0 snap-start justify-start sm:w-auto";
  if (off) return <StatTile className={className} label={label} value="—" sub="Fora do filtro de tipo" />;
  return (
    <StatTile
      className={className}
      label={label}
      value={brl(totals.total)}
      tone={totals.overdue > 0 ? "danger" : "default"}
      sub={
        <>
          <SplitMeter done={totals.paid} open={totals.open} doneColor={doneColor} />
          <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Key color={doneColor}>
              <span className="text-ash">{brl(totals.paid)}</span> {doneLabel}
            </Key>
            <Key color={FLOW_COLORS.previsto}>
              <span className="text-ash">{brl(totals.open)}</span> {openLabel}
            </Key>
          </span>
          {totals.overdue > 0 ? (
            <span className="mt-2 flex items-center gap-1.5 text-danger">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {brl(totals.overdue)} atrasado
            </span>
          ) : null}
        </>
      }
    />
  );
}

function EmptyList({
  month,
  status,
  q,
  hasFilters,
  qs,
  tipo,
  projeto,
}: {
  month: string | null;
  status?: EntryStatus;
  q?: string;
  hasFilters: boolean;
  qs: (patch: Record<string, string | undefined>) => string;
  tipo?: FinanceKind;
  projeto?: string;
}) {
  const link = "text-light underline decoration-white/20 underline-offset-4 hover:decoration-white/60";
  if (status === "atrasado" && !q) {
    return (
      <EmptyState
        title="Nada atrasado"
        description={month ? `Nenhum lançamento vencido e em aberto em ${monthLong(month)}.` : "Tudo que venceu já foi pago ou recebido."}
      />
    );
  }
  if (q) {
    return (
      <EmptyState
        title={`Nada encontrado para “${q}”`}
        description={
          month ? (
            <>
              A busca olhou só {monthLong(month)}.{" "}
              <Link href={qs({ mes: "todos" })} className={link}>
                Buscar em todos os meses
              </Link>
            </>
          ) : (
            "Tente outra palavra: descrição, projeto, cliente ou freela."
          )
        }
      />
    );
  }
  if (hasFilters) {
    return (
      <EmptyState
        title="Nenhum lançamento com esses filtros"
        description={
          <Link href={qs({ tipo: undefined, status: undefined, projeto: undefined })} className={link}>
            Limpar filtros
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      title={month ? `Nenhum lançamento em ${monthLong(month)}` : "Nenhum lançamento ainda"}
      action={<NewEntryButton defaultKind={tipo} defaultProjectId={projeto && projeto !== "sem" ? projeto : undefined} />}
    />
  );
}
