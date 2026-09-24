import Link from "next/link";
import { EntryStatusBadge } from "@/components/painel/bits";
import { StatTile } from "@/components/painel/stat";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { FUNCTIONS, optionLabel } from "@/lib/domain";
import { brl, dateShort, entryStatus, initials, todayISO } from "@/lib/format";
import { crewPayment, listCrewOptions, type ProjectDetail, type ProjectSummary } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { AddCrewButton, DeleteCrewButton, EditCrewButton, GeneratePaymentButton } from "../_components/crew-dialogs";
import { PayEntryButton } from "../_components/finance-dialogs";

const COLS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_112px_minmax(0,1.45fr)_80px]";

function period(start: string | null, due: string | null) {
  if (start && due) return start === due ? dateShort(start) : `${dateShort(start)} → ${dateShort(due)}`;
  if (due) return `até ${dateShort(due)}`;
  if (start) return `desde ${dateShort(start)}`;
  return null;
}

/** Aba "Equipe": quem trabalha, em qual função, por quanto, e como está o pagamento de cada um. */
export async function ProjectCrewTab({ project, summary }: { project: ProjectDetail; summary: ProjectSummary }) {
  const options = await listCrewOptions(project.crew.map((c) => c.freelancerId));
  const today = todayISO();
  const rows = project.crew.map((c) => ({ c, pay: crewPayment(c, project.entries) }));
  const paid = rows.reduce((s, r) => s + (r.pay?.paid ?? 0), 0);
  const launchedOpen = rows.reduce((s, r) => s + (r.pay ? Math.max(0, r.pay.amount - r.pay.paid) : 0), 0);
  const { total, people, pending, pendingCount } = summary.crew;

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Custos da equipe">
        <StatTile label="Custo da equipe" value={brl(total)} sub={people ? `${people} pessoa${people > 1 ? "s" : ""}` : "Equipe ainda vazia"} />
        <StatTile label="Já pago" value={brl(paid)} sub={paid ? "Baixas registradas no financeiro" : "Nenhum pagamento feito ainda"} />
        <StatTile
          label="A pagar"
          value={brl(launchedOpen + pending)}
          sub={
            pendingCount
              ? `${brl(pending)} de ${pendingCount} pessoa${pendingCount > 1 ? "s" : ""} sem pagamento gerado`
              : "Tudo lançado no financeiro"
          }
        />
      </section>

      <Card>
        <CardHeader
          title="Equipe"
          description="Escolha no banco de freelas: o valor padrão entra preenchido e o custo soma na hora."
          action={<AddCrewButton projectId={project.id} options={options} category={project.category} />}
        />
        {rows.length ? (
          <div className="mt-4">
            <div className={cn("hidden gap-x-4 border-b border-line px-6 pb-3 text-[12px] text-mute lg:grid", COLS)} aria-hidden>
              <span>Pessoa</span>
              <span>Trabalho</span>
              <span>Período</span>
              <span className="text-right">Valor</span>
              <span>Pagamento</span>
              <span />
            </div>
            <ul>
              {rows.map(({ c, pay }) => {
                const when = period(c.startDate, c.dueDate);
                const status = pay ? entryStatus({ amount: pay.amount, paidAmount: pay.paid, dueDate: pay.dueDate }, today) : null;
                const mismatch = pay && pay.amount !== c.amount;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 sm:px-6 lg:gap-x-4",
                      COLS,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-[12px] font-medium text-light">
                        {initials(c.displayName)}
                      </span>
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
                        defaults={{
                          id: c.id,
                          freelancerId: c.freelancerId,
                          name: c.name,
                          function: c.function,
                          work: c.work,
                          startDate: c.startDate,
                          dueDate: c.dueDate,
                          amount: c.amount,
                        }}
                      />
                      <DeleteCrewButton id={c.id} label={c.displayName} />
                    </div>
                    {c.work || when ? (
                      <p className="col-span-2 -mt-1 text-[12px] text-mute lg:hidden">{[c.work, when].filter(Boolean).join(" · ")}</p>
                    ) : null}
                    <span className="hidden text-[13px] text-ash lg:block">{c.work ?? "—"}</span>
                    <span className="hidden text-[13px] text-ash lg:block">{when ?? "—"}</span>
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
                            {mismatch ? (
                              <span className="text-[12px] text-warn tabular-nums">Lançado: {brl(pay.amount)}</span>
                            ) : null}
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
                          <>
                            <span className="text-[12px] text-mute">Sem lançamento</span>
                            <GeneratePaymentButton id={c.id} label={c.displayName} amount={c.amount} dueDate={c.dueDate ?? today} />
                          </>
                        ) : (
                          <span className="text-[12px] text-mute">Sem valor definido</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EmptyState
            title="Ninguém na equipe ainda"
            description="Monte a equipe a partir do banco de freelas. O valor padrão de cada um entra preenchido."
            action={<AddCrewButton projectId={project.id} options={options} category={project.category} />}
          />
        )}
      </Card>
    </div>
  );
}
