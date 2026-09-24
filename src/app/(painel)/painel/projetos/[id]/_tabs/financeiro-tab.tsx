import { EntryStatusBadge, InfoList, Table, Td, Th } from "@/components/painel/bits";
import { HeroFigure } from "@/components/painel/stat";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { FINANCE_CATEGORIES, FINANCE_KINDS, optionLabel } from "@/lib/domain";
import { brl, dateBR, entryStatus, todayISO } from "@/lib/format";
import type { ProjectDetail, ProjectSummary } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { DeleteEntryButton, NewEntryButton, PayEntryButton } from "../_components/finance-dialogs";
import { percent } from "../_components/meter";

const KIND_TITLE: Record<string, string> = { entrada: "Entradas", saida: "Saídas", imposto: "Impostos" };

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
          description="Entradas, saídas e impostos ligados a este projeto. Tudo aparece também no Financeiro."
          action={<NewEntryButton projectId={project.id} />}
        />
        {groups.length ? (
          <Table className="mt-4" minWidth={860}>
            <thead>
              <tr>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Vencimento</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Pago</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            {groups.map((g) => {
              const total = g.entries.reduce((s, e) => s + e.amount, 0);
              return (
                <tbody key={g.key}>
                  <tr>
                    <td colSpan={7} className="border-b border-line bg-white/[0.015] px-5 py-2.5 sm:px-6">
                      <span className="label text-mute">{KIND_TITLE[g.key] ?? g.label}</span>
                      <span className="ml-3 text-[12px] text-ash tabular-nums">{brl(total)}</span>
                    </td>
                  </tr>
                  {g.entries.map((e) => {
                    const status = entryStatus(e, today);
                    return (
                      <tr key={e.id}>
                        <Td>
                          <span className="block">{e.description}</span>
                          {e.installment ? <span className="font-mono text-[11px] text-mute">Parcela {e.installment}</span> : null}
                        </Td>
                        <Td className="text-ash">{optionLabel(FINANCE_CATEGORIES, e.category)}</Td>
                        <Td className={cn("whitespace-nowrap", status === "atrasado" ? "text-danger" : "text-ash")}>{dateBR(e.dueDate)}</Td>
                        <Td align="right">{brl(e.amount)}</Td>
                        <Td align="right" className="text-ash">
                          {brl(e.paidAmount)}
                        </Td>
                        <Td>
                          <EntryStatusBadge status={status} />
                        </Td>
                        <Td align="right">
                          <span className="flex items-center justify-end gap-1">
                            {status !== "pago" ? (
                              <PayEntryButton
                                projectId={project.id}
                                entry={{ id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount }}
                              />
                            ) : null}
                            <DeleteEntryButton
                              projectId={project.id}
                              entry={{ id: e.id, kind: e.kind, description: e.description, amount: e.amount, paidAmount: e.paidAmount }}
                            />
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </Table>
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
