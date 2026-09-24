"use client";

import { useState } from "react";
import { fieldError } from "@/components/painel/form";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { CATEGORIES } from "@/lib/domain";
import { centsToInput, todayISO } from "@/lib/format";

export type ProjectOptions = {
  clients: { id: string; name: string }[];
  templates: { id: string; name: string; category: string | null; taskCount: number }[];
};

export type ProjectDefaults = {
  id?: string;
  title?: string;
  clientId?: string | null;
  category?: string;
  startDate?: string | null;
  dueDate?: string | null;
  value?: number | null;
};

/** Campos do projeto. Ao criar, entram também o modelo de tarefas e o briefing. */
export function ProjectFields({
  state,
  options,
  defaults = {},
  mode = "create",
}: {
  state: ActionResult | null;
  options: ProjectOptions;
  defaults?: ProjectDefaults;
  mode?: "create" | "edit";
}) {
  const [category, setCategory] = useState<string>(defaults.category ?? CATEGORIES[0].key);
  const [templateId, setTemplateId] = useState("");
  const categoryTemplate = options.templates.find((t) => t.category === category);
  const chosen = templateId ? options.templates.find((t) => t.id === templateId) : categoryTemplate;
  const p = mode === "create" ? "np" : "ep";

  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor={`${p}-title`} error={fieldError(state, "title")} className="sm:col-span-2">
          <Input
            id={`${p}-title`}
            name="title"
            defaultValue={defaults.title}
            placeholder="Ex.: SERHS · Conteúdo 2027"
            autoFocus={mode === "create"}
            required
          />
        </Field>
        <Field label="Cliente" htmlFor={`${p}-client`} error={fieldError(state, "clientId")}>
          <Select id={`${p}-client`} name="clientId" defaultValue={defaults.clientId ?? ""}>
            <option value="">Sem cliente</option>
            {options.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria" htmlFor={`${p}-category`} error={fieldError(state, "category")}>
          <Select id={`${p}-category`} name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.short}
              </option>
            ))}
          </Select>
        </Field>

        {mode === "create" ? (
          <Field
            label="Modelo de tarefas"
            htmlFor={`${p}-template`}
            error={fieldError(state, "templateId")}
            className="sm:col-span-2"
            hint={
              chosen
                ? `${chosen.taskCount} tarefas de "${chosen.name}", distribuídas pelas 7 etapas.`
                : "Não há modelo para esta categoria: o projeto começa sem tarefas."
            }
          >
            <Select id={`${p}-template`} name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Modelo da categoria{categoryTemplate ? ` (${categoryTemplate.name})` : ""}</option>
              {options.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Início" htmlFor={`${p}-start`} error={fieldError(state, "startDate")}>
          <Input
            id={`${p}-start`}
            name="startDate"
            type="date"
            defaultValue={mode === "create" ? todayISO() : (defaults.startDate ?? "")}
          />
        </Field>
        <Field label="Prazo final" htmlFor={`${p}-due`} error={fieldError(state, "dueDate")}>
          <Input id={`${p}-due`} name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
        </Field>
        <Field
          label="Valor contratado"
          htmlFor={`${p}-value`}
          error={fieldError(state, "value")}
          hint="O que o cliente paga. Base da margem e do imposto estimado."
          className="sm:col-span-2"
        >
          <MoneyInput id={`${p}-value`} name="value" placeholder="0,00" defaultValue={defaults.value ? centsToInput(defaults.value) : ""} />
        </Field>
      </div>

      {mode === "create" ? (
        <Field label="Briefing" htmlFor={`${p}-briefing`} error={fieldError(state, "briefing")} hint="A ideia, o pedido do cliente, o que já se sabe.">
          <Textarea id={`${p}-briefing`} name="briefing" rows={4} />
        </Field>
      ) : null}
    </>
  );
}
