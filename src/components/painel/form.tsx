"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";

type ServerAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  className,
  size = "md",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "subtle";
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Mensagem de erro de um campo vinda do ActionResult. */
export function fieldError(state: ActionResult | null, name: string) {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[name]?.[0];
}

/**
 * Formulário ligado a uma Server Action com toast de sucesso/erro.
 * `children` pode ser uma função que recebe o estado (para mostrar erros por campo).
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  successMessage,
  resetOnSuccess,
}: {
  action: ServerAction;
  children: React.ReactNode | ((state: ActionResult | null) => React.ReactNode);
  className?: string;
  onSuccess?: (state: Extract<ActionResult, { ok: true }>) => void;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      const msg = state.message ?? successMessage;
      if (msg) toast.success(msg);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    } else {
      toast.error(state.error);
    }
  }, [state, onSuccess, successMessage, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className} noValidate>
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}

/**
 * Janela com formulário (criar/editar). Fecha sozinha quando a action dá certo.
 */
export function FormModal({
  trigger,
  title,
  description,
  action,
  submitLabel = "Salvar",
  size = "md",
  children,
  successMessage,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  action: ServerAction;
  submitLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode | ((state: ActionResult | null) => React.ReactNode);
  successMessage?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [formKey, setFormKey] = useState(0);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setFormKey((k) => k + 1);
      }}
    >
      {trigger ? <ModalTrigger asChild>{trigger}</ModalTrigger> : null}
      <ModalContent title={title} description={description} size={size}>
        <ActionForm
          key={formKey}
          action={action}
          successMessage={successMessage}
          onSuccess={() => {
            setOpen(false);
            setFormKey((k) => k + 1);
          }}
          className="grid gap-5"
        >
          {(state) => (
            <>
              {typeof children === "function" ? children(state) : children}
              <div className="mt-2 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <SubmitButton>{submitLabel}</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      </ModalContent>
    </Modal>
  );
}

/**
 * Botão que pede confirmação antes de rodar uma action (ex.: excluir).
 * A action recebe um FormData com os `fields` passados.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  action,
  fields,
  destructive = true,
  successMessage,
  onDone,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  action: ServerAction;
  fields: Record<string, string>;
  destructive?: boolean;
  successMessage?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent title={title} description={description} size="sm">
        <ActionForm
          action={action}
          successMessage={successMessage}
          onSuccess={() => {
            setOpen(false);
            onDone?.();
          }}
        >
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton variant={destructive ? "danger" : "primary"} pendingLabel="Aguarde…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </ActionForm>
      </ModalContent>
    </Modal>
  );
}

/** Seção de formulário com título pequeno, para agrupar campos. */
export function FormSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("grid gap-4", className)}>
      <legend className="label mb-1 text-mute">{title}</legend>
      {children}
    </fieldset>
  );
}
