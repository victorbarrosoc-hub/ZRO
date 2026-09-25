"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { Layers, X } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, FormModal, SubmitButton, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, CardHeader } from "@/components/ui/surface";
import { STAGES } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { addTask, applyTemplateToProject, deleteTask, setTaskDone } from "../../actions";
import { Meter } from "./meter";
import { callAction, toastFirst } from "./run-action";

const addTaskT = toastFirst(addTask);
const applyTemplateT = toastFirst(applyTemplateToProject);

type Task = { id: string; stage: string; title: string; done: boolean };
type TaskAction = { type: "toggle"; id: string; done: boolean } | { type: "delete"; id: string };

function reducer(state: Task[], action: TaskAction) {
  if (action.type === "toggle") return state.map((t) => (t.id === action.id ? { ...t, done: action.done } : t));
  return state.filter((t) => t.id !== action.id);
}

/** Marca, desmarca e exclui na hora; o servidor confirma por trás. */
function useTaskList(tasks: Task[]) {
  const [items, apply] = useOptimistic(tasks, reducer);
  const [, startTransition] = useTransition();

  function toggle(t: Task) {
    const done = !t.done;
    startTransition(async () => {
      apply({ type: "toggle", id: t.id, done });
      const result = await callAction(setTaskDone, { id: t.id, done: done ? "1" : "0" });
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(t: Task) {
    startTransition(async () => {
      apply({ type: "delete", id: t.id });
      const result = await callAction(deleteTask, { id: t.id });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message ?? "Tarefa excluída.");
    });
  }

  return { items, toggle, remove };
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete?: () => void }) {
  return (
    <li className="group flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-white/[0.03]">
      <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 px-2 py-2">
        <span className="relative grid size-[18px] shrink-0">
          <input
            type="checkbox"
            checked={task.done}
            onChange={onToggle}
            className="peer size-[18px] cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-white/[0.03] transition-colors checked:border-white checked:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          />
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="pointer-events-none absolute inset-0 hidden p-[3px] text-void peer-checked:block"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </span>
        <span
          className={cn(
            "text-[14px] leading-snug transition-colors",
            task.done ? "text-mute line-through decoration-white/25" : "text-light",
          )}
        >
          {task.title}
        </span>
      </label>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir a tarefa ${task.title}`}
          className="grid size-10 shrink-0 place-items-center rounded-full text-mute transition-[opacity,color,background-color] hover:bg-white/[0.06] hover:text-light focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

/** Aba Tarefas: todas as tarefas agrupadas pelas 7 etapas. */
export function TaskBoard({
  projectId,
  category,
  currentStage,
  tasks,
  templates,
}: {
  projectId: string;
  category: string;
  currentStage: string;
  tasks: Task[];
  templates: { id: string; name: string; category: string | null; taskCount: number }[];
}) {
  const { items, toggle, remove } = useTaskList(tasks);
  const done = items.filter((t) => t.done).length;

  return (
    <div>
      <CardHeader
        title="Tarefas"
        description={items.length ? `${done} de ${items.length} concluídas` : undefined}
        action={
          <ApplyTemplateButton
            projectId={projectId}
            templates={templates}
            defaultId={templates.find((t) => t.category === category)?.id ?? templates[0]?.id}
          />
        }
      />
      {items.length ? (
        <div className="px-5 pt-4 sm:px-6">
          <Meter value={done} max={items.length} label="Tarefas concluídas" />
        </div>
      ) : null}
      <div className="px-5 pt-5 pb-2 sm:px-6">
        <AddTaskForm projectId={projectId} currentStage={currentStage} />
      </div>
      <div className="mt-3">
        {STAGES.map((s) => {
          const list = items.filter((t) => t.stage === s.key);
          const doneHere = list.filter((t) => t.done).length;
          const isCurrent = s.key === currentStage;
          return (
            <section key={s.key} aria-labelledby={`etapa-${s.key}`} className="border-t border-line px-3 py-3 sm:px-4">
              <header className="flex items-center justify-between gap-3 px-2 py-1.5">
                <h3 id={`etapa-${s.key}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] text-mute">{s.n}</span>
                  <span className={cn("text-[14px] font-medium", isCurrent ? "text-white" : "text-light")}>{s.label}</span>
                  {isCurrent ? (
                    <Badge tone="light" className="h-5 px-2 text-[11px]">
                      Etapa atual
                    </Badge>
                  ) : null}
                </h3>
                <span className="text-[12px] text-mute tabular-nums" aria-label={`${doneHere} de ${list.length} concluídas`}>
                  {list.length ? `${doneHere}/${list.length}` : "—"}
                </span>
              </header>
              {list.length ? (
                <ul className="mt-1 grid">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} onDelete={() => remove(t)} />
                  ))}
                </ul>
              ) : (
                <p className="px-2 pb-1.5 text-[13px] text-mute">Sem tarefas nesta etapa.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Lista curta (visão geral): as tarefas da etapa atual, com marcação na hora. */
export function StageChecklist({ tasks }: { tasks: Task[] }) {
  const { items, toggle } = useTaskList(tasks);
  return (
    <ul className="grid">
      {items.map((t) => (
        <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} />
      ))}
    </ul>
  );
}

function AddTaskForm({ projectId, currentStage }: { projectId: string; currentStage: string }) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <ActionForm
      action={addTaskT}
      resetOnSuccess
      onSuccess={() => titleRef.current?.focus()}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <div className="sm:w-52 sm:shrink-0">
            <Select name="stage" defaultValue={currentStage} aria-label="Etapa da nova tarefa">
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.n} {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid flex-1 gap-1.5">
            <Input
              ref={titleRef}
              name="title"
              placeholder="Nova tarefa"
              aria-label="Nova tarefa"
              maxLength={200}
              aria-invalid={fieldError(state, "title") ? true : undefined}
            />
            {fieldError(state, "title") ? <p className="text-[13px] text-danger">{fieldError(state, "title")}</p> : null}
          </div>
          <SubmitButton variant="secondary" pendingLabel="Adicionando…" className="h-11">
            Adicionar
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

function ApplyTemplateButton({
  projectId,
  templates,
  defaultId,
}: {
  projectId: string;
  templates: { id: string; name: string; category: string | null; taskCount: number }[];
  defaultId?: string;
}) {
  return (
    <FormModal
      title="Aplicar modelo"
      description="Copia as tarefas do modelo para o projeto. As que já existem não se repetem."
      action={applyTemplateT}
      submitLabel="Aplicar"
      size="sm"
      trigger={
        <Button variant="secondary" size="sm">
          <Layers /> Aplicar modelo
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Modelo" htmlFor="tpl-id" error={fieldError(state, "templateId")}>
            <Select id="tpl-id" name="templateId" defaultValue={defaultId ?? ""}>
              {templates.length ? null : <option value="">Nenhum modelo cadastrado</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.taskCount} tarefas
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
    </FormModal>
  );
}
