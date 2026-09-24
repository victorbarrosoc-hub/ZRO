"use client";

/* eslint-disable @next/next/no-img-element -- prévia do painel, sem otimizador */
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmAction, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/actions";
import { initials } from "@/lib/format";
import {
  createFaq,
  createShowcaseClient,
  createTeamMember,
  deleteFaq,
  deleteShowcaseClient,
  deleteTeamMember,
  moveFaq,
  moveShowcaseClient,
  moveTeamMember,
  toggleFaqPublished,
  toggleShowcasePublished,
  toggleTeamPublished,
  updateFaq,
  updateShowcaseClient,
  updateTeamMember,
} from "./actions";
import { IconButton, OrderButtons, ToggleSwitch, type ServerAction } from "./_components/list-controls";
import { StableFormModal } from "./_components/stable-form";
import { imageSrcProblem, normalizeImageUrl, type ImagePolicy } from "./_lib/image-policy";

/* ---------------- Peças comuns ---------------- */

/** Gatilho de janela: repassa as props (e o ref) que o Radix injeta. */
function EditTrigger({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <IconButton label={label} tip={false} {...props}>
      <Pencil />
    </IconButton>
  );
}

function DeleteButton({
  action,
  id,
  title,
  description,
  label,
}: {
  action: ServerAction;
  id: string;
  title: string;
  description: string;
  label: string;
}) {
  return (
    <ConfirmAction
      title={title}
      description={description}
      confirmLabel="Excluir"
      action={action}
      fields={{ id }}
      trigger={
        <IconButton label={label} tip={false} className="hover:bg-danger/10 hover:text-danger">
          <Trash2 />
        </IconButton>
      }
    />
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-1 gap-y-1">{children}</div>;
}

/* ============================== Equipe ============================== */

export type TeamDefaults = {
  id?: string;
  name?: string;
  role?: string;
  quote?: string | null;
  photoUrl?: string | null;
  instagram?: string | null;
  published?: boolean;
};

function TeamFields({ state, defaults = {}, policy }: { state: ActionResult | null; defaults?: TeamDefaults; policy: ImagePolicy }) {
  const [photo, setPhoto] = useState(defaults.photoUrl ?? "");
  const [name, setName] = useState(defaults.name ?? "");
  const problem = photo ? imageSrcProblem(photo, policy) : null;
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div className="grid content-start gap-4">
          <Field label="Nome" htmlFor="t-name" error={fieldError(state, "name")}>
            <Input id="t-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Função" htmlFor="t-role" error={fieldError(state, "role")} hint="Ex.: Sócio · Direção criativa">
            <Input id="t-role" name="role" defaultValue={defaults.role ?? ""} />
          </Field>
        </div>
        <span className="relative hidden aspect-[4/5] overflow-hidden rounded-[18px] border border-line bg-ink sm:block">
          {photo && !problem ? (
            <img src={photo} alt="" className="absolute inset-0 size-full object-cover grayscale" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-[26px] font-semibold tracking-[-0.04em] text-white/30">
              {initials(name || "?")}
            </span>
          )}
        </span>
      </div>
      <Field
        label="Frase (opcional)"
        htmlFor="t-quote"
        error={fieldError(state, "quote")}
        hint="Aparece entre aspas no cartão. Uma frase curta."
      >
        <Textarea id="t-quote" name="quote" rows={2} defaultValue={defaults.quote ?? ""} maxLength={220} />
      </Field>
      <Field
        label="Foto (opcional)"
        htmlFor="t-photo"
        error={fieldError(state, "photoUrl") ?? problem}
        hint="Caminho em /media (ex.: /media/victor.jpg). No site ela aparece em preto e branco. Sem foto, entram as iniciais."
      >
        <Input
          id="t-photo"
          name="photoUrl"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          onBlur={() => setPhoto((v) => normalizeImageUrl(v))}
          inputMode="url"
          placeholder="/media/nome.jpg"
        />
      </Field>
      <Field label="Instagram (opcional)" htmlFor="t-ig" hint="Guardado para uso futuro: o site ainda não mostra.">
        <Input id="t-ig" name="instagram" defaultValue={defaults.instagram ?? ""} placeholder="usuario" />
      </Field>
      <Checkbox name="published" defaultChecked={defaults.published ?? true} label="Mostrar no site" />
    </>
  );
}

export function NewTeamMemberButton({ policy }: { policy: ImagePolicy }) {
  return (
    <StableFormModal
      title="Nova pessoa na equipe"
      description="Aparece em “Quem dirige”, na página inicial e em Sobre."
      action={createTeamMember}
      submitLabel="Adicionar"
      trigger={
        <Button variant="primary">
          <Plus /> Nova pessoa
        </Button>
      }
    >
      {(state) => <TeamFields state={state} policy={policy} />}
    </StableFormModal>
  );
}

export function TeamRowActions({
  member,
  first,
  last,
  policy,
}: {
  member: Required<Pick<TeamDefaults, "id" | "name" | "published">> & TeamDefaults;
  first: boolean;
  last: boolean;
  policy: ImagePolicy;
}) {
  return (
    <RowActions>
      <ToggleSwitch
        action={toggleTeamPublished}
        fields={{ id: member.id }}
        checked={member.published}
        label={`Mostrar ${member.name} no site`}
        onLabel="No site"
        offLabel="Fora do site"
      />
      <OrderButtons action={moveTeamMember} id={member.id} first={first} last={last} name={member.name} />
      <StableFormModal
        title="Editar pessoa"
        action={updateTeamMember}
        trigger={<EditTrigger label={`Editar ${member.name}`} />}
      >
        {(state) => <TeamFields state={state} defaults={member} policy={policy} />}
      </StableFormModal>
      <DeleteButton
        action={deleteTeamMember}
        id={member.id}
        label={`Excluir ${member.name}`}
        title={`Tirar ${member.name} da equipe do site?`}
        description="Some da página inicial e de Sobre. O acesso à área interna não muda."
      />
    </RowActions>
  );
}

/* ============================== Clientes no site ============================== */

function ShowcaseFields({ state, defaults = {} }: { state: ActionResult | null; defaults?: { id?: string; name?: string; published?: boolean } }) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Field label="Nome como aparece no site" htmlFor="sc-name" error={fieldError(state, "name")} hint="Curto: é escrito grande, em linha. Ex.: SERHS">
        <Input id="sc-name" name="name" defaultValue={defaults.name ?? ""} required autoFocus maxLength={60} />
      </Field>
      <Checkbox
        name="published"
        defaultChecked={defaults.published ?? false}
        label={
          <>
            <span className="block text-light">Mostrar no site</span>
            <span className="text-[13px] text-mute">Só depois de confirmar a autorização do cliente.</span>
          </>
        }
      />
    </>
  );
}

export function NewShowcaseClientButton() {
  return (
    <StableFormModal
      title="Novo cliente no site"
      description="Nome que aparece em “Quem confia na ZRO”."
      action={createShowcaseClient}
      submitLabel="Adicionar"
      size="sm"
      trigger={
        <Button variant="primary">
          <Plus /> Novo cliente
        </Button>
      }
    >
      {(state) => <ShowcaseFields state={state} />}
    </StableFormModal>
  );
}

export function ShowcaseRowActions({
  client,
  first,
  last,
}: {
  client: { id: string; name: string; published: boolean };
  first: boolean;
  last: boolean;
}) {
  return (
    <RowActions>
      <ToggleSwitch
        action={toggleShowcasePublished}
        fields={{ id: client.id }}
        checked={client.published}
        label={`Mostrar ${client.name} no site`}
        onLabel="No site"
        offLabel="Fora do site"
      />
      <OrderButtons action={moveShowcaseClient} id={client.id} first={first} last={last} name={client.name} />
      <StableFormModal title="Editar cliente" action={updateShowcaseClient} size="sm" trigger={<EditTrigger label={`Editar ${client.name}`} />}>
        {(state) => <ShowcaseFields state={state} defaults={client} />}
      </StableFormModal>
      <DeleteButton
        action={deleteShowcaseClient}
        id={client.id}
        label={`Excluir ${client.name}`}
        title={`Tirar ${client.name} do site?`}
        description="O nome sai de “Quem confia na ZRO”. O cadastro do cliente no CRM não muda."
      />
    </RowActions>
  );
}

/* ============================== Perguntas frequentes ============================== */

function FaqFields({
  state,
  defaults = {},
}: {
  state: ActionResult | null;
  defaults?: { id?: string; question?: string; answer?: string; published?: boolean };
}) {
  return (
    <>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Field label="Pergunta" htmlFor="faq-q" error={fieldError(state, "question")}>
        <Input id="faq-q" name="question" defaultValue={defaults.question ?? ""} required autoFocus maxLength={200} />
      </Field>
      <Field label="Resposta" htmlFor="faq-a" error={fieldError(state, "answer")} hint="Direta, falando com o cliente por “você”.">
        <Textarea id="faq-a" name="answer" rows={5} defaultValue={defaults.answer ?? ""} maxLength={2000} />
      </Field>
      <Checkbox name="published" defaultChecked={defaults.published ?? true} label="Mostrar no site" />
    </>
  );
}

export function NewFaqButton() {
  return (
    <StableFormModal
      title="Nova pergunta"
      description="Entra no fim da lista de perguntas frequentes."
      action={createFaq}
      submitLabel="Adicionar"
      trigger={
        <Button variant="primary">
          <Plus /> Nova pergunta
        </Button>
      }
    >
      {(state) => <FaqFields state={state} />}
    </StableFormModal>
  );
}

export function FaqRowActions({
  faq,
  first,
  last,
}: {
  faq: { id: string; question: string; answer: string; published: boolean };
  first: boolean;
  last: boolean;
}) {
  return (
    <RowActions>
      <ToggleSwitch
        action={toggleFaqPublished}
        fields={{ id: faq.id }}
        checked={faq.published}
        label={`Mostrar no site: ${faq.question}`}
        onLabel="No site"
        offLabel="Fora do site"
      />
      <OrderButtons action={moveFaq} id={faq.id} first={first} last={last} name="pergunta" />
      <StableFormModal title="Editar pergunta" action={updateFaq} trigger={<EditTrigger label="Editar pergunta" />}>
        {(state) => <FaqFields state={state} defaults={faq} />}
      </StableFormModal>
      <DeleteButton
        action={deleteFaq}
        id={faq.id}
        label="Excluir pergunta"
        title="Excluir esta pergunta?"
        description={faq.question}
      />
    </RowActions>
  );
}
