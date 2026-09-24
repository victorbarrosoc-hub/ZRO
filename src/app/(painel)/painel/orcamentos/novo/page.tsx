import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { InfoList, LeadStageBadge } from "@/components/painel/bits";
import { Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
  optionLabel,
} from "@/lib/domain";
import { addDaysISO, dateBR, todayISO } from "@/lib/format";
import { getClientForQuote, getLeadForQuote, getQuoteFormOptions, lastCategoryForClient, nextQuoteNumber } from "@/lib/queries/quotes";
import { categoryFromProjectType, projectTypeTitle, suggestedTitle } from "@/lib/services/quotes";
import { getSetting } from "@/lib/settings";
import { NewQuoteForm } from "./new-quote-form";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NovoOrcamentoPage({ searchParams }: PageProps<"/painel/orcamentos/novo">) {
  await requireUser();
  const sp = await searchParams;
  const leadId = typeof sp.lead === "string" ? sp.lead : undefined;
  const clienteId = typeof sp.cliente === "string" ? sp.cliente : undefined;
  const today = todayISO();

  const [options, lead, client, quoteSettings, taxes, number] = await Promise.all([
    getQuoteFormOptions(),
    leadId ? getLeadForQuote(leadId) : null,
    clienteId ? getClientForQuote(clienteId) : null,
    getSetting("quote"),
    getSetting("taxes"),
    nextQuoteNumber(today.slice(0, 4)),
  ]);
  const clientCategory = client ? await lastCategoryForClient(client.id) : null;

  const category = lead ? categoryFromProjectType(lead.projectType) : (clientCategory ?? "filme-de-marca");
  const defaults = lead
    ? {
        clientId: lead.clientId ?? "",
        title: suggestedTitle(lead.company || lead.name, projectTypeTitle(lead.projectType)),
        category,
      }
    : client
      ? { clientId: client.id, title: suggestedTitle(client.name, projectTypeTitle(category)), category }
      : { clientId: "", title: "", category };

  const validityDays = Math.max(1, Number(quoteSettings.validityDays) || 15);
  const videos = [
    lead?.videos ? optionLabel(FUNNEL_VIDEOS, lead.videos) : null,
    lead?.format ? optionLabel(FUNNEL_FORMATS, lead.format).toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-8">
      <Link href="/painel/orcamentos" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Orçamentos
      </Link>

      <PageHeader
        label="Novo orçamento"
        title={lead ? `Orçamento para ${lead.company || lead.name}` : "Comece pelo básico"}
        description="Três campos e pronto. Itens, escopo e condições você ajusta na tela seguinte."
      />

      {leadId && !lead ? (
        <p className="rounded-2xl border border-warn/30 bg-warn/[0.06] px-4 py-3 text-[14px] text-warn">
          Esse lead não existe mais. Escolha o cliente abaixo.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid content-start gap-4 xl:col-span-7">
          <Card className="p-5 sm:p-6">
            <NewQuoteForm
              key={lead?.id ?? client?.id ?? "livre"}
              lead={lead ? { id: lead.id, name: lead.company || lead.name, hasClient: !!lead.clientId } : null}
              clients={options.clients}
              openLeads={options.openLeads.map((l) => ({ id: l.id, name: l.company || l.name }))}
              defaults={defaults}
            />
          </Card>
        </div>

        <div className="grid content-start gap-4 xl:col-span-5">
          {lead ? (
            <Card>
              <CardHeader
                title={lead.company || lead.name}
                description={lead.company ? `${lead.name}${lead.segment ? ` · ${lead.segment}` : ""}` : (lead.segment ?? undefined)}
                action={<LeadStageBadge stage={lead.stage} />}
              />
              <div className="px-5 pb-2 sm:px-6">
                <InfoList
                  items={[
                    { label: "Projeto", value: optionLabel(FUNNEL_PROJECT_TYPES, lead.projectType) },
                    { label: "Quando e onde", value: [lead.timing, lead.city].filter(Boolean).join(", ") || null },
                    { label: "Diárias", value: lead.days ? optionLabel(FUNNEL_DAYS, lead.days) : null },
                    { label: "Vídeos", value: videos || null },
                    {
                      label: "Extras",
                      value: lead.extras?.length ? lead.extras.map((e) => optionLabel(FUNNEL_EXTRAS, e)).join(", ") : null,
                    },
                    { label: "Investimento", value: lead.budget ? optionLabel(FUNNEL_BUDGETS, lead.budget) : null },
                  ]}
                />
              </div>
              {lead.idea ? (
                <div className="border-t border-line px-5 py-4 sm:px-6">
                  <p className="label mb-1.5 text-mute">Ideia</p>
                  <p className="text-[14px] whitespace-pre-line text-ash">{lead.idea}</p>
                </div>
              ) : null}
              <div className="border-t border-line px-5 py-4 text-[13px] text-mute sm:px-6">
                As respostas do funil entram como ponto de partida do escopo. A faixa de investimento fica só nas notas internas.
                <Link
                  href={`/painel/crm/${lead.id}`}
                  className="mt-2 flex w-fit items-center gap-1 text-ash hover:text-white"
                >
                  Abrir o lead no CRM <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Já vem preenchido" description="Tudo editável depois, no orçamento." />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={[
                  { label: "Número", value: <span className="font-mono text-[13px]">{number} v1</span> },
                  { label: "Emissão", value: dateBR(today) },
                  { label: "Validade", value: `${validityDays} dias (até ${dateBR(addDaysISO(today, validityDays))})` },
                  { label: "Condições", value: `${quoteSettings.conditions.length} padrão da ZRO` },
                  { label: "Imposto estimado", value: `${String(taxes.rate).replace(".", ",")}%` },
                ]}
              />
            </div>
            <p className="border-t border-line px-5 py-4 text-[13px] text-mute sm:px-6">
              Forma de pagamento: {quoteSettings.paymentTerms}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
