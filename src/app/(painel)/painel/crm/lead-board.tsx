"use client";

import Link from "next/link";
import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Ellipsis } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/surface";
import { LEAD_STAGES } from "@/lib/domain";
import { brlCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moveLeadStage } from "./actions";
import { LostReasonModal } from "./crm-dialogs";
import { isOpenStage } from "./crm-options";

/** Dados já prontos para o cartão (calculados no servidor). */
export type BoardLead = {
  id: string;
  title: string;
  contact: string | null;
  stage: string;
  fromSite: boolean;
  projectLabel: string | null;
  budgetLabel: string | null;
  estimatedValue: number | null;
  since: string;
  followUpAt: string | null;
  createdAt: number;
  updatedAt: number;
};

type Move = { id: string; stage: string };

/* Arrastar só com mouse/trackpad: no toque, o menu do cartão faz o mesmo. */
function subscribePointer(cb: () => void) {
  const mq = window.matchMedia("(pointer: fine)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useFinePointer() {
  return useSyncExternalStore(
    subscribePointer,
    () => window.matchMedia("(pointer: fine)").matches,
    () => false,
  );
}

export function LeadBoard({ leads, today }: { leads: BoardLead[]; today: string }) {
  const [items, applyMove] = useOptimistic(leads, (state: BoardLead[], move: Move) =>
    // updatedAt no máximo: nas colunas encerradas o cartão recém-movido vai para o topo.
    state.map((l) => (l.id === move.id ? { ...l, stage: move.stage, updatedAt: Number.MAX_SAFE_INTEGER } : l)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<BoardLead | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lost, setLost] = useState<{ open: boolean; lead: BoardLead | null }>({ open: false, lead: null });
  const canDrag = useFinePointer();
  const anyValue = items.some((l) => l.estimatedValue);

  function move(lead: BoardLead, stage: string) {
    if (lead.stage === stage) return;
    if (stage === "perdido") {
      setLost({ open: true, lead });
      return;
    }
    startTransition(async () => {
      applyMove({ id: lead.id, stage });
      const fd = new FormData();
      fd.set("id", lead.id);
      fd.set("stage", stage);
      const res = await moveLeadStage(null, fd);
      if (res.ok) {
        if (res.message) toast.success(res.message);
      } else toast.error(res.error);
    });
  }

  function dropOn(stage: string) {
    const lead = dragging;
    setDragging(null);
    setOver(null);
    if (lead) move(lead, stage);
  }

  return (
    <>
      <div
        className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:snap-none lg:px-0"
        aria-label="Quadro de leads por etapa"
        role="region"
      >
        <ol className="flex w-max gap-3 lg:grid lg:w-full lg:auto-cols-[minmax(248px,1fr)] lg:grid-flow-col">
          {LEAD_STAGES.map((stage) => {
            const open = isOpenStage(stage.key);
            const column = items
              .filter((l) => l.stage === stage.key)
              .sort((a, b) => {
                if (open) {
                  const due = Number(isDue(b, today)) - Number(isDue(a, today));
                  return due || b.createdAt - a.createdAt;
                }
                return b.updatedAt - a.updatedAt;
              });
            const total = column.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
            const isTarget = over === stage.key && dragging?.stage !== stage.key;
            return (
              <li
                key={stage.key}
                className={cn(
                  "flex w-[min(82vw,320px)] shrink-0 snap-start flex-col rounded-[22px] border border-line bg-white/[0.015] p-2 transition-colors duration-200 lg:w-auto",
                  isTarget && "border-white/30 bg-white/[0.045]",
                )}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== stage.key) setOver(stage.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === stage.key ? null : o));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(stage.key);
                }}
              >
                <div className="px-2.5 pt-2 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-light">
                      <StageDot stage={stage.key} />
                      <span className="truncate">{stage.label}</span>
                    </h2>
                    <span className="relative grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-white/[0.07] px-1.5 text-[11px] text-ash tabular-nums">
                      <span aria-hidden>{column.length}</span>
                      <span className="sr-only">{`${column.length} lead${column.length === 1 ? "" : "s"}`}</span>
                    </span>
                  </div>
                  {anyValue ? (
                    <p className="mt-1 h-4 pl-3.5 text-[12px] leading-4 text-mute">
                      {total ? `${brlCompact(total)} estimado` : ""}
                    </p>
                  ) : null}
                </div>

                <ul className="flex min-h-24 flex-1 flex-col gap-2">
                  {column.map((lead) => (
                    <li key={lead.id}>
                      <LeadCard
                        lead={lead}
                        due={isDue(lead, today)}
                        draggable={canDrag}
                        dragging={dragging?.id === lead.id}
                        onDragStart={() => setDragging(lead)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        onMove={(s) => move(lead, s)}
                      />
                    </li>
                  ))}
                  {!column.length ? (
                    <li
                      className={cn(
                        "grid min-h-24 flex-1 place-items-center rounded-[18px] border border-dashed border-line px-4 text-center text-[13px] text-mute",
                        isTarget && "border-white/30 text-ash",
                      )}
                    >
                      {isTarget ? "Soltar aqui" : "Nenhum lead"}
                    </li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      <LostReasonModal
        open={lost.open}
        onOpenChange={(open) => setLost((s) => ({ ...s, open }))}
        leadId={lost.lead?.id ?? null}
        leadTitle={lost.lead?.title}
      />
    </>
  );
}

function isDue(lead: BoardLead, today: string) {
  return Boolean(lead.followUpAt && lead.followUpAt <= today && isOpenStage(lead.stage));
}

function StageDot({ stage }: { stage: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        stage === "novo" && "bg-white shadow-[0_0_8px_rgb(255_255_255/0.8)]",
        stage === "ganho" && "bg-ok",
        stage === "perdido" && "bg-danger",
        !["novo", "ganho", "perdido"].includes(stage) && "bg-white/40",
      )}
    />
  );
}

function LeadCard({
  lead,
  due,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  lead: BoardLead;
  due: boolean;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stage: string) => void;
}) {
  const detail = [lead.projectLabel, lead.budgetLabel].filter(Boolean).join(" · ");
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-[18px] border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.055),rgb(255_255_255/0.02))] p-4 transition-[border-color,opacity,transform] duration-200 hover:border-white/20",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "scale-[0.98] opacity-40",
        lead.stage === "perdido" && "opacity-70 hover:opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] leading-snug font-medium text-white">
            <Link
              href={`/painel/crm/${lead.id}`}
              draggable={false}
              className="outline-none after:absolute after:inset-0 after:rounded-[18px] focus-visible:after:ring-2 focus-visible:after:ring-white/60"
            >
              {lead.title}
            </Link>
          </h3>
          {lead.contact ? <p className="mt-0.5 truncate text-[13px] text-ash">{lead.contact}</p> : null}
        </div>
        <StageMenu lead={lead} onMove={onMove} />
      </div>

      {detail ? <p className="mt-3 text-[13px] leading-snug text-mute">{detail}</p> : null}

      {lead.fromSite || due ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {due ? (
            <Badge tone="warn" dot>
              Retornar
            </Badge>
          ) : null}
          {lead.fromSite ? <Badge>Site</Badge> : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-[12px]">
        <span className="text-mute">{lead.since}</span>
        {lead.estimatedValue ? <span className="text-light">{brlCompact(lead.estimatedValue)}</span> : null}
      </div>
    </article>
  );
}

function StageMenu({ lead, onMove }: { lead: BoardLead; onMove: (stage: string) => void }) {
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          className="relative z-10 -mt-1.5 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.08] hover:text-light focus-visible:outline-2 focus-visible:outline-white data-[state=open]:bg-white/[0.08] data-[state=open]:text-light"
          aria-label={`Mover ${lead.title} de etapa`}
        >
          <Ellipsis className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Mover para</MenuLabel>
        {LEAD_STAGES.map((s) => {
          const current = s.key === lead.stage;
          return (
            <MenuItem key={s.key} disabled={current} onSelect={() => onMove(s.key)} destructive={s.key === "perdido"}>
              {current ? <Check /> : <ArrowRight />}
              {s.label}
              {current ? <span className="ml-auto text-[12px] text-mute">atual</span> : null}
            </MenuItem>
          );
        })}
        <MenuSeparator />
        <MenuItem asChild>
          <Link href={`/painel/crm/${lead.id}`}>Abrir ficha do lead</Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
