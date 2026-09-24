"use client";

/**
 * Variante local do ActionForm/FormModal compartilhados.
 *
 * Com <form action={...}>, o React 19 limpa os campos não controlados sempre
 * que a action termina, inclusive quando ela volta com erro de validação: a
 * pessoa perde o que digitou. Aqui o envio passa por onSubmit + transição, e
 * o formulário só é limpo quando dá certo (resetOnSuccess).
 * Sugestão: levar este comportamento para src/components/painel/form.tsx.
 */
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";

type ServerAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const PendingContext = createContext(false);

export function StableForm({
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
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(action, null);
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
    <PendingContext.Provider value={pending}>
      <form
        ref={formRef}
        noValidate
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const fd = new FormData(e.currentTarget);
          startTransition(() => dispatch(fd));
        }}
      >
        {typeof children === "function" ? children(state) : children}
      </form>
    </PendingContext.Provider>
  );
}

/** Botão de enviar do StableForm (o useFormStatus não vê envio por onSubmit). */
export function StableSubmit({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  size = "md",
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Mesmo contrato do FormModal compartilhado, sem perder o que foi digitado em caso de erro. */
export function StableFormModal({
  trigger,
  title,
  description,
  action,
  submitLabel = "Salvar",
  size = "md",
  children,
  successMessage,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: ServerAction;
  submitLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode | ((state: ActionResult | null) => React.ReactNode);
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setFormKey((k) => k + 1);
      }}
    >
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent title={title} description={description} size={size}>
        <StableForm
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
                <StableSubmit>{submitLabel}</StableSubmit>
              </div>
            </>
          )}
        </StableForm>
      </ModalContent>
    </Modal>
  );
}
