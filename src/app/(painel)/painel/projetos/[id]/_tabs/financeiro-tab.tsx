import { EntryStatusBadge, InfoList } from "@/components/painel/bits";
import { HeroFigure } from "@/components/painel/stat";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { FINANCE_CATEGORIES, FINANCE_KINDS, optionLabel } from "@/lib/domain";
import { brl, dateBR, entryStatus, todayISO } from "@/lib/format";
import type { ProjectDetail, ProjectSummary } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { DeleteEntryButton, NewEntryButton, PayEntryButton } from "../_components/finance-dialogs";
import { percent } from "../_components/meter";

const KIND_TITLE: Record<string, string> = { entrada: "Entradas", saida: "Saídas", imposto: "Impostos" };
const COLS = "lg:grid-cols-[minmax(0,1.6fr)_112px_96px_112px_112px_96px_minmax(0,1.1fr)_40px]";

/** Aba "Financeiro": resultado estimado do projeto e os lançamentos ligados a ele. */
export function ProjectFinanceTab({ project, summary }: { project: ProjectDetail; summary: ProjectSummary }) {
  const f = summary.finance;
  const today = todayISO();
  const hasValue = f.contracted > 0;
  const groups = FINANCE_KINDS.map((k) => ({ ...k, entries: project.entries.filter((e) => e.kind === k.key) })).filter((g) => g.entries.length);
  const rate = String(f.taxRate).replace(".", ",");

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12" aria-label="Resultado do projeto">
        <HeroFigure
          className="md:col-span-2 xl:col-span-4"
          label="Margem estimada"
          value={hasValue ? brl(f.margin) : "—"}
          sub={
            hasValue
              ? `${percent(f.marginPct)} do valor contratado, depois de custos e imposto`
              : "Defina o valor contratado do projeto para calcular"
          }
        />

        <Card className="xl:col-span-4">
          <CardHeader title="Resultado" description="Valor contratado menos custos e imposto estimado." />
          <div className="px-5 pt-2 pb-2 sm:px-6">
            <InfoList
              items={[
                { label: "Valor contratado", value: brl(f.contracted) },
                { label: "Custos", value: <span className="tabular-nums">− {brl(f.costs)}</span> },
                { label: `Imposto estimado (${rate}%)`, value: <span className="tabular-nums">− {brl(f.taxEstimated)}</span> },
                {
                  label: "Margem estimada",
                  value: (
                    <span className={cn("font-medium", hasValue && f.margin < 0 ? "text-danger" : "text-white")}>
                      {hasValue ? `${brl(f.margin)} · ${percent(f.marginPct)}` : "—"}
                    </span>
                  ),
                },
              ]}
            />
          </div>
          <div className="grid gap-1 border-t border-line px-5 py-4 text-[12px] text-mute sm:px-6">
            <p>
              Custos = {brl(f.costsLaunched)} em saídas lançadas
              {f.crewPending ? ` + ${brl(f.crewPending)} da equipe ainda sem pagamento gerado` : ""}.
            </p>
            {f.taxLaunched ? <p>Impostos lançados neste projeto: {brl(f.taxLaunched)} (a estimativa acima não muda).</p> : null}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Caixa do projeto" description="O que já entrou e saiu, e o que falta." />
          <div className="px-5 pt-2 pb-2 sm:px-6">
            <InfoList
              items={[
                { label: "Recebido", value: brl(f.received) },
                { label: "A receber", value: brl(f.receivable) },
                { label: "Pago", value: brl(f.paidOut) },
                { label: "A pagar", value: brl(f.payable) },
              ]}
            />
          </div>
          {hasValue && f.notLaunched > 0 ? (
            <p className="border-t border-line px-5 py-4 text-[12px] text-warn sm:px-6">
              {brl(f.notLaunched)} do valor contratado ainda sem entrada lançada.
            </p>
          ) : null}
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Lançamentos"
          description="Tudo que entra e sai por este projeto. Aparece também no Financeiro."
          action={<NewEntryButton projectId={project.id} />}
        />
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
          <EmptyState
            title="Nenhum lançamento neste projeto"
            description="Lance a entrada e o saldo do cliente e os custos do projeto. Os pagamentos da equipe são gerados na aba Equipe."
            action={<NewEntryButton projectId={project.id} />}
          />
        )}
      </Card>
    </div>
  );
}
