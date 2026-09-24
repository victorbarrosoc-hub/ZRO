import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, FileText, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { InfoList, LeadStageBadge, whatsappHref } from "@/components/painel/bits";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
  LEAD_SOURCES,
  optionLabel,
} from "@/lib/domain";
import { brl, dateBR, dateTimeBR, relativeDay, todayISO } from "@/lib/format";
import { getLead, listClientOptions } from "@/lib/queries/crm";
import {
  ActivityForm,
  ConvertLeadButton,
  DeleteLeadButton,
  EditLeadButton,
  EditLeadControlButton,
  LeadStageControl,
} from "../crm-dialogs";
import { followUpDue, sinceLabel } from "../crm-options";
import { ActivityTimeline, Answer, ProjectList, QuoteList } from "../crm-ui";

export async function generateMetadata({ params }: PageProps<"/painel/crm/[id]">): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLead(id);
  return { title: lead ? lead.company || lead.name : "Lead" };
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export default async function LeadPage({ params }: PageProps<"/painel/crm/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const today = todayISO();
  const title = lead.company || lead.name;
  const clientOptions = lead.client ? [] : await listClientOptions();
  const suggestedClientId = clientOptions.find((c) => normalize(c.name) === normalize(title))?.id ?? null;
  const due = followUpDue(lead, today);
  const fromSite = lead.source === "site";

  const firstName = lead.name.split(/\s+/)[0];
  const me = user.name.split(/\s+/)[0];
  const wa = whatsappHref(
    lead.phone,
    fromSite
      ? `Oi, ${firstName}! Aqui é o ${me}, da ZRO. Recebi seu pedido pelo site…`
      : `Oi, ${firstName}! Aqui é o ${me}, da ZRO. Tudo bem?`,
  );

  const extras = lead.extras ?? [];
  const hasBrief = Boolean(
    lead.idea ||
    lead.projectType ||
    lead.budget ||
    lead.timing ||
    lead.city ||
    lead.days ||
    lead.videos ||
    lead.format ||
    extras.length,
  );

  const defaults = {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    segment: lead.segment,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    projectType: lead.projectType,
    budget: lead.budget,
    idea: lead.idea,
    timing: lead.timing,
    city: lead.city,
    days: lead.days,
    videos: lead.videos,
    format: lead.format,
    extras,
    estimatedValue: lead.estimatedValue,
    followUpAt: lead.followUpAt,
    notes: lead.notes,
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <Link href="/painel/crm" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> CRM
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">{title}</h1>
          <p className="mt-2 text-[14px] text-ash">
            {[lead.company ? lead.name : null, lead.segment].filter(Boolean).join(" · ") || "Contato sem empresa"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <LeadStageBadge stage={lead.stage} />
            <Badge>{optionLabel(LEAD_SOURCES, lead.source)}</Badge>
            {due ? (
              <Badge tone="warn" dot>
                Retornar
              </Badge>
            ) : null}
            <span className="ml-1 text-[13px] text-mute">
              Entrou em {dateBR(todayISO(lead.createdAt))} · {sinceLabel(lead.createdAt, today)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-medium text-void hover:bg-light sm:h-8"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[13px] text-light hover:border-white/30 sm:h-8"
            >
              <Mail className="size-4" /> E-mail
            </a>
          ) : null}
          <ButtonLink href={`/painel/orcamentos/novo?lead=${lead.id}`} variant="secondary" size="sm" className="h-10 sm:h-8">
            <FileText /> Criar orçamento
          </ButtonLink>
          {lead.client ? (
            <ButtonLink href={`/painel/crm/clientes/${lead.client.id}`} variant="secondary" size="sm" className="h-10 sm:h-8">
              <Building2 /> Ver cliente
            </ButtonLink>
          ) : (
            <ConvertLeadButton
              id={lead.id}
              clients={clientOptions}
              suggestedClientId={suggestedClientId}
              prominent={lead.stage === "ganho"}
            />
          )}
          <EditLeadButton defaults={defaults} />
          <DeleteLeadButton id={lead.id} name={title} />
        </div>
      </header>

      <LeadStageControl id={lead.id} stage={lead.stage} title={title} lostReason={lead.lostReason} />

      <div className="grid gap-4 xl:grid-cols-12 xl:grid-rows-[auto_1fr] xl:items-start">
        <Card className="min-w-0 xl:col-span-8">
          <CardHeader
            title="O que o cliente contou"
            description={fromSite ? "Respostas do formulário do site." : "Anotado pela equipe."}
          />
          {hasBrief ? (
            <div className="px-5 pt-5 pb-6 sm:px-6">
              {lead.idea ? (
                <blockquote className="mb-6 border-l-2 border-white/25 pl-4 text-[16px] leading-relaxed whitespace-pre-line wrap-anywhere text-light">
                  {lead.idea}
                </blockquote>
              ) : null}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                <Answer label="Projeto">{lead.projectType ? optionLabel(FUNNEL_PROJECT_TYPES, lead.projectType) : null}</Answer>
                <Answer label="Investimento">{lead.budget ? optionLabel(FUNNEL_BUDGETS, lead.budget) : null}</Answer>
                <Answer label="Quando">{lead.timing}</Answer>
                <Answer label="Onde">{lead.city}</Answer>
                <Answer label="Diárias">{lead.days ? optionLabel(FUNNEL_DAYS, lead.days) : null}</Answer>
                <Answer label="Vídeos">{lead.videos ? optionLabel(FUNNEL_VIDEOS, lead.videos) : null}</Answer>
                <Answer label="Formato" className="col-span-2">
                  {lead.format ? optionLabel(FUNNEL_FORMATS, lead.format) : null}
                </Answer>
                <Answer label="Extras" className="col-span-2 md:col-span-4">
                  {extras.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {extras.map((e) => (
                        <Badge key={e}>{optionLabel(FUNNEL_EXTRAS, e)}</Badge>
                      ))}
                    </span>
                  ) : null}
                </Answer>
              </dl>
            </div>
          ) : (
            <p className="px-5 pt-4 pb-6 text-[14px] text-mute sm:px-6">
              Nada registrado ainda. Use Editar para anotar o tipo de projeto, a ideia e o investimento.
            </p>
          )}
        </Card>

        <aside className="grid min-w-0 grid-cols-1 content-start gap-4 xl:col-span-4 xl:row-span-2">
          <Card>
            <CardHeader title="Controle" action={<EditLeadControlButton defaults={defaults} />} />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={[
                  { label: "Valor estimado", value: lead.estimatedValue ? brl(lead.estimatedValue) : null },
                  {
                    label: "Retornar em",
                    value: lead.followUpAt ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        {due ? (
                          <Badge tone="warn" dot>
                            {relativeDay(lead.followUpAt, today)}
                          </Badge>
                        ) : (
                          <span className="text-[12px] text-mute">{relativeDay(lead.followUpAt, today)}</span>
                        )}
                        {dateBR(lead.followUpAt)}
                      </span>
                    ) : null,
                  },
                ]}
              />
            </div>
            {lead.notes ? (
              <div className="border-t border-line px-5 py-5 sm:px-6">
                <p className="label mb-1.5 text-mute">Observações</p>
                <p className="text-[14px] whitespace-pre-line wrap-anywhere text-ash">{lead.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Contato" />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={[
                  { label: "Nome", value: lead.name },
                  { label: "WhatsApp", value: lead.phone },
                  { label: "E-mail", value: lead.email ? <span className="break-all">{lead.email}</span> : null },
                  {
                    label: "Cliente",
                    value: lead.client ? (
                      <Link
                        href={`/painel/crm/clientes/${lead.client.id}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {lead.client.name} <ArrowUpRight className="size-3.5 text-mute" />
                      </Link>
                    ) : (
                      <span className="text-mute">Ainda não é cliente</span>
                    ),
                  },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Orçamentos" description={lead.quotes.length ? undefined : "Nenhum orçamento para este lead."} />
            {lead.quotes.length ? (
              <div className="px-2 pt-3 pb-3 sm:px-3">
                <QuoteList quotes={lead.quotes} />
              </div>
            ) : (
              <div className="px-5 pt-3 pb-5 sm:px-6">
                <Link
                  href={`/painel/orcamentos/novo?lead=${lead.id}`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-light underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                >
                  Criar o primeiro orçamento <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            )}
          </Card>

          {lead.projects.length ? (
            <Card>
              <CardHeader title={lead.projects.length > 1 ? "Projetos" : "Projeto"} />
              <div className="px-2 pt-3 pb-3 sm:px-3">
                <ProjectList projects={lead.projects} />
              </div>
            </Card>
          ) : null}

          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-2 text-[13px] font-medium text-light">
              <ShieldCheck className="size-4 text-ash" aria-hidden /> LGPD
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              {lead.consentAt ? (
                <>
                  Consentimento dado no formulário do site em <span className="text-ash">{dateTimeBR(lead.consentAt)}</span>. Use
                  os dados só para responder e acompanhar este pedido.
                </>
              ) : (
                <>Cadastro manual: o contato não passou pelo formulário do site. Guarde só o necessário para o atendimento.</>
              )}
            </p>
          </Card>
        </aside>

        <Card className="min-w-0 xl:col-span-8">
          <CardHeader title="Histórico" description="Conversas, ligações e combinados. O mais recente primeiro." />
          <div className="px-5 pt-5 pb-6 sm:px-6">
            <ActivityForm leadId={lead.id} />
            {lead.activities.length ? (
              <div className="mt-8 border-t border-line pt-6">
                <ActivityTimeline items={lead.activities} />
              </div>
            ) : (
              <p className="mt-6 border-t border-line pt-6 text-[14px] text-mute">Nada registrado ainda.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
