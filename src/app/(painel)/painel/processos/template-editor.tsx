"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { ActionForm, SubmitButton, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardHeader } from "@/components/ui/surface";
import type { ActionResult } from "@/lib/actions";
import { CATEGORIES, STAGES } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { IconButton } from "../site/_components/list-controls";
import { saveTemplate } from "./actions";

export type TemplateEditorValues = {
  id?: string;
  name: string;
  category: string;
  description: string;
  tasks: { stage: string; title: string }[];
};

type Row = { key: string; stage: string; title: string };

const STAGE_INDEX = new Map<string, number>(STAGES.map((s, i) => [s.key, i]));
const stageIdx = (key: string) => STAGE_INDEX.get(key) ?? 0;

let keySeq = 0;
const newKey = () => `t${++keySeq}`;

/** Mantém a lista em ordem de etapa (estável dentro de cada etapa). */
function sortByStage(rows: Row[]) {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => stageIdx(a.r.stage) - stageIdx(b.r.stage) || a.i - b.i)
    .map(({ r }) => r);
}

export function TemplateEditor({
  initial,
  otherCategories,
}: {
  initial: TemplateEditorValues;
  /** Categorias já usadas por outros modelos (para avisar repetição). */
  otherCategories: { category: string; name: string; older: boolean }[];
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [description, setDescription] = useState(initial.description);
  const [rows, setRows] = useState<Row[]>(() =>
    sortByStage(initial.tasks.map((t) => ({ key: newKey(), stage: t.stage, title: t.title }))),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const tasksJson = JSON.stringify(
    rows.map((r) => ({ stage: r.stage, title: r.title.trim() })).filter((r) => r.title),
  );
  const snapshot = JSON.stringify([name, category, description, tasksJson]);
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline;
  const total = rows.filter((r) => r.title.trim()).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const clash = category ? otherCategories.find((c) => c.category === category) : undefined;

  function addTask(stage: string) {
    const title = (drafts[stage] ?? "").trim();
    if (!title) return;
    setRows((list) => sortByStage([...list, { key: newKey(), stage, title }]));
    setDrafts((d) => ({ ...d, [stage]: "" }));
  }

  /**
   * Sobe/desce dentro da etapa. No limite da etapa, passa para a etapa vizinha
   * (a primeira tarefa de Conceito "sobe" para o fim de Origem).
   */
  function moveTask(key: string, dir: -1 | 1) {
    setRows((list) => {
      const i = list.findIndex((r) => r.key === key);
      if (i < 0) return list;
      const row = list[i];
      const neighbor = list[i + dir];
      const next = [...list];
      if (neighbor && neighbor.stage === row.stage) {
        [next[i], next[i + dir]] = [next[i + dir], next[i]];
        return next;
      }
      const target = STAGES[stageIdx(row.stage) + dir];
      if (!target) return list;
      next[i] = { ...row, stage: target.key };
      return next;
    });
  }

  function onSuccess(state: Extract<ActionResult, { ok: true }>) {
    setBaseline(snapshot);
    if (isNew && state.id) router.replace(`/painel/processos/${state.id}`);
  }

  const status = dirty ? "Alterações não salvas" : isNew ? "Modelo novo" : "Tudo salvo";

  return (
    <ActionForm action={saveTemplate} onSuccess={onSuccess} className="grid gap-6 xl:grid-cols-12 xl:items-start">
      {(state) => (
        <>
          {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="tasks" value={tasksJson} />

          <aside className="grid gap-4 xl:sticky xl:top-10 xl:col-span-4">
            <Card>
              <CardHeader title="Dados do modelo" />
              <div className="grid gap-4 p-5 sm:p-6">
                <Field label="Nome" htmlFor="tpl-name" error={fieldError(state, "name")}>
                  <Input id="tpl-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={isNew} />
                </Field>
                <Field
                  label="Categoria"
                  htmlFor="tpl-category"
                  error={fieldError(state, "category")}
                  hint={
                    category
                      ? "Novo projeto desta categoria já nasce com estas tarefas."
                      : "Sem categoria, o modelo só entra quando for escolhido à mão no projeto."
                  }
                >
                  <Select id="tpl-category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Sem categoria</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.short}
                      </option>
                    ))}
                  </Select>
                </Field>
                {clash ? (
                  <p className="flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn/[0.06] px-3.5 py-3 text-[13px] text-warn">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      “{clash.name}” também é desta categoria.{" "}
                      {clash.older
                        ? "Novos projetos continuam usando aquele, que é o mais antigo."
                        : "Novos projetos usam este, que é o mais antigo."}
                    </span>
                  </p>
                ) : null}
                <Field label="Descrição" htmlFor="tpl-description" error={fieldError(state, "description")}>
                  <Textarea
                    id="tpl-description"
                    name="description"
                    rows={2}
                    value={description}
                    maxLength={300}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Para que tipo de job serve."
                  />
                </Field>
              </div>
              <ol className="grid grid-cols-7 gap-1 border-t border-line px-5 py-4 sm:px-6" aria-label="Tarefas por etapa">
                {STAGES.map((s) => {
                  const count = rows.filter((r) => r.stage === s.key && r.title.trim()).length;
                  return (
                    <li key={s.key} className="grid justify-items-center gap-0.5 text-center">
                      <span className={cn("text-[16px] font-semibold", count ? "text-white" : "text-white/25")}>{count}</span>
                      <span className="font-mono text-[10px] text-mute">{s.n}</span>
                      <span className="sr-only">{s.label}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="hidden gap-2 border-t border-line p-5 sm:p-6 xl:grid">
                <SubmitButton className="w-full">{isNew ? "Criar modelo" : "Salvar modelo"}</SubmitButton>
                <p className={cn("text-center text-[12px]", dirty ? "text-warn" : "text-mute")}>
                  {status} · {total} tarefa{total === 1 ? "" : "s"}
                </p>
              </div>
            </Card>
          </aside>

          <div className="grid min-w-0 gap-4 xl:col-span-8">
            {fieldError(state, "tasks") ? (
              <p className="rounded-2xl border border-danger/40 bg-danger/[0.06] px-4 py-3 text-[13px] text-danger" role="alert">
                {fieldError(state, "tasks")}
              </p>
            ) : null}
            {STAGES.map((stage, si) => {
              const stageRows = rows.filter((r) => r.stage === stage.key);
              return (
                <section key={stage.key} className="rounded-card border border-line bg-white/[0.015]" aria-labelledby={`stage-${stage.key}`}>
                  <header className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5">
                    <div className="min-w-0">
                      <h2 id={`stage-${stage.key}`} className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[12px] text-mute">{stage.n}</span>
                        <span className="text-[16px] font-medium tracking-[-0.01em] text-white">{stage.label}</span>
                      </h2>
                      <p className="mt-0.5 text-[13px] text-mute">{stage.hint}</p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[12px] text-mute">
                      {stageRows.length} tarefa{stageRows.length === 1 ? "" : "s"}
                    </span>
                  </header>

                  {stageRows.length ? (
                    <ol className="mt-2 grid px-2 sm:px-3">
                      {stageRows.map((r, i) => {
                        const atTop = i === 0;
                        const atBottom = i === stageRows.length - 1;
                        const upLabel = atTop && si > 0 ? `Passar para ${STAGES[si - 1].label}` : "Subir";
                        const downLabel = atBottom && si < STAGES.length - 1 ? `Passar para ${STAGES[si + 1].label}` : "Descer";
                        return (
                          <li key={r.key} className="group flex items-center gap-1 rounded-xl pr-1 pl-2 transition-colors hover:bg-white/[0.03]">
                            <span className="w-5 shrink-0 text-center font-mono text-[11px] text-mute tabular-nums">{i + 1}</span>
                            <input
                              aria-label={`Tarefa ${i + 1} de ${stage.label}`}
                              value={r.title}
                              maxLength={160}
                              onChange={(e) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))}
                              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                              className={cn(
                                "h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[14px] text-light transition-colors hover:border-line focus:border-white/40 focus:bg-white/[0.03] focus:outline-none",
                                !r.title.trim() && "border-danger/40",
                              )}
                            />
                            <IconButton label={upLabel} disabled={atTop && si === 0} onClick={() => moveTask(r.key, -1)}>
                              <ArrowUp />
                            </IconButton>
                            <IconButton
                              label={downLabel}
                              disabled={atBottom && si === STAGES.length - 1}
                              onClick={() => moveTask(r.key, 1)}
                            >
                              <ArrowDown />
                            </IconButton>
                            <IconButton
                              label="Remover tarefa"
                              onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                              className="hover:bg-danger/10 hover:text-danger"
                            >
                              <X />
                            </IconButton>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="px-4 pt-3 text-[13px] text-mute sm:px-5">Nenhuma tarefa nesta etapa.</p>
                  )}

                  <div className="mt-3 flex gap-2 border-t border-line p-3 sm:px-4">
                    <input
                      aria-label={`Nova tarefa em ${stage.label}`}
                      value={drafts[stage.key] ?? ""}
                      maxLength={160}
                      onChange={(e) => setDrafts((d) => ({ ...d, [stage.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTask(stage.key);
                        }
                      }}
                      placeholder={`Nova tarefa em ${stage.label}`}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-white/[0.03] px-3 text-[14px] text-light placeholder:text-mute transition-colors hover:border-white/25 focus:border-white/50 focus:outline-none"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => addTask(stage.key)}
                      disabled={!(drafts[stage.key] ?? "").trim()}
                      aria-label={`Adicionar tarefa em ${stage.label}`}
                    >
                      <Plus /> <span className="hidden sm:inline">Adicionar</span>
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-4 border-t border-line bg-void/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:hidden">
            <p className={cn("text-[13px]", dirty ? "text-warn" : "text-mute")}>
              {status} · {total} tarefa{total === 1 ? "" : "s"}
            </p>
            <SubmitButton>{isNew ? "Criar modelo" : "Salvar modelo"}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
