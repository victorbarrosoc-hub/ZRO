"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Tip } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { DELIVERABLE_STATUS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { addDeliverableRevision, createDeliverable, deleteDeliverable, setDeliverableStatus, updateDeliverable } from "../../actions";
import { toastFirst } from "./toast-first";

// A lista vazia troca de lugar com a primeira entrega, e excluir tira a linha: o aviso vem antes.
const createDeliverableT = toastFirst(createDeliverable);
const deleteDeliverableT = toastFirst(deleteDeliverable);

export type DeliverableDefaults = {
  id?: string;
  title?: string;
  format?: string | null;
  duration?: string | null;
  quantity?: number;
  dueDate?: string | null;
  status?: string;
  revision?: number;
  link?: string | null;
};

const FORMAT_SUGGESTIONS = ["16:9", "9:16", "1:1", "4:5", "foto"];

function asForm(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function DeliverableFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: DeliverableDefaults }) {
  const p = defaults.id ? "ed" : "nd";
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entrega" htmlFor={`${p}-title`} error={fieldError(state, "title")} className="sm:col-span-2">
          <Input id={`${p}-title`} name="title" defaultValue={defaults.title} placeholder="Ex.: Filme principal" autoFocus={!defaults.id} />
        </Field>
        <Field label="Formato" htmlFor={`${p}-format`} error={fieldError(state, "format")}>
          <Input id={`${p}-format`} name="format" list={`${p}-formats`} defaultValue={defaults.format ?? ""} placeholder="16:9" />
          <datalist id={`${p}-formats`}>
            {FORMAT_SUGGESTIONS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="Duração" htmlFor={`${p}-duration`} error={fieldError(state, "duration")}>
          <Input id={`${p}-duration`} name="duration" defaultValue={defaults.duration ?? ""} placeholder={`60"`} />
        </Field>
        <Field label="Quantidade" htmlFor={`${p}-qty`} error={fieldError(state, "quantity")}>
          <Input id={`${p}-qty`} name="quantity" type="number" inputMode="numeric" min={1} step={1} defaultValue={defaults.quantity ?? 1} />
        </Field>
        <Field label="Prazo" htmlFor={`${p}-due`} error={fieldError(state, "dueDate")}>
          <Input id={`${p}-due`} name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
        </Field>
        <Field label="Status" htmlFor={`${p}-status`} error={fieldError(state, "status")}>
          <Select id={`${p}-status`} name="status" defaultValue={defaults.status ?? "pendente"}>
            {DELIVERABLE_STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        {defaults.id ? (
          <Field label="Rodadas de revisão" htmlFor={`${p}-rev`} error={fieldError(state, "revision")}>
            <Input id={`${p}-rev`} name="revision" type="number" inputMode="numeric" min={0} step={1} defaultValue={defaults.revision ?? 0} />
          </Field>
        ) : null}
        <Field
          label="Link"
          htmlFor={`${p}-link`}
          error={fieldError(state, "link")}
          hint="Onde o arquivo está: Drive, Frame.io, Vimeo."
          className="sm:col-span-2"
        >
          <Input id={`${p}-link`} name="link" type="url" inputMode="url" defaultValue={defaults.link ?? ""} placeholder="https://" />
        </Field>
      </div>
    </>
  );
}

export function NewDeliverableButton({ projectId, variant = "secondary" }: { projectId: string; variant?: "primary" | "secondary" }) {
  return (
    <FormModal
      title="Nova entrega"
      description="Um vídeo, um lote de cortes, um pacote de fotos."
      action={createDeliverableT}
      submitLabel="Adicionar"
      trigger={
        <Button variant={variant} size="sm">
          <Plus /> Nova entrega
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <DeliverableFields state={state} />
        </>
      )}
    </FormModal>
  );
}

export function EditDeliverableButton({ defaults }: { defaults: DeliverableDefaults }) {
  return (
    <FormModal
      title="Editar entrega"
      action={updateDeliverable}
      trigger={
        <Button variant="ghost" size="icon" className="lg:size-8" aria-label={`Editar ${defaults.title}`}>
          <Pencil />
        </Button>
      }
    >
      {(state) => <DeliverableFields state={state} defaults={defaults} />}
    </FormModal>
  );
}

export function DeleteDeliverableButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmAction
      title={`Excluir ${title}?`}
      description="A entrega sai da lista do projeto."
      confirmLabel="Excluir"
      action={deleteDeliverableT}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="icon" className="text-mute hover:text-danger lg:size-8" aria-label={`Excluir ${title}`}>
          <Trash2 />
        </Button>
      }
    />
  );
}

const STATUS_TONE: Record<string, string> = {
  entregue: "border-ok/35 text-ok",
  aprovado: "border-white/40 text-white",
  revisao: "border-warn/35 text-warn",
};
const DOT_TONE: Record<string, string> = {
  entregue: "bg-ok",
  aprovado: "bg-white",
  revisao: "bg-warn",
  edicao: "bg-ash",
  pendente: "bg-mute",
};

/** Status da entrega trocado direto na lista. */
export function DeliverableStatusSelect({ id, status, title, className }: { id: string; status: string; title: string; className?: string }) {
  const [value, setValue] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      setValue(next);
      const result = await setDeliverableStatus(null, asForm({ id, status: next }));
      if (!result.ok) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">Status de {title}</span>
      <span className={cn("pointer-events-none absolute top-1/2 left-3.5 size-1.5 -translate-y-1/2 rounded-full", DOT_TONE[value] ?? "bg-mute")} aria-hidden />
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className={cn(
          "h-10 w-full cursor-pointer appearance-none rounded-full border border-line-strong bg-white/[0.03] pr-9 pl-8 text-[13px] text-light transition-[border-color,opacity] hover:border-white/30 focus:border-white/50 focus:outline-none lg:h-9",
          STATUS_TONE[value],
          pending && "opacity-70",
        )}
      >
        {DELIVERABLE_STATUS.map((s) => (
          <option key={s.key} value={s.key} className="bg-graphite text-light">
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-mute" aria-hidden />
    </label>
  );
}

/** Contador de rodadas de revisão com o botão de "+1 rodada". */
export function RevisionControl({ id, revision, title }: { id: string; revision: number; title: string }) {
  const [value, setValue] = useOptimistic(revision);
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      setValue(value + 1);
      const result = await addDeliverableRevision(null, asForm({ id }));
      if (!result.ok) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[13px] whitespace-nowrap text-ash">
        <span className="text-light tabular-nums">{value}</span> {value === 1 ? "rodada" : "rodadas"}
      </span>
      <Tip content="Nova rodada de revisão">
        <button
          type="button"
          onClick={add}
          disabled={pending}
          aria-label={`Nova rodada de revisão em ${title}`}
          className="grid h-10 min-w-10 place-items-center rounded-full border border-line-strong px-2.5 text-[12px] font-medium text-light transition-colors hover:border-white/30 hover:bg-white/[0.06] disabled:opacity-50 lg:h-8 lg:min-w-8"
        >
          +1
        </button>
      </Tip>
    </div>
  );
}
