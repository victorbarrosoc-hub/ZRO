"use client";

import { Pencil } from "lucide-react";
import { FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { saveBriefing } from "../../actions";

export function EditBriefingButton({ id, briefing, notes }: { id: string; briefing: string | null; notes: string | null }) {
  return (
    <FormModal
      title="Briefing"
      description="A ideia, o pedido do cliente e o que já se sabe."
      action={saveBriefing}
      size="lg"
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil /> {briefing ? "Editar" : "Escrever"}
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field label="Briefing" htmlFor="bf-briefing" error={fieldError(state, "briefing")}>
            <Textarea id="bf-briefing" name="briefing" rows={9} maxLength={5000} defaultValue={briefing ?? ""} autoFocus />
          </Field>
          <Field label="Observações internas" htmlFor="bf-notes" error={fieldError(state, "notes")} hint="Só para vocês dois: combinados, cuidados, contatos.">
            <Textarea id="bf-notes" name="notes" rows={3} maxLength={3000} defaultValue={notes ?? ""} />
          </Field>
        </>
      )}
    </FormModal>
  );
}
