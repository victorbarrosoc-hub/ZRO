"use client";

import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/overlay";
import type { CompanySettings, QuoteSettings } from "@/lib/db/defaults";
import { whatsappDigits } from "@/lib/format";
import { StableForm, StableSubmit } from "../site/_components/stable-form";
import { deleteDemoData, saveCompany, saveQuoteDefaults, saveTaxes, saveWhatsapp } from "./actions";

function SaveRow({ children = "Salvar", note }: { children?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] text-mute">{note}</p>
      <StableSubmit className="sm:w-auto">{children}</StableSubmit>
    </div>
  );
}

/* ============================== WhatsApp ============================== */

/** "5584999990000" → "+55 (84) 99999-0000" */
function prettyPhone(digits: string) {
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  if (d.length === 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `+${digits}`;
}

export function WhatsappForm({ number }: { number: string }) {
  const [value, setValue] = useState(number ? prettyPhone(number) : "");
  const digits = whatsappDigits(value);
  const valid = digits.length === 12 || digits.length === 13;

  return (
    <StableForm
      action={saveWhatsapp}
      onSuccess={() => setValue(valid ? prettyPhone(digits) : "")}
      className="grid gap-4 p-5 sm:p-6"
    >
      {(state) => (
        <>
          <Field
            label="Número"
            htmlFor="wa-number"
            error={fieldError(state, "number")}
            hint="DDD + número. O 55 do Brasil entra sozinho."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="wa-number"
                name="number"
                inputMode="tel"
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="(84) 99999-0000"
                aria-invalid={Boolean(fieldError(state, "number")) || undefined}
              />
              <Button
                variant="secondary"
                className="h-11"
                disabled={!valid}
                onClick={() => window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink /> Testar link
              </Button>
            </div>
          </Field>
          <p className="text-[13px] text-mute">
            {valid ? (
              <>
                O site vai abrir <span className="font-mono text-[12px] text-ash">wa.me/{digits}</span>
              </>
            ) : value.trim() ? (
              "Número incompleto."
            ) : (
              "Sem número, o funil termina oferecendo só o e-mail."
            )}
          </p>
          <SaveRow note={number && !value.trim() ? "Salvar vazio tira o WhatsApp do site." : undefined} />
        </>
      )}
    </StableForm>
  );
}

/* ============================== Empresa ============================== */

export function CompanyForm({ company }: { company: CompanySettings }) {
  return (
    <StableForm action={saveCompany} resetOnSuccess className="grid gap-4 p-5 sm:p-6">
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razão social" htmlFor="co-legal" error={fieldError(state, "legalName")} className="sm:col-span-2">
              <Input id="co-legal" name="legalName" defaultValue={company.legalName} required />
            </Field>
            <Field label="Nome de marca" htmlFor="co-brand" error={fieldError(state, "brand")}>
              <Input id="co-brand" name="brand" defaultValue={company.brand} required />
            </Field>
            <Field label="CNPJ" htmlFor="co-cnpj" error={fieldError(state, "cnpj")}>
              <Input id="co-cnpj" name="cnpj" defaultValue={company.cnpj} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Endereço" htmlFor="co-address" error={fieldError(state, "address")} className="sm:col-span-2">
              <Input id="co-address" name="address" defaultValue={company.address} />
            </Field>
            <Field label="E-mail de contato" htmlFor="co-email" error={fieldError(state, "email")} hint="Aparece no rodapé e recebe pedidos quando não há WhatsApp.">
              <Input id="co-email" name="email" type="email" defaultValue={company.email} />
            </Field>
            <Field label="E-mail do financeiro" htmlFor="co-fin" error={fieldError(state, "financeEmail")} hint="Vai nas propostas, para notas e pagamentos.">
              <Input id="co-fin" name="financeEmail" type="email" defaultValue={company.financeEmail} />
            </Field>
            <Field label="Telefone" htmlFor="co-phone" error={fieldError(state, "phone")}>
              <Input id="co-phone" name="phone" inputMode="tel" defaultValue={company.phone} placeholder="(84) 3000-0000" />
            </Field>
            <Field label="Instagram" htmlFor="co-ig" error={fieldError(state, "instagram")}>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-mute">@</span>
                <Input id="co-ig" name="instagram" defaultValue={company.instagram} className="pl-8" placeholder="zrofilmes" />
              </div>
            </Field>
            <Field label="Site" htmlFor="co-site" error={fieldError(state, "website")} className="sm:col-span-2">
              <Input id="co-site" name="website" inputMode="url" defaultValue={company.website} placeholder="zrofilmes.com.br" />
            </Field>
          </div>
          <SaveRow note="Vale para o rodapé do site, a página de privacidade e as propostas." />
        </>
      )}
    </StableForm>
  );
}

/* ============================== Impostos ============================== */

export function TaxesForm({ rate }: { rate: number }) {
  return (
    <StableForm action={saveTaxes} resetOnSuccess className="grid gap-4 p-5 sm:p-6">
      {(state) => (
        <>
          <Field
            label="Alíquota efetiva estimada"
            htmlFor="tax-rate"
            error={fieldError(state, "rate")}
            hint="Simples Nacional. Confirme com o contador: ela muda com o faturamento dos últimos 12 meses."
          >
            <div className="relative max-w-40">
              <Input
                id="tax-rate"
                name="rate"
                inputMode="decimal"
                defaultValue={String(rate).replace(".", ",")}
                className="pr-9 tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[15px] text-mute">%</span>
            </div>
          </Field>
          <SaveRow note="Usada nos orçamentos novos e na estimativa de imposto do financeiro." />
        </>
      )}
    </StableForm>
  );
}

/* ============================== Orçamentos ============================== */

export function QuoteDefaultsForm({ quote }: { quote: QuoteSettings }) {
  return (
    <StableForm action={saveQuoteDefaults} resetOnSuccess className="grid gap-4 p-5 sm:p-6">
      {(state) => (
        <>
          <Field label="Validade padrão" htmlFor="q-days" error={fieldError(state, "validityDays")}>
            <div className="relative max-w-40">
              <Input id="q-days" name="validityDays" inputMode="numeric" defaultValue={String(quote.validityDays)} className="pr-14 tabular-nums" />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[15px] text-mute">dias</span>
            </div>
          </Field>
          <Field label="Forma de pagamento padrão" htmlFor="q-terms" error={fieldError(state, "paymentTerms")}>
            <Textarea id="q-terms" name="paymentTerms" rows={2} defaultValue={quote.paymentTerms} maxLength={300} />
          </Field>
          <Field
            label="Condições"
            htmlFor="q-conditions"
            error={fieldError(state, "conditions")}
            hint="Uma por linha. Entram em todo orçamento novo e podem ser ajustadas em cada um."
          >
            <Textarea id="q-conditions" name="conditions" rows={10} defaultValue={quote.conditions.join("\n")} />
          </Field>
          <SaveRow note="Não muda orçamentos que já existem." />
        </>
      )}
    </StableForm>
  );
}

/* ============================== Dados de exemplo ============================== */

export function DeleteDemoButton({ total }: { total: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toUpperCase() === "APAGAR";
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTyped("");
      }}
    >
      <ModalTrigger asChild>
        <Button variant="danger">
          <Trash2 /> Apagar dados de exemplo
        </Button>
      </ModalTrigger>
      <ModalContent
        title="Apagar os dados de exemplo?"
        description={`${total} registros de exemplo saem de vez: projetos, leads, clientes, freelas, orçamentos e lançamentos com id “demo-”. Não dá para desfazer.`}
        size="sm"
      >
        <StableForm action={deleteDemoData} onSuccess={() => setOpen(false)} className="grid gap-5">
          {(state) => (
            <>
              <p className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/[0.06] px-3.5 py-3 text-[13px] text-light">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                O que vocês criaram de verdade fica. Mas o que estiver pendurado num exemplo (uma tarefa num projeto de
                exemplo, por exemplo) sai junto.
              </p>
              <Field
                label={
                  <>
                    Para confirmar, digite <span className="font-mono text-white">APAGAR</span>
                  </>
                }
                htmlFor="demo-confirm"
                error={fieldError(state, "confirm")}
              >
                <Input
                  id="demo-confirm"
                  name="confirm"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <DemoSubmit ready={ready} />
              </div>
            </>
          )}
        </StableForm>
      </ModalContent>
    </Modal>
  );
}

/** Só libera o botão depois de digitar APAGAR (o servidor confere de novo). */
function DemoSubmit({ ready }: { ready: boolean }) {
  return (
    <StableSubmit variant="danger" pendingLabel="Apagando…" disabled={!ready}>
      Apagar de vez
    </StableSubmit>
  );
}
