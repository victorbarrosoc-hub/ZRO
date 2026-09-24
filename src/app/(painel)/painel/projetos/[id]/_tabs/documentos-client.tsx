"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, FileText, ListChecks, Plus, Printer, Trash2 } from "lucide-react";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { newScript } from "../roteiros/actions";
import { SCRIPT_KINDS } from "../roteiros/script-kinds";

type ServerAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Copia um texto (com plano B para navegadores sem a API de área de transferência). */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand("copy");
    } catch {
      done = false;
    }
    area.remove();
    return done;
  }
}

export function CopyTextButton({
  text,
  label = "Copiar para WhatsApp",
  done = "Texto copiado. É só colar no WhatsApp.",
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string | (() => string);
  label?: string;
  done?: string;
  variant?: "primary" | "secondary" | "ghost" | "subtle";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={async () => {
        const ok = await copyText(typeof text === "function" ? text() : text);
        if (ok) toast.success(done);
        else toast.error("Não deu para copiar. Selecione o texto e copie à mão.");
      }}
    >
      <Copy /> {label}
    </Button>
  );
}

export function PrintButton({ label = "Imprimir ou salvar PDF", className }: { label?: string; className?: string }) {
  return (
    <Button variant="primary" size="sm" className={className} onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}

/** "Novo" de um documento: cria no servidor e abre o editor. */
export function NewDocButton({ action, projectId, label }: { action: ServerAction; projectId: string; label: string }) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <SubmitButton size="sm" variant="secondary" pendingLabel="Criando…">
        <Plus /> {label}
      </SubmitButton>
    </ActionForm>
  );
}

/** "Novo" de roteiro: escolhe o tipo (roteiro, decupagem ou shot list). */
export function NewScriptMenu({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  function create(kind: string) {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("kind", kind);
    startTransition(async () => {
      const res = await newScript(null, fd);
      if (res && !res.ok) toast.error(res.error);
    });
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="sm" disabled={pending}>
          <Plus /> {pending ? "Criando…" : "Novo"} <ChevronDown className="-mr-1" />
        </Button>
      </MenuTrigger>
      <MenuContent className="w-72">
        <MenuLabel>Novo documento</MenuLabel>
        {SCRIPT_KINDS.map((k) => (
          <MenuItem key={k.key} onSelect={() => create(k.key)} className="items-start py-2.5">
            {k.key === "roteiro" ? <FileText className="mt-0.5" /> : <ListChecks className="mt-0.5" />}
            <span>
              <span className="block text-light">{k.label}</span>
              <span className="block text-[12px] text-mute">{k.hint}</span>
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function DeleteDocButton({
  action,
  fields,
  title,
  description,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  title: string;
  description?: string;
}) {
  return (
    <ConfirmAction
      title={title}
      description={description}
      confirmLabel="Excluir"
      action={action}
      fields={fields}
      trigger={
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger">
          <Trash2 /> Excluir
        </Button>
      }
    />
  );
}
