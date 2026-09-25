import { ArrowUpRight } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { dateBR, dateShort, todayISO } from "@/lib/format";
import type { ProjectDetail } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import {
  DeleteDeliverableButton,
  DeliverableStatusSelect,
  EditDeliverableButton,
  NewDeliverableButton,
  RevisionControl,
} from "../_components/deliverable-dialogs";

const COLS = "lg:grid-cols-[minmax(0,1fr)_72px_80px_44px_92px_172px_136px_80px]";

/** Aba "Entregas": vídeos, formatos, prazos, status e rodadas de revisão do cliente. */
export function ProjectDeliverablesTab({ project }: { project: ProjectDetail }) {
  const today = todayISO();
  const items = project.deliverables;
  const delivered = items.filter((d) => d.status === "entregue").length;
  const withClient = items.filter((d) => d.status === "revisao").length;
  const rounds = items.reduce((s, d) => s + d.revision, 0);

  return (
    <Card>
      <CardHeader
        title="Entregas"
        description={
          items.length
            ? [
                `${delivered} de ${items.length} entregue${items.length === 1 ? "" : "s"}`,
                withClient ? `${withClient} com o cliente` : null,
                rounds ? `${rounds} rodada${rounds === 1 ? "" : "s"} de revisão no total` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "O que o cliente recebe no fim: vídeos, cortes, fotos."
        }
        action={<NewDeliverableButton projectId={project.id} />}
      />
      {items.length ? (
        <div className="mt-4">
          <div className={cn("hidden gap-x-4 border-b border-line px-6 pb-3 text-[12px] text-mute lg:grid", COLS)} aria-hidden>
            <span>Entrega</span>
            <span>Formato</span>
            <span>Duração</span>
            <span>Qtd.</span>
            <span>Prazo</span>
            <span>Status</span>
            <span>Revisões</span>
            <span />
          </div>
          <ul>
            {items.map((d) => {
              const late = Boolean(d.dueDate && d.dueDate < today && d.status !== "entregue" && d.status !== "aprovado");
              const meta = [
                d.format,
                d.duration,
                d.quantity > 1 ? `${d.quantity} unidades` : null,
                d.dueDate ? `prazo ${dateShort(d.dueDate)}${late ? " (atrasado)" : ""}` : null,
              ].filter(Boolean);
              return (
                <li
                  key={d.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 sm:px-6 lg:gap-x-4",
                    COLS,
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[14px] font-medium text-light">
                      <span className="truncate">{d.title}</span>
                      {d.link ? (
                        <a
                          href={d.link}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-6 shrink-0 place-items-center rounded-full text-mute hover:bg-white/[0.06] hover:text-white"
                          aria-label={`Abrir o arquivo de ${d.title}`}
                        >
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      ) : null}
                    </p>
                    {meta.length ? <p className={cn("mt-0.5 text-[12px] lg:hidden", late ? "text-warn" : "text-mute")}>{meta.join(" · ")}</p> : null}
                  </div>
                  <div className="flex items-center justify-end gap-0.5 lg:order-last">
                    <EditDeliverableButton
                      defaults={{
                        id: d.id,
                        title: d.title,
                        format: d.format,
                        duration: d.duration,
                        quantity: d.quantity,
                        dueDate: d.dueDate,
                        status: d.status,
                        revision: d.revision,
                        link: d.link,
                      }}
                    />
                    <DeleteDeliverableButton id={d.id} title={d.title} />
                  </div>
                  <span className="hidden text-[13px] text-ash lg:block">{d.format ?? "—"}</span>
                  <span className="hidden text-[13px] text-ash lg:block">{d.duration ?? "—"}</span>
                  <span className="hidden text-[13px] text-ash tabular-nums lg:block">{d.quantity}</span>
                  <span className={cn("hidden text-[13px] tabular-nums lg:block", late ? "text-warn" : "text-ash")}>
                    {dateBR(d.dueDate)}
                    {late ? <span className="sr-only"> (atrasado)</span> : null}
                  </span>
                  <div className="col-span-2 flex items-center gap-3 lg:contents">
                    <DeliverableStatusSelect id={d.id} status={d.status} title={d.title} className="min-w-0 flex-1 lg:flex-none" />
                    <RevisionControl id={d.id} revision={d.revision} title={d.title} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState
          title="Nenhuma entrega ainda"
          action={<NewDeliverableButton projectId={project.id} variant="primary" />}
        />
      )}
    </Card>
  );
}
