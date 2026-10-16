"use client";

import { useActionState, useId } from "react";
import { entrarAction, type EstadoSenha } from "./actions";

/**
 * Campo de senha da área do cliente. Na tela "Digite a senha." volta para a área; na janela que abre
 * no meio de um envio, só avisa (`aoEntrar`) e a fila continua de onde parou.
 */
export function SenhaForm({ token, modo, aoEntrar }: { token: string; modo: "pagina" | "modal"; aoEntrar?: () => void }) {
  const id = useId();
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(
    modo === "pagina"
      ? entrarAction.bind(null, token, "pagina")
      : async (prev, fd) => {
          const r = await entrarAction(token, "modal", prev, fd);
          if (r?.ok) aoEntrar?.();
          return r;
        },
    undefined,
  );

  return (
    <form action={acao} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label htmlFor={id} className="text-caption text-ash">
          Senha
        </label>
        <input
          id={id}
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          maxLength={200}
          aria-invalid={Boolean(estado?.erro) || undefined}
          aria-describedby={`${id}-erro`}
          className="h-14 w-full rounded-field border border-line-strong bg-white/[0.03] px-4 text-base text-light placeholder:text-mute focus:border-white/50 focus:outline-none aria-[invalid=true]:border-danger/70"
        />
      </div>
      <p id={`${id}-erro`} className="min-h-5 text-[13px] text-danger" role="alert" aria-live="polite">
        {estado?.erro ?? ""}
      </p>
      <button
        type="submit"
        disabled={pendente}
        className="inline-flex h-14 w-full items-center justify-center rounded-full bg-white px-7 text-base font-medium text-void transition-colors hover:bg-light disabled:opacity-60"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
