"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { fieldError } from "@/components/painel/form";
import { ImageField } from "@/components/painel/image-field";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { StableForm, StableSubmit } from "../site/_components/stable-form";
import { changePassword, saveProfile } from "./actions";

export function ChangePasswordForm({ email }: { email: string }) {
  const [show, setShow] = useState(false);
  const [next, setNext] = useState("");
  const [formKey, setFormKey] = useState(0);
  const long = next.length >= 10;

  return (
    <StableForm
      key={formKey}
      action={changePassword}
      onSuccess={() => {
        setNext("");
        setFormKey((k) => k + 1);
      }}
      className="grid gap-4 p-5 sm:p-6"
    >
      {(state) => (
        <>
          {/* Ajuda o gerenciador de senhas a guardar para a conta certa. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <Field label="Senha atual" htmlFor="pw-current" error={fieldError(state, "current")}>
            <Input id="pw-current" name="current" type={show ? "text" : "password"} autoComplete="current-password" required />
          </Field>
          <Field
            label="Nova senha"
            htmlFor="pw-next"
            error={fieldError(state, "next")}
            hint={
              <span className={cn(next && (long ? "text-ok" : "text-warn"))}>
                {next ? `${next.length} caracteres${long ? "" : ": mínimo de 10"}` : "Mínimo de 10 caracteres. Uma frase curta é fácil de lembrar."}
              </span>
            }
          >
            <Input
              id="pw-next"
              name="next"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>
          <Field label="Repita a nova senha" htmlFor="pw-confirm" error={fieldError(state, "confirm")}>
            <Input id="pw-confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required />
          </Field>
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-full px-1 text-[13px] text-ash hover:text-white"
              aria-pressed={show}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {show ? "Esconder senhas" : "Mostrar senhas"}
            </button>
            <StableSubmit pendingLabel="Trocando…">Trocar senha</StableSubmit>
          </div>
        </>
      )}
    </StableForm>
  );
}

/** Nome e foto (a foto aparece no menu e nos cards da Pauta). */
export function ProfileForm({ name, photoId }: { name: string; photoId?: string | null }) {
  // Depois de salvar, o formulário recomeça com a foto que ficou no banco.
  const [formKey, setFormKey] = useState(0);
  return (
    <StableForm key={formKey} action={saveProfile} onSuccess={() => setFormKey((k) => k + 1)} className="grid gap-4 p-5 sm:p-6">
      {(state) => (
        <>
          <ImageField name="photo" kind="foto" currentId={photoId} displayName={name} error={fieldError(state, "photo")} />
          <Field label="Nome" htmlFor="profile-name" error={fieldError(state, "name")}>
            <Input id="profile-name" name="name" defaultValue={name} autoComplete="name" maxLength={80} required />
          </Field>
          <div className="flex justify-end border-t border-line pt-4">
            <StableSubmit>Salvar perfil</StableSubmit>
          </div>
        </>
      )}
    </StableForm>
  );
}
