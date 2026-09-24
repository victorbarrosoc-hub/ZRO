"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { ActionForm, ConfirmAction, FormModal, SubmitButton, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { LEAD_STAGES } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  addActivity,
  convertLeadToClient,
  createClient,
  createLead,
  deleteActivity,
  deleteClient,
  deleteLead,
  moveLeadStage,
  updateClient,
  updateLead,
  updateLeadControl,
} from "./actions";
import {
  ChoiceChips,
  ClientFields,
  LeadControlFields,
  LeadFields,
  LostReasonField,
  type ClientDefaults,
  type LeadDefaults,
} from "./crm-fields";
import { ACTIVITY_TYPES } from "./crm-options";

/* ---------------- Leads ---------------- */

export function NewLeadButton() {
  return (
    <FormModal
      title="Novo lead"
      description="Para pedidos que chegaram por WhatsApp, Instagram ou indicação. Os do site entram sozinhos."
      action={createLead}
      submitLabel="Cadastrar"
      size="lg"
      trigger={
        <Button variant="primary">
          <Plus /> Novo lead
        </Button>
      }
    >
      {(state) => <LeadFields state={state} mode="create" />}
    </FormModal>
  );
}

export function EditLeadButton({ defaults }: { defaults: LeadDefaults }) {
  return (
    <FormModal
      title="Editar lead"
      action={updateLead}
      size="lg"
      trigger={
        <Button variant="secondary" size="sm" className="h-10 sm:h-8">
          <Pencil /> Editar
        </Button>
      }
    >
      {(state) => <LeadFields state={state} defaults={defaults} mode="edit" />}
    </FormModal>
  );
}

export function EditLeadControlButton({ defaults }: { defaults: LeadDefaults }) {
  return (
    <FormModal
      title="Controle do lead"
      description="Valor estimado, data para retornar e observações internas."
      action={updateLeadControl}
      trigger={
        <Button variant="ghost" size="sm" className="h-10 sm:h-8">
          <Pencil /> Editar
        </Button>
      }
    >
      {(state) => <LeadControlFields state={state} defaults={defaults} />}
    </FormModal>
  );
}

export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      title={`Excluir ${name}?`}
      description="O lead e o histórico de conversas são apagados de vez. Orçamentos e projetos continuam, sem o vínculo."
      confirmLabel="Excluir"
      action={deleteLead}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="sm" className="h-10 text-danger hover:bg-danger/10 hover:text-danger sm:h-8">
          <Trash2 /> Excluir
        </Button>
      }
    />
  );
}

/** Cadastra o lead como cliente novo ou liga a um cliente que já existe. */
export function ConvertLeadButton({
  id,
  clients,
  suggestedClientId,
  prominent,
}: {
  id: string;
  clients: { id: string; name: string }[];
  suggestedClientId?: string | null;
  prominent?: boolean;
}) {
  return (
    <FormModal
      title="Converter em cliente"
      description="O cliente novo leva nome, contato, segmento e cidade deste lead."
      action={convertLeadToClient}
      submitLabel="Confirmar"
      trigger={
        <Button variant={prominent ? "primary" : "secondary"} size="sm" className="h-10 sm:h-8">
          <UserPlus /> Converter em cliente
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field
            label="Cliente"
            htmlFor="cv-client"
            hint={
              suggestedClientId
                ? "Já existe um cliente com esse nome. Ligue a ele para não duplicar."
                : "Ou escolha um cliente que já está cadastrado."
            }
            error={fieldError(state, "clientId")}
          >
            <Select id="cv-client" name="clientId" defaultValue={suggestedClientId ?? ""}>
              <option value="">Cadastrar um cliente novo</option>
              {clients.length ? (
                <optgroup label="Ligar a um cliente existente">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>
        </>
      )}
    </FormModal>
  );
}

/** Janela do motivo de perda (controlada: abre pelo quadro, pelo menu ou pela ficha). */
export function LostReasonModal({
  open,
  onOpenChange,
  leadId,
  leadTitle,
  defaultReason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  leadTitle?: string;
  defaultReason?: string | null;
}) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar como perdido"
      description={leadTitle ? `${leadTitle} · o motivo fica no histórico do lead.` : "O motivo fica no histórico do lead."}
      action={moveLeadStage}
      submitLabel="Marcar como perdido"
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={leadId ?? ""} />
          <input type="hidden" name="stage" value="perdido" />
          <LostReasonField state={state} defaultValue={defaultReason} />
        </>
      )}
    </FormModal>
  );
}

/** Etapa do funil na ficha do lead: cápsulas com a etapa atual acesa. */
export function LeadStageControl({
  id,
  stage,
  title,
  lostReason,
}: {
  id: string;
  stage: string;
  title: string;
  lostReason: string | null;
}) {
  const [current, setCurrent] = useOptimistic(stage);
  const [pending, startTransition] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const labelId = useId();

  function choose(next: string) {
    if (next === "perdido") {
      setLostOpen(true);
      return;
    }
    if (next === current) return;
    startTransition(async () => {
      setCurrent(next);
      const fd = new FormData();
      fd.set("id", id);
      fd.set("stage", next);
      const res = await moveLeadStage(null, fd);
      if (res.ok) {
        if (res.message) toast.success(res.message);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-3">
      <p id={labelId} className="label text-mute">
        Etapa do funil
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={cn(
          "grid grid-cols-2 gap-1 rounded-[20px] border border-line bg-white/[0.02] p-1 sm:flex sm:w-max sm:max-w-full sm:flex-wrap sm:rounded-full",
          pending && "opacity-80",
        )}
      >
        {LEAD_STAGES.map((s) => {
          const on = s.key === current;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(s.key)}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] whitespace-nowrap transition-colors sm:h-9",
                on
                  ? s.key === "ganho"
                    ? "bg-ok text-void"
                    : s.key === "perdido"
                      ? "bg-danger text-white"
                      : "bg-white text-void"
                  : "text-ash hover:bg-white/[0.06] hover:text-light",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {current === "perdido" && lostReason ? (
        <p className="text-[14px] text-ash">
          <span className="text-mute">Motivo:</span> {lostReason}{" "}
          <button
            type="button"
            onClick={() => setLostOpen(true)}
            className="ml-1 text-[13px] text-mute underline decoration-white/20 underline-offset-4 hover:text-light"
          >
            alterar
          </button>
        </p>
      ) : null}
      <LostReasonModal
        open={lostOpen}
        onOpenChange={setLostOpen}
        leadId={id}
        leadTitle={title}
        defaultReason={stage === "perdido" ? lostReason : null}
      />
    </div>
  );
}

/* ---------------- Histórico ---------------- */

export function ActivityForm({ leadId, clientId }: { leadId?: string; clientId?: string }) {
  return (
    <ActionForm action={addActivity} resetOnSuccess className="grid gap-3">
      {(state) => (
        <>
          {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
          {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
          <ChoiceChips name="type" options={ACTIVITY_TYPES} defaultValue="nota" error={fieldError(state, "type")} />
          <Field htmlFor={`act-${leadId ?? clientId}`} error={fieldError(state, "content")}>
            <Textarea
              id={`act-${leadId ?? clientId}`}
              name="content"
              rows={3}
              aria-label="O que aconteceu"
              placeholder="O que foi conversado e qual é o próximo passo?"
            />
          </Field>
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Registrando…" className="h-10 sm:h-8">
              Registrar
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function DeleteActivityButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      title="Apagar esta atividade?"
      description="Ela sai do histórico de vez."
      confirmLabel="Apagar"
      action={deleteActivity}
      fields={{ id }}
      trigger={
        <button
          type="button"
          className="-m-2 grid size-10 shrink-0 place-items-center rounded-full text-mute opacity-70 transition hover:bg-white/[0.06] hover:text-light hover:opacity-100 focus-visible:opacity-100"
          aria-label="Apagar atividade"
        >
          <X className="size-4" />
        </button>
      }
    />
  );
}

/* ---------------- Clientes ---------------- */

export function NewClientButton() {
  return (
    <FormModal
      title="Novo cliente"
      description="Empresa ou pessoa que contrata a ZRO."
      action={createClient}
      submitLabel="Cadastrar"
      size="lg"
      trigger={
        <Button variant="primary">
          <Plus /> Novo cliente
        </Button>
      }
    >
      {(state) => <ClientFields state={state} />}
    </FormModal>
  );
}

export function EditClientButton({ defaults }: { defaults: ClientDefaults }) {
  return (
    <FormModal
      title="Editar cliente"
      action={updateClient}
      size="lg"
      trigger={
        <Button variant="secondary" size="sm" className="h-10 sm:h-8">
          <Pencil /> Editar
        </Button>
      }
    >
      {(state) => <ClientFields state={state} defaults={defaults} />}
    </FormModal>
  );
}

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      title={`Excluir ${name}?`}
      description="O cadastro e o histórico de atividades do cliente são apagados. Leads, projetos, orçamentos e lançamentos continuam, sem o vínculo."
      confirmLabel="Excluir"
      action={deleteClient}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="sm" className="h-10 text-danger hover:bg-danger/10 hover:text-danger sm:h-8">
          <Trash2 /> Excluir
        </Button>
      }
    />
  );
}
