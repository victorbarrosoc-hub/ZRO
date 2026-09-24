"use client";

import { useOptimistic, useTransition } from "react";
import { ArrowUpRight, Check, ChevronDown, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectStatusBadge } from "@/components/painel/bits";
import { ConfirmAction, FormModal, fieldError } from "@/components/painel/form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/overlay";
import { PROJECT_STATUS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { createProjectAction, deleteProject, setProjectStatus, updateDriveUrl, updateProject } from "./actions";
import { ProjectFields, type ProjectDefaults, type ProjectOptions } from "./projeto-fields";

export function NewProjectButton({ options, variant = "primary" }: { options: ProjectOptions; variant?: "primary" | "secondary" }) {
  return (
    <FormModal
      title="Novo projeto"
      description="Começa em 01 Origem, com as tarefas do modelo."
      action={createProjectAction}
      submitLabel="Criar projeto"
      size="lg"
      trigger={
        <Button variant={variant}>
          <Plus /> Novo projeto
        </Button>
      }
    >
      {(state) => <ProjectFields state={state} options={options} />}
    </FormModal>
  );
}

export function EditProjectButton({ defaults, options }: { defaults: ProjectDefaults; options: ProjectOptions }) {
  return (
    <FormModal
      title="Editar projeto"
      action={updateProject}
      size="lg"
      trigger={
        <Button variant="secondary" size="sm">
          <Pencil /> Editar
        </Button>
      }
    >
      {(state) => <ProjectFields state={state} options={options} defaults={defaults} mode="edit" />}
    </FormModal>
  );
}

export function DeleteProjectButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmAction
      title={`Excluir ${title}?`}
      description="Tarefas, entregas, equipe, agenda e documentos do projeto são apagados. Os lançamentos do financeiro continuam, sem o vínculo com o projeto."
      confirmLabel="Excluir projeto"
      action={deleteProject}
      fields={{ id }}
      trigger={
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger">
          <Trash2 /> Excluir
        </Button>
      }
    />
  );
}

/** Link da pasta do projeto no Drive: abre direto e edita numa janela pequena. */
export function DriveLinkButton({ id, driveUrl }: { id: string; driveUrl: string | null }) {
  return (
    <div className="flex items-center">
      {driveUrl ? (
        <a href={driveUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", size: "sm", className: "rounded-r-none border-r-0" })}>
          <FolderOpen /> Drive <ArrowUpRight className="text-mute" />
        </a>
      ) : null}
      <FormModal
        title="Link do Drive"
        description="A pasta do projeto: brutos, cortes e entregas."
        action={updateDriveUrl}
        size="sm"
        trigger={
          driveUrl ? (
            <Button variant="secondary" size="sm" className="rounded-l-none px-2.5" aria-label="Editar link do Drive">
              <Pencil />
            </Button>
          ) : (
            <Button variant="secondary" size="sm">
              <FolderOpen /> Link do Drive
            </Button>
          )
        }
      >
        {(state) => (
          <>
            <input type="hidden" name="id" value={id} />
            <Field label="Link da pasta" htmlFor="drive-url" hint="Deixe em branco para remover." error={fieldError(state, "driveUrl")}>
              <Input
                id="drive-url"
                name="driveUrl"
                type="url"
                inputMode="url"
                defaultValue={driveUrl ?? ""}
                placeholder="https://drive.google.com/…"
                autoFocus
              />
            </Field>
          </>
        )}
      </FormModal>
    </div>
  );
}

/** Selo de status que abre um menu para trocar (ativo, pausado, concluído, cancelado). */
export function ProjectStatusMenu({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(status);
  const label = PROJECT_STATUS.find((s) => s.key === current)?.label ?? current;

  function choose(next: string) {
    if (next === current) return;
    startTransition(async () => {
      setCurrent(next);
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", next);
      const result = await setProjectStatus(null, fd);
      if (!result.ok) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-full pr-2 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-white",
            pending && "opacity-60",
          )}
          aria-label={`Status: ${label}. Trocar status`}
        >
          <ProjectStatusBadge status={current} />
          <ChevronDown className="size-3.5 text-mute" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>Status do projeto</MenuLabel>
        {PROJECT_STATUS.map((s) => (
          <MenuItem key={s.key} onSelect={() => choose(s.key)}>
            <Check className={cn(s.key === current ? "opacity-100" : "opacity-0")} aria-hidden />
            {s.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
