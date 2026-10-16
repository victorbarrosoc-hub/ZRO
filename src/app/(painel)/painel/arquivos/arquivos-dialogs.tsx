"use client";

import { FolderPlus } from "lucide-react";
import { fieldError, FormModal } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { criarPastaAction } from "./actions";

/** "Nova pasta" dentro da pasta aberta (uma linha). */
export function NovaPasta({ paiId, paiNome }: { paiId: string; paiNome: string }) {
  return (
    <FormModal
      trigger={
        <Button variant="secondary" size="sm" className="h-10 sm:h-9">
          <FolderPlus aria-hidden /> Nova pasta
        </Button>
      }
      title="Nova pasta"
      description={`Dentro de ${paiNome}.`}
      action={criarPastaAction}
      submitLabel="Criar pasta"
      size="sm"
    >
      {(state) => (
        <>
          <input type="hidden" name="paiId" value={paiId} />
          <Field label="Nome" htmlFor="nova-pasta-nome" error={fieldError(state, "nome")}>
            <Input id="nova-pasta-nome" name="nome" maxLength={120} autoComplete="off" autoFocus required />
          </Field>
        </>
      )}
    </FormModal>
  );
}
