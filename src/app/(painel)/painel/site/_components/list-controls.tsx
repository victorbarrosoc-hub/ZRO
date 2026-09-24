"use client";

/**
 * Controles de lista usados em Site, Processos e Ajustes: subir/descer,
 * chave "no site" e botões de ícone que rodam uma action sem abrir janela.
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Tip } from "@/components/ui/overlay";
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

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  const button = (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-25 sm:size-9 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
  if (props.disabled) return button;
  return <Tip content={label}>{button}</Tip>;
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
