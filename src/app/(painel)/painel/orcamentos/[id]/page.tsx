import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayISO } from "@/lib/format";
import { getQuote, getQuoteFormOptions, otherOpenQuotesForLead } from "@/lib/queries/quotes";
import { effectiveQuoteStatus, quoteCode } from "@/lib/services/quotes";
import { getSetting } from "@/lib/settings";
import { QuoteEditor } from "./quote-editor";

export async function generateMetadata({ params }: PageProps<"/painel/orcamentos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getQuote(id);
  return { title: data ? `Orçamento ${quoteCode(data.quote.number, data.quote.version)}` : "Orçamento" };
}

export default async function OrcamentoPage({ params }: PageProps<"/painel/orcamentos/[id]">) {
  await requireUser();
  const { id } = await params;
  const [data, options, quoteSettings] = await Promise.all([getQuote(id), getQuoteFormOptions(), getSetting("quote")]);
  if (!data) notFound();

  const today = todayISO();
  const { quote, lead, client, project } = data;
  const otherOpen = quote.leadId ? (await otherOpenQuotesForLead(quote.leadId, quote.number)).length : 0;

  return (
    <div className="grid gap-6">
      <Link href="/painel/orcamentos" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Orçamentos
      </Link>

      <QuoteEditor
        key={quote.id}
        today={today}
        quote={{
          id: quote.id,
          number: quote.number,
          version: quote.version,
          status: quote.status,
          effectiveStatus: effectiveQuoteStatus(quote, today),
          title: quote.title,
          clientId: quote.clientId,
          leadId: quote.leadId,
          category: quote.category ?? "filme-de-marca",
          issueDate: quote.issueDate,
          validUntil: quote.validUntil,
          period: quote.period,
          scope: quote.scope,
          paymentTerms: quote.paymentTerms,
          conditions: quote.conditions,
          discount: quote.discount,
          taxRate: quote.taxRate,
          internalNotes: quote.internalNotes,
          sentAt: quote.sentAt ? quote.sentAt.toISOString() : null,
          decidedAt: quote.decidedAt ? quote.decidedAt.toISOString() : null,
        }}
        items={data.items.map((it) => ({
          id: it.id,
          catalogItemId: it.catalogItemId,
          description: it.description,
          detail: it.detail,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          unitCost: it.unitCost,
        }))}
        clients={options.clients}
        catalog={options.catalog}
        lead={lead ? { id: lead.id, label: lead.company || lead.name, stage: lead.stage } : null}
        client={client ? { id: client.id, name: client.name } : null}
        project={project ? { id: project.id, code: project.code, title: project.title } : null}
        versions={data.versions.map((v) => ({ id: v.id, version: v.version, status: effectiveQuoteStatus(v, today) }))}
        entries={data.entries.map((e) => ({
          id: e.id,
          description: e.description,
          installment: e.installment,
          amount: e.amount,
          paidAmount: e.paidAmount,
          dueDate: e.dueDate,
        }))}
        defaults={{ paymentTerms: quoteSettings.paymentTerms ?? "", conditions: (quoteSettings.conditions ?? []).join("\n") }}
        otherOpenForLead={otherOpen}
      />
    </div>
  );
}
