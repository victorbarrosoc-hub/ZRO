import Link from "next/link";
import { Avatar } from "@/components/painel/avatar";
import { EntryStatusBadge } from "@/components/painel/bits";
import { StatTile } from "@/components/painel/stat";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { FUNCTIONS, optionLabel } from "@/lib/domain";
import { brl, dateShort, entryStatus, todayISO } from "@/lib/format";
import { crewPayment, listCrewOptions, type ProjectDetail, type ProjectSummary } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { AddCrewButton, DeleteCrewButton, EditCrewButton, GeneratePaymentButton, type CrewDiaria } from "../_components/crew-dialogs";
import { PayEntryButton } from "../_components/finance-dialogs";

const COLS = "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_minmax(0,1.45fr)_80px]";

function period(start: string | null, due: string | null) {
  if (start && due) return start === due ? dateShort(start) : `${dateShort(start)} → ${dateShort(due)}`;
  if (due) return `até ${dateShort(due)}`;
  if (start) return `desde ${dateShort(start)}`;
  return null;
}

/** Aba "Equipe": quem trabalha, quanto custa (por diária, pela agenda, ou valor fechado) e o pagamento de cada um. */
export async function ProjectCrewTab({ project, summary }: { project: ProjectDetail; summary: ProjectSummary }) {
  const options = await listCrewOptions(project.crew.map((c) => c.freelancerId));
  const today = todayISO();
  const rows = project.crew.map((c) => ({ c, pay: crewPayment(c, project.entries) }));
  const { crew } = summary.finance.breakdown;
  const late = rows.reduce(
    (s, r) => s + (r.pay ? r.pay.open.filter((e) => e.dueDate < today).reduce((x, e) => x + e.amount - e.paidAmount, 0) : 0),
    0,
  );
  const diarias: CrewDiaria[] = project.diarias.map((d) => ({ id: d.id, date: d.date, endDate: d.endDate, title: d.title, days: d.days }));
  const add = <AddCrewButton projectId={project.id} options={options} category={project.category} diarias={diarias} />;

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Custos da equipe">
        <StatTile
          label="Equipe"
          value={brl(crew.total)}
          sub={summary.crew.people ? `${summary.crew.people} pessoa${summary.crew.people > 1 ? "s" : ""}` : "Ninguém ainda"}
        />
        <StatTile label="Pago" value={brl(crew.paid)} />
        <StatTile
          label="Falta pagar"
          value={brl(crew.open)}
          sub={late ? `${brl(late)} vencido` : undefined}
          tone={late ? "danger" : "default"}
        />
      </section>

      <Card>
        <CardHeader title="Equipe" action={add} />
        {rows.length ? (
          <div className="mt-4">
            <div className={cn("hidden gap-x-4 border-b border-line px-6 pb-3 text-[12px] text-mute lg:grid", COLS)} aria-hidden>
              <span>Pessoa</span>
              <span>Cobrança</span>
              <span className="text-right">Valor</span>
              <span>Pagamento</span>
              <span />
            </div>
            <ul>
              {rows.map(({ c, pay }) => {
                const status = pay ? entryStatus({ amount: pay.amount, paidAmount: pay.paid, dueDate: pay.dueDate }, today) : null;
                const mismatch = pay && pay.amount !== c.amount;
                const charge =
                  c.dailyRate != null
                    ? `${brl(c.dailyRate)} × ${c.days} ${c.days === 1 ? "diária" : "diárias"}`
                    : [c.work, period(c.startDate, c.dueDate)].filter(Boolean).join(" · ") || "Valor fechado";
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 sm:px-6 lg:gap-x-4",
                      COLS,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.displayName} imageId={c.photoId} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-light">
                          {c.freelancerId ? (
                            <Link href={`/painel/freelas/${c.freelancerId}`} className="hover:underline">
                              {c.displayName}
                            </Link>
                          ) : (
                            c.displayName
                          )}
                        </p>
                        <p className="truncate text-[12px] text-mute">{optionLabel(FUNCTIONS, c.function)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-0.5 lg:order-last">
                      <EditCrewButton
                        label={c.displayName}
                        options={options}
                        category={project.category}
                        diarias={diarias}
                        defaults={{
                          id: c.id,
                          freelancerId: c.freelancerId,
                          name: c.name,
                          function: c.function,
                          work: c.work,
                          startDate: c.startDate,
                          dueDate: c.dueDate,
                          amount: c.amount,
                          dailyRate: c.dailyRate,
                          escalated: c.diariaIds,
                        }}
                      />
                      <DeleteCrewButton id={c.id} label={c.displayName} />
                    </div>
                    <p className="col-span-2 -mt-1 text-[12px] text-mute lg:col-span-1 lg:mt-0 lg:text-[13px] lg:text-ash">{charge}</p>
                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:contents">
                      <span className="text-[15px] font-medium text-white tabular-nums lg:text-right lg:text-[14px]">{brl(c.amount)}</span>
                      <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-start">
                        {pay && status ? (
                          <>
                            <EntryStatusBadge status={status} />
                            <span className="text-[12px] text-mute tabular-nums">
                              {status === "pago"
                                ? `${brl(pay.paid)} pago`
                                : pay.paid > 0
                                  ? `${brl(pay.paid)} de ${brl(pay.amount)}`
                                  : `${status === "atrasado" ? "venceu" : "vence"} ${dateShort(pay.dueDate)}`}
                            </span>
                            {mismatch ? <span className="text-[12px] text-warn tabular-nums">Lançado: {brl(pay.amount)}</span> : null}
                            {pay.open[0] ? (
                              <PayEntryButton
                                projectId={project.id}
                                entry={{
                                  id: pay.open[0].id,
                                  kind: pay.open[0].kind,
                                  description: pay.open[0].description,
                                  amount: pay.open[0].amount,
                                  paidAmount: pay.open[0].paidAmount,
                                }}
                              />
                            ) : null}
                          </>
                        ) : c.amount > 0 ? (
                          <GeneratePaymentButton id={c.id} label={c.displayName} amount={c.amount} dueDate={c.dueDate ?? today} />
                        ) : (
                          <span className="text-[12px] text-mute">{c.dailyRate != null ? "Sem diária escalada" : "Sem valor"}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EmptyState title="Ninguém na equipe ainda" action={add} />
        )}
      </Card>
    </div>
  );
}
