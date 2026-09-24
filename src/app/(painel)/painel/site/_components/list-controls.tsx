"use client";

/**
 * Controles de lista usados em Site, Processos e Ajustes: subir/descer,
 * chave "no site" e botões de ícone que rodam uma action sem abrir janela.
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalTrigger, Tip } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";

export type ServerAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** Roda a action direto (sem formulário), com espera e aviso de erro/sucesso. */
export function useQuickAction(action: ServerAction) {
  const [pending, startTransition] = useTransition();
  function run(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      try {
        const res = await action(null, fd);
        if (res.ok) {
          if (res.message) toast.success(res.message);
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Não foi possível salvar. Tente de novo.");
      }
    });
  }
  return { pending, run };
}

/**
 * Botão redondo só com ícone. `tip={false}` quando for gatilho de janela
 * (ConfirmAction/FormModal), porque o gatilho precisa receber as props direto.
 */
export function IconButton({
  label,
  tip = true,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; tip?: boolean }) {
  const button = (
    <button
      type="button"
      aria-label={label}
      title={tip ? undefined : label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-25 sm:size-9 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
  if (!tip || props.disabled) return button;
  return <Tip content={label}>{button}</Tip>;
}

/**
 * Confirmação para excluir um item de lista. Diferente do ConfirmAction, o
 * aviso sai mesmo quando a linha some da tela ao revalidar (o toast é chamado
 * depois do await, não num efeito do componente que foi desmontado).
 */
export function ConfirmQuick({
  trigger,
  title,
  description,
  confirmLabel = "Excluir",
  action,
  fields,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  action: ServerAction;
  fields: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function confirm() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      try {
        const res = await action(null, fd);
        if (res.ok) {
          if (res.message) toast.success(res.message);
          setOpen(false);
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Não foi possível excluir. Tente de novo.");
      }
    });
  }
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent title={title} description={description} size="sm">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={pending} onClick={confirm}>
            {pending ? "Aguarde…" : confirmLabel}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}

/** Setas para mudar a posição de um item na lista (a ordem vale no site). */
export function OrderButtons({
  action,
  id,
  first,
  last,
  name,
}: {
  action: ServerAction;
  id: string;
  first: boolean;
  last: boolean;
  name: string;
}) {
  const { pending, run } = useQuickAction(action);
  return (
    <div className={cn("flex items-center", pending && "opacity-60")}>
      <IconButton label={`Subir ${name}`} disabled={first || pending} onClick={() => run({ id, dir: "up" })}>
        <ArrowUp />
      </IconButton>
      <IconButton label={`Descer ${name}`} disabled={last || pending} onClick={() => run({ id, dir: "down" })}>
        <ArrowDown />
      </IconButton>
    </div>
  );
}

/** Chave liga/desliga que roda uma action (ex.: publicar no site). */
export function ToggleSwitch({
  action,
  fields,
  checked,
  label,
  onLabel,
  offLabel,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  checked: boolean;
  label: string;
  onLabel: string;
  offLabel: string;
}) {
  const { pending, run } = useQuickAction(action);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={pending}
      onClick={() => run(fields)}
      className={cn(
        "group inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full pr-1 pl-1 text-[13px] transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-60 sm:h-9",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-colors duration-200",
          checked ? "border-white bg-white" : "border-line-strong bg-white/[0.04]",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute size-4 rounded-full transition-[left,background-color] duration-200 ease-out-expo",
            checked ? "left-[18px] bg-void" : "left-[2px] bg-mute",
          )}
        />
      </span>
      <span className={cn("pr-2 whitespace-nowrap", checked ? "text-light" : "text-mute")}>
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}
