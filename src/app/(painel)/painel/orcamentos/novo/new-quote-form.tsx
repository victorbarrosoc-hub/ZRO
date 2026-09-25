"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, SubmitButton, fieldError } from "@/components/painel/form";
import { Field, Input, Select } from "@/components/ui/field";
import { CATEGORIES } from "@/lib/domain";
import { NEW_CLIENT_VALUE, projectTypeTitle, suggestedTitle } from "@/lib/services/quotes";
import { createQuote } from "../actions";

type Option = { id: string; name: string };

export function NewQuoteForm({
  lead,
  clients,
  openLeads,
  defaults,
}: {
  lead: { id: string; name: string; hasClient: boolean } | null;
  clients: Option[];
  openLeads: Option[];
  defaults: { clientId: string; title: string; category: string };
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaults.clientId);
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(defaults.title);
  const [titleEdited, setTitleEdited] = useState(false);
  const [category, setCategory] = useState(defaults.category);

  const who = (id: string, name = newName) =>
    lead?.name ?? (id === NEW_CLIENT_VALUE ? name : (clients.find((c) => c.id === id)?.name ?? ""));

  function suggest(nextWho: string, nextCategory: string) {
    if (!titleEdited) setTitle(nextWho ? suggestedTitle(nextWho, projectTypeTitle(nextCategory)) : "");
  }

  function onRecipient(value: string) {
    if (value.startsWith("lead:")) {
      router.push(`/painel/orcamentos/novo?lead=${encodeURIComponent(value.slice(5))}`);
      return;
    }
    setClientId(value);
    if (!lead) suggest(who(value), category);
  }

  return (
    <ActionForm action={createQuote} className="grid gap-5">
      {(state) => (
        <>
          {lead ? <input type="hidden" name="leadId" value={lead.id} /> : null}

          <Field
            label={lead ? "Cliente" : "Para quem é"}
            htmlFor="nq-client"
            hint={
              lead
                ? lead.hasClient
                  ? "Este lead já está ligado a um cliente."
                  : "Sem cliente ainda: ao aprovar, ele é cadastrado com os dados do lead."
                : "Escolha um cliente, cadastre um novo ou comece por um lead do CRM."
            }
            error={fieldError(state, "clientId")}
          >
            <Select id="nq-client" name="clientId" value={clientId} onChange={(e) => onRecipient(e.target.value)}>
              {lead ? (
                <option value="">Cadastrar a partir do lead ({lead.name})</option>
              ) : (
                <option value="" disabled>
                  Escolha…
                </option>
              )}
              {!lead ? <option value={NEW_CLIENT_VALUE}>+ Cliente novo</option> : null}
              {clients.length ? (
                <optgroup label="Clientes">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {!lead && openLeads.length ? (
                <optgroup label="Leads em aberto">
                  {openLeads.map((l) => (
                    <option key={l.id} value={`lead:${l.id}`}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>

          {clientId === NEW_CLIENT_VALUE ? (
            <Field
              label="Nome do cliente novo"
              htmlFor="nq-new"
              hint="Os outros dados você completa depois no CRM."
              error={fieldError(state, "newClientName")}
            >
              <Input
                id="nq-new"
                name="newClientName"
                value={newName}
                autoFocus
                onChange={(e) => {
                  setNewName(e.target.value);
                  suggest(e.target.value, category);
                }}
                placeholder="Ex.: Hotel Exemplo"
              />
            </Field>
          ) : null}

          <Field label="Título" htmlFor="nq-title" hint="Aparece em destaque no timbrado." error={fieldError(state, "title")}>
            <Input
              id="nq-title"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleEdited(true);
              }}
              placeholder="Ex.: Clínica Aurora · Campanha de lançamento"
              required
            />
          </Field>

          <Field label="Categoria" htmlFor="nq-cat" hint="Vira a categoria do projeto quando o orçamento for aprovado." error={fieldError(state, "category")}>
            <Select
              id="nq-cat"
              name="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (!lead) suggest(who(clientId), e.target.value);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.short}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <SubmitButton pendingLabel="Criando…">Criar orçamento</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
