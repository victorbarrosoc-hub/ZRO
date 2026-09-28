"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2, Download, Eye, FilePlus2, Send, Trash2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EntryStatusBadge, LeadStageBadge, QuoteStatusBadge } from "@/components/painel/bits";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/surface";
import { CATEGORIES, QUOTE_STATUS } from "@/lib/domain";
import { brl, centsToInput, dateBR, entryStatus, parseBRL, todayISO } from "@/lib/format";
import type { CatalogOption } from "@/lib/queries/quotes";
import {
  MARGIN_MIN,
  marginHealth,
  percentLabel,
  quoteCode,
  quoteTotals,
  validityInfo,
  type MarginHealth,
} from "@/lib/services/quotes";
import { cn } from "@/lib/utils";
import { deleteQuote, markQuoteSent, newQuoteVersion, revertQuoteToDraft, saveQuote } from "../actions";
import { draftNumbers, serializeItems, toDraft, type DraftItem } from "./draft";
import { ItemsEditor } from "./items-editor";
import { ApproveDialog, ConfirmDialog, RefuseDialog } from "./quote-dialogs";

export type EditorQuote = {
  id: string;
  number: string;
  version: number;
  status: string;
  effectiveStatus: string;
  title: string;
  clientId: string | null;
  leadId: string | null;
  category: string;
  issueDate: string;
  validUntil: string | null;
  period: string | null;
  scope: string | null;
  paymentTerms: string | null;
  conditions: string | null;
  discount: number;
  taxRate: number;
  internalNotes: string | null;
  sentAt: string | null;
  decidedAt: string | null;
};

export type EditorItem = Parameters<typeof toDraft>[0];

type Props = {
  quote: EditorQuote;
  items: EditorItem[];
  clients: { id: string; name: string }[];
  catalog: CatalogOption[];
  lead: { id: string; label: string; stage: string } | null;
  client: { id: string; name: string } | null;
  project: { id: string; code: string; title: string } | null;
  versions: { id: string; version: number; status: string }[];
  entries: { id: string; description: string; installment: string | null; amount: number; paidAmount: number; dueDate: string }[];
  defaults: { paymentTerms: string; conditions: string };
  otherOpenForLead: number;
  today: string;
};

/** 6 → "6"; 6.5 → "6,5" */
function rateText(rate: number) {
  return String(Math.round(rate * 100) / 100).replace(".", ",");
}

function parseRate(text: string) {
  const n = Number(text.replace(/\s|%/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Timestamp (ISO) → "24/09/2026" no fuso de Natal. */
function dayOf(iso: string | null) {
  return iso ? dateBR(todayISO(new Date(iso))) : "—";
}

export function QuoteEditor(props: Props) {
  const { quote, clients, catalog, lead, client, project, versions, entries, defaults, today } = props;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const editable = quote.status === "rascunho";

  const [items, setItems] = useState<DraftItem[]>(() => props.items.map(toDraft));
  const [discount, setDiscount] = useState(quote.discount ? centsToInput(quote.discount) : "");
  const [taxRate, setTaxRate] = useState(rateText(quote.taxRate));
  const [paymentTerms, setPaymentTerms] = useState(quote.paymentTerms ?? "");
  const [conditions, setConditions] = useState(quote.conditions ?? "");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, startSaving] = useTransition();

  const totals = quoteTotals(items.map(draftNumbers), parseBRL(discount) ?? 0, parseRate(taxRate));
  const health = marginHealth(totals);
  const err = (name: string) => errors[name]?.[0];

  const save = useCallback(async () => {
    const form = formRef.current;
    if (!form) return false;
    let result: Awaited<ReturnType<typeof saveQuote>>;
    try {
      result = await saveQuote(null, new FormData(form));
    } catch {
      toast.error("Não foi possível salvar agora. Suas alterações continuam aqui: tente de novo.");
      return false;
    }
    if (result.ok) {
      setDirty(false);
      setErrors({});
      toast.success(result.message ?? "Orçamento salvo.");
      return true;
    }
    setErrors(result.fieldErrors ?? {});
    toast.error(result.error);
    return false;
  }, []);

  /** Antes de mudar o status, grava o que estiver pendente. */
  const before = useCallback(async () => (dirty ? save() : true), [dirty, save]);

  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // Ctrl/Cmd + S salva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function changeItems(next: DraftItem[]) {
    setItems(next);
    setDirty(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSaving(async () => {
      await save();
    });
  }

  /** Links que mostram o que está salvo: com alteração pendente, salva e depois abre. */
  function saveThen(e: React.MouseEvent, go: () => void) {
    if (!dirty) return;
    e.preventDefault();
    startSaving(async () => {
      if (await save()) go();
    });
  }

  const fields = (extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("id", quote.id);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  };

  const code = quoteCode(quote.number, quote.version);
  const timbradoHref = `/painel/orcamentos/${quote.id}/timbrado`;
  const pdfHref = `/painel/orcamentos/${quote.id}/pdf`;
  const validity = validityInfo(quote.validUntil, today, quote.status);
  const who = client?.name ?? lead?.label ?? "o cliente";
  const s = quote.effectiveStatus;

  return (
    <div className="grid gap-8">
      {/* ---------------- Cabeçalho ---------------- */}
      <header className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
          <div className="min-w-0 max-w-3xl">
            <p className="label text-mute">Orçamento {code}</p>
            <h1 className="mt-3 text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
              {quote.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ash">
              <QuoteStatusBadge status={s} />
              {client ? (
                <Link href={`/painel/crm/clientes/${client.id}`} className="inline-flex items-center gap-1 hover:text-white">
                  Cliente: {client.name} <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
              {lead ? (
                <Link href={`/painel/crm/${lead.id}`} className="inline-flex items-center gap-2 hover:text-white">
                  Lead: {lead.label} <LeadStageBadge stage={lead.stage} />
                </Link>
              ) : null}
              {project ? (
                <Link href={`/painel/projetos/${project.id}`} className="inline-flex items-center gap-1 hover:text-white">
                  Projeto <span className="font-mono text-[12px]">{project.code}</span> <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={timbradoHref} variant="secondary" size="sm" onClick={(e) => saveThen(e, () => router.push(timbradoHref))}>
              <Eye /> Ver timbrado
            </ButtonLink>
            <a
              href={pdfHref}
              download
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              onClick={(e) => saveThen(e, () => downloadFile(pdfHref))}
            >
              <Download /> Baixar PDF
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
          {s === "rascunho" ? (
            <>
              <ConfirmDialog
                title="Marcar como enviado?"
                description={`Registra o envio de hoje para ${who}.`}
                note={
                  <>
                    Depois de enviado, os valores e textos ficam travados (dá para voltar para rascunho).
                    {lead && (lead.stage === "novo" || lead.stage === "conversa") ? " O lead vai para Orçamento enviado." : ""}
                  </>
                }
                confirmLabel="Marcar como enviado"
                action={() => markQuoteSent(null, fields())}
                before={before}
                trigger={
                  <Button variant="primary" size="sm">
                    <Send /> Marcar como enviado
                  </Button>
                }
              />
            </>
          ) : null}

          {/* Uma instância só: continua montada quando o status vira "aprovado", para mostrar o resultado. */}
          <ApproveDialog
            quoteId={quote.id}
            total={totals.total}
            today={today}
            clientLabel={who}
            hasLead={!!lead}
            before={before}
            trigger={
              s === "rascunho" || s === "enviado" || s === "expirado" ? (
                <Button variant={s === "rascunho" ? "secondary" : "primary"} size="sm" disabled={totals.total <= 0}>
                  <CheckCircle2 /> Aprovar
                </Button>
              ) : null
            }
          />

          {s === "rascunho" ? (
            <>
              <ConfirmDialog
                title={`Excluir o rascunho ${code}?`}
                description="O orçamento e os itens são apagados. Não dá para desfazer."
                confirmLabel="Excluir"
                destructive
                action={() => deleteQuote(null, fields())}
                trigger={
                  <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger">
                    <Trash2 /> Excluir
                  </Button>
                }
              />
            </>
          ) : null}

          {s === "enviado" || s === "expirado" ? (
            <>
              <RefuseDialog
                quoteId={quote.id}
                hasLead={!!lead}
                otherOpen={props.otherOpenForLead}
                before={before}
                trigger={
                  <Button variant="secondary" size="sm">
                    <XCircle /> Recusar
                  </Button>
                }
              />
              <ConfirmDialog
                title={`Criar a versão ${versions.length ? Math.max(...versions.map((v) => v.version)) + 1 : quote.version + 1}?`}
                description="Um rascunho novo, com os mesmos itens e textos. Esta versão continua guardada."
                note="Datas de emissão e validade recomeçam hoje."
                confirmLabel="Criar nova versão"
                action={() => newQuoteVersion(null, fields())}
                before={before}
                trigger={
                  <Button variant="secondary" size="sm">
                    <FilePlus2 /> Nova versão
                  </Button>
                }
              />
              <ConfirmDialog
                title="Voltar para rascunho?"
                description="Destrava a edição. Use se o envio foi marcado por engano."
                confirmLabel="Voltar para rascunho"
                action={() => revertQuoteToDraft(null, fields())}
                before={before}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Undo2 /> Voltar para rascunho
                  </Button>
                }
              />
            </>
          ) : null}

          {s === "recusado" ? (
            <ConfirmDialog
              title="Criar uma nova versão?"
              description="Um rascunho novo, com os mesmos itens e textos, para tentar de novo."
              confirmLabel="Criar nova versão"
              action={() => newQuoteVersion(null, fields())}
              before={before}
              trigger={
                <Button variant="primary" size="sm">
                  <FilePlus2 /> Nova versão
                </Button>
              }
            />
          ) : null}

          {s === "aprovado" && project ? (
            <ButtonLink href={`/painel/projetos/${project.id}`} variant="primary" size="sm">
              Abrir projeto <ArrowUpRight />
            </ButtonLink>
          ) : null}

          {versions.length > 1 ? (
            <nav aria-label="Versões" className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="label mr-1 text-mute">Versões</span>
              {versions.map((v) => (
                <Link
                  key={v.id}
                  href={`/painel/orcamentos/${v.id}`}
                  aria-current={v.id === quote.id ? "page" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border px-2.5 font-mono text-[12px] transition-colors",
                    v.id === quote.id ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
                  )}
                  title={QUOTE_STATUS.find((q) => q.key === v.status)?.label ?? v.status}
                >
                  v{v.version}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <StatusNote quote={quote} project={project} validityLabel={validity?.tone ? validity.label : null} />
      </header>

      {/* ---------------- Formulário ---------------- */}
      <form id="quote-form" ref={formRef} onSubmit={onSubmit} onChange={() => setDirty(true)} noValidate className="grid gap-4 xl:grid-cols-12">
        <input type="hidden" name="id" value={quote.id} />
        <input type="hidden" name="items" value={JSON.stringify(serializeItems(items))} />

        <div className="grid content-start gap-4 xl:col-span-8">
          <Card className="p-5 sm:p-6">
            <SectionTitle title="Dados do orçamento" />
            <div className="mt-5 grid grid-cols-2 items-start gap-4 lg:grid-cols-6">
              <Field label="Título" htmlFor="q-title" className="col-span-2 lg:col-span-6" error={err("title")}>
                <Input id="q-title" name="title" defaultValue={quote.title} disabled={!editable} maxLength={160} />
              </Field>
              <Field
                label="Cliente"
                htmlFor="q-client"
                className="col-span-2 sm:col-span-1 lg:col-span-3"
                error={err("clientId")}
                hint={!quote.clientId && lead ? "Sem cliente: ao aprovar, ele é cadastrado com os dados do lead." : undefined}
              >
                <Select id="q-client" name="clientId" defaultValue={quote.clientId ?? ""} disabled={!editable}>
                  {lead ? <option value="">Pelo lead ({lead.label})</option> : <option value="">Escolha…</option>}
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Categoria" htmlFor="q-cat" className="col-span-2 sm:col-span-1 lg:col-span-3" error={err("category")}>
                <Select id="q-cat" name="category" defaultValue={quote.category} disabled={!editable}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.short}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Emissão" htmlFor="q-issue" className="min-w-0 lg:col-span-2" error={err("issueDate")}>
                <Input id="q-issue" name="issueDate" type="date" defaultValue={quote.issueDate} disabled={!editable} className="min-w-0 px-3" />
              </Field>
              <Field
                label="Validade"
                htmlFor="q-valid"
                className="min-w-0 lg:col-span-2"
                error={err("validUntil")}
                hint={validity ? (validity.tone ? validity.label : `Vence ${validity.label}`) : undefined}
              >
                <Input id="q-valid" name="validUntil" type="date" defaultValue={quote.validUntil ?? ""} disabled={!editable} className="min-w-0 px-3" />
              </Field>
              <Field label="Período (cronograma)" htmlFor="q-period" className="col-span-2 lg:col-span-2" error={err("period")}>
                <Input id="q-period" name="period" defaultValue={quote.period ?? ""} placeholder="Ex.: novembro de 2026" disabled={!editable} maxLength={200} />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle title="Notas internas" description="Só vocês veem. Não saem no timbrado." />
            <Textarea
              name="internalNotes"
              aria-label="Notas internas"
              rows={3}
              defaultValue={quote.internalNotes ?? ""}
              className="mt-4 min-h-20"
              maxLength={4000}
            />
            {!editable ? <p className="mt-2 text-[12px] text-mute">Continuam editáveis depois do envio.</p> : null}
          </Card>
        </div>

        <div className="grid content-start gap-4 xl:col-span-4">
          <Card className="p-5 sm:p-6">
            <SectionTitle title="Totais" />
            <dl className="mt-5 grid gap-3 text-[14px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ash">Subtotal</dt>
                <dd className="text-light tabular-nums">{brl(totals.subtotal)}</dd>
              </div>
              <div className="grid grid-cols-[1fr_minmax(0,160px)] items-center gap-x-3 gap-y-1.5">
                <dt>
                  <label htmlFor="q-discount" className="text-ash">
                    Desconto
                  </label>
                </dt>
                <dd>
                  <MoneyInput
                    id="q-discount"
                    name="discount"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    onBlur={(e) => {
                      const c = parseBRL(e.target.value);
                      setDiscount(c ? centsToInput(c) : "");
                    }}
                    placeholder="0,00"
                    disabled={!editable}
                    aria-invalid={err("discount") ? true : undefined}
                    className="h-10 pr-3 pl-9 text-right text-[14px]"
                  />
                </dd>
                {err("discount") ? <dd className="col-span-2 text-[13px] text-danger">{err("discount")}</dd> : null}
              </div>
              <div className="mt-1 grid gap-1.5 border-t border-line pt-4">
                <div className="flex items-end justify-between gap-4">
                  <dt className="pb-1 text-ash">Total</dt>
                  <dd className="text-[clamp(26px,2.4vw,34px)] leading-none font-semibold tracking-[-0.03em] text-white">{brl(totals.total)}</dd>
                </div>
                <dd className="text-right text-[12px] text-mute">É o valor que o cliente vê.</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl border border-line bg-white/[0.02] p-4">
              <p className="label text-mute">Conta interna · só vocês veem</p>
              <dl className="mt-4 grid gap-3 text-[14px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ash">Custo estimado</dt>
                  <dd className="text-light tabular-nums">{brl(totals.cost)}</dd>
                </div>
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-ash">
                      <label htmlFor="q-tax">Imposto</label>
                      <span className="relative">
                        <input
                          id="q-tax"
                          name="taxRate"
                          inputMode="decimal"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          disabled={!editable}
                          aria-describedby="q-tax-hint"
                          className="h-8 w-16 rounded-lg border border-line-strong bg-white/[0.03] pr-6 pl-2.5 text-right text-[13px] text-light tabular-nums focus:border-white/50 focus:outline-none disabled:opacity-50"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[12px] text-mute">%</span>
                      </span>
                    </dt>
                    <dd className="text-light tabular-nums">{brl(totals.tax)}</dd>
                  </div>
                  <dd id="q-tax-hint" className="text-[12px] text-mute">
                    Alíquota estimada sobre o total.
                  </dd>
                  {err("taxRate") ? <dd className="text-[13px] text-danger">{err("taxRate")}</dd> : null}
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-ash">Margem</dt>
                  <dd className={cn("font-medium tabular-nums", toneText(health))}>
                    {brl(totals.margin)} <span className="text-[13px] font-normal">· {percentLabel(totals.marginPct)}</span>
                  </dd>
                </div>
              </dl>
              <MarginMeter pct={totals.marginPct} health={health} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={health.tone === "neutral" ? "neutral" : health.tone} dot>
                  {health.label}
                </Badge>
                <span className="text-[12px] text-mute">Saudável a partir de {percentLabel(MARGIN_MIN)}</span>
              </div>
              {health.hint ? <p className="mt-2 text-[12px] text-mute">{health.hint}</p> : null}
            </div>
          </Card>

          {project || entries.length ? (
            <Card className="p-5 sm:p-6">
              <SectionTitle title="Projeto e recebimentos" />
              {project ? (
                <Link
                  href={`/painel/projetos/${project.id}`}
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 hover:border-white/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-light">{project.title}</span>
                    <span className="font-mono text-[11px] text-mute">{project.code}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-mute" />
                </Link>
              ) : null}
              {entries.length ? (
                <ul className="mt-3 grid gap-1">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                      <span className="min-w-0">
                        <span className="block truncate text-ash">{e.description}</span>
                        <span className="text-[12px] text-mute">
                          {e.installment ? `${e.installment} · ` : ""}vence {dateBR(e.dueDate)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-light tabular-nums">{brl(e.amount)}</span>
                        <EntryStatusBadge status={entryStatus(e, today)} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link href="/painel/financeiro" className="mt-3 inline-flex items-center gap-1 text-[13px] text-ash hover:text-white">
                Ver no financeiro <ArrowUpRight className="size-3.5" />
              </Link>
            </Card>
          ) : null}
        </div>

        <Card className="p-5 sm:p-6 xl:col-span-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle
              title="Itens"
              description="O valor unitário é o que o cliente vê. O custo é interno e nunca sai no timbrado."
            />
            <p className="text-right text-[13px] text-mute">
              {items.length} {items.length === 1 ? "item" : "itens"} · subtotal{" "}
              <span className="text-[15px] text-light tabular-nums">{brl(totals.subtotal)}</span>
            </p>
          </div>
          <ItemsEditor items={items} onChange={changeItems} catalog={catalog} disabled={!editable} error={err("items")} />
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-12">
          <SectionTitle title="Textos da proposta" description="Saem no timbrado do jeito que estiverem aqui." />
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <Field label="Escopo" htmlFor="q-scope" hint="O que está incluso. Uma linha por tópico, se quiser." error={err("scope")}>
              <Textarea id="q-scope" name="scope" rows={11} defaultValue={quote.scope ?? ""} disabled={!editable} />
            </Field>
            <div className="grid gap-5">
              <Field
                label={
                  <span className="flex items-center justify-between gap-3">
                    Forma de pagamento
                    {editable && paymentTerms.trim() !== defaults.paymentTerms.trim() ? (
                      <UseDefault
                        onClick={() => {
                          setPaymentTerms(defaults.paymentTerms);
                          setDirty(true);
                        }}
                      />
                    ) : null}
                  </span>
                }
                htmlFor="q-pay"
                error={err("paymentTerms")}
              >
                <Textarea
                  id="q-pay"
                  name="paymentTerms"
                  rows={2}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={!editable}
                  className="min-h-16"
                />
              </Field>
              <Field
                label={
                  <span className="flex items-center justify-between gap-3">
                    Condições
                    {editable && conditions.trim() !== defaults.conditions.trim() ? (
                      <UseDefault
                        onClick={() => {
                          setConditions(defaults.conditions);
                          setDirty(true);
                        }}
                      />
                    ) : null}
                  </span>
                }
                htmlFor="q-cond"
                hint="Uma por linha. O padrão vem dos Ajustes."
                error={err("conditions")}
              >
                <Textarea
                  id="q-cond"
                  name="conditions"
                  rows={8}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  disabled={!editable}
                />
              </Field>
            </div>
          </div>
        </Card>
      </form>

      {/* ---------------- Barra de salvar ---------------- */}
      <div className="sticky bottom-3 z-30 -mt-4">
        <div className="flex items-center gap-3 rounded-full border border-line-strong bg-graphite/90 py-2 pr-2 pl-4 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl">
          <span className="flex min-w-0 items-center gap-2 text-[13px]" aria-live="polite">
            <span className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-warn" : "bg-white/25")} aria-hidden />
            <span className={cn("truncate", dirty ? "text-light" : "text-mute")}>
              <span className="sm:hidden">{saving ? "Salvando…" : dirty ? "Não salvo" : "Salvo"}</span>
              <span className="hidden sm:inline">
                {saving ? "Salvando…" : dirty ? "Alterações não salvas" : editable ? "Tudo salvo" : "Só as notas internas são editáveis"}
              </span>
            </span>
          </span>
          <span className="ml-auto flex items-baseline gap-2 text-[13px] text-mute">
            <span className="hidden sm:inline">Total</span>
            <span className="text-[16px] font-medium text-white tabular-nums">{brl(totals.total)}</span>
          </span>
          <span className={cn("hidden text-[13px] md:inline", toneText(health))}>Margem {percentLabel(totals.marginPct)}</span>
          <Button type="submit" form="quote-form" variant="primary" disabled={saving} className="sm:ml-2">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Baixa um arquivo (o PDF vem como anexo, então a página não muda). */
function downloadFile(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-[15px] font-medium tracking-[-0.01em] text-light">{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-mute">{description}</p> : null}
    </div>
  );
}

function UseDefault({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[12px] font-normal text-mute underline decoration-white/20 underline-offset-4 hover:text-light">
      Usar o padrão
    </button>
  );
}

function toneText(h: MarginHealth) {
  return h.tone === "danger" ? "text-danger" : h.tone === "warn" ? "text-warn" : h.tone === "ok" ? "text-ok" : "text-ash";
}

/** Régua da margem de 0 a 100%, com a marca dos 20%. */
function MarginMeter({ pct, health }: { pct: number | null; health: MarginHealth }) {
  const width = pct == null ? 0 : Math.max(0, Math.min(1, pct)) * 100;
  const color = health.tone === "danger" ? "bg-danger" : health.tone === "warn" ? "bg-warn" : health.tone === "ok" ? "bg-ok" : "bg-white/20";
  return (
    <div className="relative mt-4 h-1.5 rounded-full bg-white/[0.07]" aria-hidden>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out-expo", color)} style={{ width: `${width}%` }} />
      <span className="absolute -top-1 h-3.5 w-px bg-white/40" style={{ left: `${MARGIN_MIN * 100}%` }} />
    </div>
  );
}

function StatusNote({
  quote,
  project,
  validityLabel,
}: {
  quote: EditorQuote;
  project: { code: string } | null;
  validityLabel: string | null;
}) {
  const s = quote.effectiveStatus;
  let text: string | null = null;
  let tone: "neutral" | "warn" | "ok" | "danger" = "neutral";
  if (s === "rascunho") {
    if (validityLabel) {
      text = `A validade ${validityLabel.toLowerCase().startsWith("venceu") ? "já passou" : "está perto"} (${validityLabel.toLowerCase()}). Ajuste a data antes de enviar.`;
      tone = "warn";
    }
  } else if (s === "enviado") {
    text = `Enviado em ${dayOf(quote.sentAt)}${validityLabel ? ` · ${validityLabel.toLowerCase()}` : ""}. O que o cliente recebeu fica travado: para mudar valores ou textos, crie uma nova versão.`;
    tone = validityLabel ? "warn" : "neutral";
  } else if (s === "expirado") {
    text = `A validade venceu em ${dateBR(quote.validUntil)} sem resposta. Crie uma nova versão com datas novas, aprove ou recuse.`;
    tone = "warn";
  } else if (s === "aprovado") {
    text = `Aprovado em ${dayOf(quote.decidedAt)}.${project ? ` Virou o projeto ${project.code}.` : ""}`;
    tone = "ok";
  } else if (s === "recusado") {
    text = `Recusado em ${dayOf(quote.decidedAt)}. Para tentar de novo, crie uma nova versão.`;
    tone = "danger";
  }
  if (!text) return null;
  return (
    <p
      className={cn(
        "rounded-2xl border px-4 py-3 text-[14px]",
        tone === "warn" && "border-warn/30 bg-warn/[0.06] text-warn",
        tone === "ok" && "border-ok/30 bg-ok/[0.06] text-ok",
        tone === "danger" && "border-danger/30 bg-danger/[0.06] text-danger",
        tone === "neutral" && "border-line bg-white/[0.02] text-ash",
      )}
    >
      {text}
    </p>
  );
}
