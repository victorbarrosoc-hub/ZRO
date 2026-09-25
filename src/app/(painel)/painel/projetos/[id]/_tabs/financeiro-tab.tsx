import { EntryStatusBadge, InfoList } from "@/components/painel/bits";
import { StatTile } from "@/components/painel/stat";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { FINANCE_CATEGORIES, FINANCE_KINDS, optionLabel } from "@/lib/domain";
import { brl, dateBR, dateShort, entryStatus, todayISO } from "@/lib/format";
import type { ProjectDetail, ProjectSummary } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { DeleteEntryButton, NewEntryButton, PayEntryButton } from "../_components/finance-dialogs";
import { percent } from "../_components/meter";

const KIND_TITLE: Record<string, string> = { entrada: "Entradas", saida: "Saídas", imposto: "Impostos" };
const COLS = "lg:grid-cols-[minmax(0,1.6fr)_112px_96px_112px_112px_96px_minmax(0,1.1fr)_40px]";

/** Aba "Financeiro": resultado do projeto (contratado, custos por origem, imposto, margem) e os lançamentos. */
export function ProjectFinanceTab({ project, summary }: { project: ProjectDetail; summary: ProjectSummary }) {
  const f = summary.finance;
  const b = f.breakdown;
  const today = todayISO();
  const hasValue = f.contracted > 0;
  const groups = FINANCE_KINDS.map((k) => ({ ...k, entries: project.entries.filter((e) => e.kind === k.key) })).filter((g) => g.entries.length);
  const rate = String(f.taxRate).replace(".", ",");
  const diarias = project.diarias.map((d) => ({ id: d.id, date: d.date, label: `${dateBR(d.date)} · ${d.title}` }));
  const diariaLabel = new Map(project.diarias.map((d) => [d.id, dateShort(d.date)]));
  const newEntry = <NewEntryButton projectId={project.id} diarias={diarias} />;

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Resultado do projeto">
        <StatTile label="Contratado" value={hasValue ? brl(f.contracted) : "—"} sub={`${brl(f.received)} recebido`} />
        <StatTile label="Custos" value={brl(f.costs)} sub={`${brl(f.paidOut)} pago`} />
        <StatTile label={`Imposto (${rate}%)`} value={brl(f.taxEstimated)} sub="estimado" />
        <StatTile
          label="Margem"
          value={hasValue ? brl(f.margin) : "—"}
          sub={hasValue ? percent(f.marginPct) : undefined}
          tone={hasValue && f.margin < 0 ? "danger" : "default"}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Custos" />
          <div className="px-5 pt-2 pb-2 sm:px-6">
            <InfoList
              items={[
                {
                  label: "Equipe",
                  value: (
                    <span className="tabular-nums">
                      {brl(b.crew.total)}
                      {b.crew.open ? <span className="ml-2 text-[12px] text-warn">falta {brl(b.crew.open)}</span> : null}
                    </span>
                  ),
                },
                { label: "Diárias (logística)", value: <span className="tabular-nums">{brl(b.diarias.total)}</span> },
                { label: "Outros custos", value: <span className="tabular-nums">{brl(b.other.total)}</span> },
                { label: `Imposto estimado (${rate}%)`, value: <span className="tabular-nums">{brl(f.taxEstimated)}</span> },
                {
                  label: "Total",
                  value: <span className="font-medium text-white tabular-nums">{brl(f.costs + f.taxEstimated)}</span>,
                },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Caixa do projeto" />
          <div className="px-5 pt-2 pb-2 sm:px-6">
            <InfoList
              items={[
                { label: "Recebido", value: <span className="tabular-nums">{brl(f.received)}</span> },
                { label: "A receber", value: <span className="tabular-nums">{brl(f.receivable)}</span> },
                { label: "Pago", value: <span className="tabular-nums">{brl(f.paidOut)}</span> },
                { label: "A pagar", value: <span className="tabular-nums">{brl(f.payable + f.crewPending)}</span> },
                ...(hasValue && f.notLaunched > 0
                  ? [{ label: "Sem recebimento lançado", value: <span className="text-warn tabular-nums">{brl(f.notLaunched)}</span> }]
                  : []),
              ]}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Lançamentos" action={newEntry} />
        {groups.length ? (
          <div className="mt-4">
            <div className={cn("hidden gap-x-4 px-6 pb-3 text-[12px] text-mute lg:grid", COLS)} aria-hidden>
              <span>Descrição</span>
              <span>Categoria</span>
              <span>Vencimento</span>
              <span className="text-right">Valor</span>
              <span className="text-right">Pago</span>
              <span>Status</span>
              <span />
              <span />
            </div>
            {groups.map((g) => {
              const total = g.entries.reduce((sum, e) => sum + e.amount, 0);
              const title = KIND_TITLE[g.key] ?? g.label;
              return (
                <section key={g.key} aria-label={title}>
                  <h3 className="flex items-baseline gap-3 border-y border-line bg-white/[0.015] px-5 py-2.5 sm:px-6">
                    <span className="label text-mute">{title}</span>
                    <span className="text-[12px] text-ash tabular-nums">{brl(total)}</span>
                  </h3>
                  <ul>
                    {g.entries.map((e) => {
                      const status = entryStatus(e, today);
                      const late = status === "atrasado";
                      const entry = { id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount };
                      const category = optionLabel(FINANCE_CATEGORIES, e.category);
                      return (
                        <li
                          key={e.id}
                          className={cn(
                            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 border-b border-line px-5 py-4 last:border-b-0 sm:px-6 lg:gap-x-4",
                            COLS,
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-[14px] leading-snug text-light">{e.description}</p>
                            <p className="mt-0.5 text-[12px] text-mute">
                              {e.installment ? <span className="font-mono">Parcela {e.installment}</span> : null}
                              {e.eventId && diariaLabel.has(e.eventId) ? (
                                <span>
                                  {e.installment ? " · " : ""}diária {diariaLabel.get(e.eventId)}
                                  <span className="lg:hidden"> · </span>
                                </span>
                              ) : null}
                              <span className="lg:hidden">
                                {e.installment ? " · " : ""}
                                {category} ·{" "}
                                <span className={late ? "text-danger" : undefined}>
                                  {late ? "venceu" : "vence"} {dateBR(e.dueDate)}
                                </span>
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center justify-end lg:order-last">
                            <DeleteEntryButton projectId={project.id} entry={entry} />
                          </div>
                          <span className="hidden text-[13px] text-ash lg:block">{category}</span>
                          <span className={cn("hidden text-[13px] tabular-nums lg:block", late ? "text-danger" : "text-ash")}>{dateBR(e.dueDate)}</span>
                          <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 lg:contents">
                            <span className="text-[15px] font-medium text-white tabular-nums lg:text-right lg:text-[14px] lg:font-normal lg:text-light">
                              {brl(e.amount)}
                            </span>
                            <span className="text-[12px] text-mute tabular-nums lg:text-right lg:text-[14px] lg:text-ash">
                              <span className="lg:hidden">pago </span>
                              {brl(e.paidAmount)}
                            </span>
                            <span>
                              <EntryStatusBadge status={status} />
                            </span>
                            <span className="ml-auto lg:ml-0 lg:text-right">
                              {status !== "pago" ? <PayEntryButton projectId={project.id} entry={entry} /> : null}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhum lançamento neste projeto" action={newEntry} />
        )}
      </Card>
    </div>
  );
}
