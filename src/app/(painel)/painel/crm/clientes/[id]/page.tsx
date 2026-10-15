import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clapperboard, FileText, Mail } from "lucide-react";
import {
  TabLinks,
  EntryStatusBadge,
  InfoList,
  LeadStageBadge,
  ProjectStatusBadge,
  QuoteStatusBadge,
  StageBadge,
  Table,
  Td,
  Th,
  whatsappHref,
  WhatsAppButton,
} from "@/components/painel/bits";
import { Avatar } from "@/components/painel/avatar";
import { StatTile } from "@/components/painel/stat";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import type { ClientRecurring } from "@/lib/db/schema";
import { EVENT_TYPES, FUNNEL_PROJECT_TYPES, LEAD_SOURCES, optionLabel } from "@/lib/domain";
import { brl, dateBR, dateShort, entryStatus, formatPhone, monthLong, monthShort, todayISO } from "@/lib/format";
import { getClient, recurringMonth } from "@/lib/queries/crm";
import { cn } from "@/lib/utils";
import { ActivityForm, DeleteClientButton, EditClientButton } from "../../crm-dialogs";
import { formatDocument, sinceLabel } from "../../crm-options";
import { ActivityTimeline } from "../../crm-ui";

export async function generateMetadata({ params }: PageProps<"/painel/crm/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  return { title: client?.name ?? "Cliente" };
}

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "projetos", label: "Projetos" },
  { key: "orcamentos", label: "Orçamentos" },
  { key: "financeiro", label: "Financeiro" },
  { key: "historico", label: "Histórico" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function ClientePage({ params, searchParams }: PageProps<"/painel/crm/clientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const aba: TabKey = TABS.find((t) => t.key === sp.aba)?.key ?? "resumo";
  const c = await getClient(id);
  if (!c) notFound();
  const counts: Partial<Record<TabKey, number>> = {
    projetos: c.projects.length,
    orcamentos: c.quotes.length,
    financeiro: c.entries.length,
    historico: c.activities.length,
  };

  const today = todayISO();
  const me = user.name.split(/\s+/)[0];
  const contactFirst = c.contactName?.split(/\s+/)[0];
  const mesRec = c.recurring ? await recurringMonth(c.id, c.projects.map((p) => p.id), c.entries) : null;
  const wa = whatsappHref(c.phone, `Oi${contactFirst ? `, ${contactFirst}` : ""}! Aqui é o ${me}, da ZRO. Tudo bem?`);
  const activeProjects = c.projects.filter((p) => p.status === "ativo").length;

  return (
    <div className="grid grid-cols-1 gap-8">
      <Link href="/painel/crm/clientes" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <Avatar name={c.name} imageId={c.logoId} logo size="xl" />
          <div className="min-w-0">
            <h1 className="text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">{c.name}</h1>
            <p className="mt-2 text-[14px] text-ash">
              {[c.segment, c.city].filter(Boolean).join(" · ") || "Segmento e cidade não informados"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {c.recurring ? <Badge tone="light">Recorrente</Badge> : null}
              <Badge>{optionLabel(LEAD_SOURCES, c.source)}</Badge>
              <span className="ml-1 text-[13px] text-mute">Cliente desde {dateBR(todayISO(c.createdAt))}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WhatsAppButton href={wa} />
          {c.email ? (
            <a
              href={`mailto:${c.email}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[13px] text-light hover:border-white/30 sm:h-8"
            >
              <Mail className="size-4" /> E-mail
            </a>
          ) : null}
          <ButtonLink href={`/painel/orcamentos/novo?cliente=${c.id}`} variant="secondary" size="sm" className="h-10 sm:h-8">
            <FileText /> Novo orçamento
          </ButtonLink>
          <EditClientButton
            defaults={{
              id: c.id,
              name: c.name,
              segment: c.segment,
              city: c.city,
              document: c.document,
              contactName: c.contactName,
              email: c.email,
              phone: c.phone,
              instagram: c.instagram,
              source: c.source,
              notes: c.notes,
              logoId: c.logoId,
              recurring: c.recurring,
            }}
          />
          <DeleteClientButton id={c.id} name={c.name} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <TabLinks
          active={aba}
          tabs={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: counts[t.key],
            href: `/painel/crm/clientes/${c.id}${t.key === "resumo" ? "" : `?aba=${t.key}`}`,
          }))}
        />

        {aba === "resumo" ? (
          <div className="grid grid-cols-1 gap-4">
            {c.recurring && mesRec ? <RecurringCard r={c.recurring} mes={mesRec} /> : null}
            <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo financeiro">
              <StatTile
                label="Recebido"
                value={brl(c.received)}
                sub={c.entries.length ? undefined : "Nada lançado"}
              />
              <StatTile
                label="A receber"
                value={brl(c.toReceive)}
                sub={c.late ? `${brl(c.late)} atrasado` : c.toReceive ? "Tudo em dia" : "Nada em aberto"}
                tone={c.late ? "danger" : "default"}
              />
              <StatTile
                label="Projetos"
                value={c.projects.length}
                sub={activeProjects ? `${activeProjects} ativo${activeProjects === 1 ? "" : "s"}` : "Nenhum ativo"}
                icon={<Clapperboard />}
              />
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
              <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-7">
                <Card className="min-w-0">
                  <CardHeader title="Próximas datas" />
                  {c.upcoming.length ? (
                    <ul className="mt-3 px-3 pb-3">
                      {c.upcoming.map((ev) => (
                        <li key={ev.id}>
                          <Link
                            href={ev.projectId ? `/painel/projetos/${ev.projectId}?aba=agenda` : "/painel/agenda"}
                            className="flex items-center gap-4 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                          >
                            <span className="w-14 shrink-0 text-[13px] font-medium text-white tabular-nums">{dateShort(ev.date)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] text-light">{ev.title}</span>
                              <span className="block truncate text-[12px] text-mute">
                                {optionLabel(EVENT_TYPES, ev.type)}
                                {ev.startTime ? ` · ${ev.startTime}` : ""}
                                {ev.location ? ` · ${ev.location}` : ""}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nada marcado.</p>
                  )}
                </Card>
                <Card>
                  <CardHeader title="Leads" />
                  {c.leads.length ? (
                    <ul className="grid gap-0.5 px-2 pt-3 pb-3 sm:px-3">
                      {c.leads.map((l) => (
                        <li key={l.id}>
                          <Link
                            href={`/painel/crm/${l.id}`}
                            className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] text-light">{l.company || l.name}</span>
                              <span className="block truncate text-[12px] text-mute">
                                {[l.projectType ? optionLabel(FUNNEL_PROJECT_TYPES, l.projectType) : null, sinceLabel(l.createdAt, today)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <LeadStageBadge stage={l.stage} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nenhum lead.</p>
                  )}
                </Card>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-5">
                <Card>
                  <CardHeader title="Dados do cliente" />
                  <div className="px-5 pb-2 sm:px-6">
                    <InfoList
                      items={[
                        { label: "Contato", value: c.contactName },
                        {
                          label: "WhatsApp",
                          value: formatPhone(c.phone) ? (
                            <a href={wa ?? undefined} target="_blank" rel="noreferrer" className="hover:underline">
                              {formatPhone(c.phone)}
                            </a>
                          ) : null,
                        },
                        {
                          label: "E-mail",
                          value: c.email ? <span className="break-all">{c.email}</span> : null,
                        },
                        {
                          label: "Instagram",
                          value: c.instagram ? (
                            <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer" className="hover:underline">
                              @{c.instagram}
                            </a>
                          ) : null,
                        },
                        {
                          label: "CNPJ ou CPF",
                          value: c.document ? <span className="font-mono text-[13px]">{formatDocument(c.document)}</span> : null,
                        },
                      ]}
                    />
                  </div>
                  {c.notes ? (
                    <div className="border-t border-line px-5 py-5 sm:px-6">
                      <p className="label mb-1.5 text-mute">Observações</p>
                      <p className="text-[14px] whitespace-pre-line wrap-anywhere text-ash">{c.notes}</p>
                    </div>
                  ) : null}
                </Card>
              </div>
            </div>
          </div>
        ) : null}

        {aba === "projetos" ? (
          <Card className="min-w-0">
            <CardHeader title="Projetos" />
            {c.projects.length ? (
              <Table className="mt-4" minWidth={640}>
                <thead>
                  <tr>
                    <Th>Projeto</Th>
                    <Th>Etapa</Th>
                    <Th>Status</Th>
                    <Th>Prazo</Th>
                    <Th align="right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.projects.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <Link href={`/painel/projetos/${p.id}`} className="hover:underline">
                          {p.title}
                        </Link>
                        <span className="block font-mono text-[11px] text-mute">{p.code}</span>
                      </Td>
                      <Td>
                        <StageBadge stage={p.stage} />
                      </Td>
                      <Td>
                        <ProjectStatusBadge status={p.status} />
                      </Td>
                      <Td className="text-ash">{dateBR(p.dueDate)}</Td>
                      <Td align="right">{brl(p.value)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="px-5 pt-3 pb-6 text-[14px] text-mute sm:px-6">Nenhum projeto ainda.</p>
            )}
          </Card>
        ) : null}

        {aba === "orcamentos" ? (
          <Card className="min-w-0">
            <CardHeader title="Orçamentos" />
            {c.quotes.length ? (
              <Table className="mt-4" minWidth={600}>
                <thead>
                  <tr>
                    <Th>Orçamento</Th>
                    <Th>Emissão</Th>
                    <Th>Status</Th>
                    <Th align="right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.quotes.map((q) => (
                    <tr key={q.id}>
                      <Td>
                        <Link href={`/painel/orcamentos/${q.id}`} className="hover:underline">
                          {q.title}
                        </Link>
                        <span className="block font-mono text-[11px] text-mute">
                          {q.number}
                          {q.version > 1 ? ` v${q.version}` : ""}
                        </span>
                      </Td>
                      <Td className="text-ash">{dateBR(q.issueDate)}</Td>
                      <Td>
                        <QuoteStatusBadge status={q.status} />
                      </Td>
                      <Td align="right">{q.total ? brl(q.total) : <span className="text-mute">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="px-5 pt-3 pb-6 text-[14px] text-mute sm:px-6">
                Nenhum orçamento ainda.{" "}
                <Link
                  href={`/painel/orcamentos/novo?cliente=${c.id}`}
                  className="text-light underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                >
                  Criar o primeiro
                </Link>
              </p>
            )}
          </Card>
        ) : null}

        {aba === "financeiro" ? (
          c.entries.length ? (
            <Card className="min-w-0">
              <CardHeader title="Recebimentos" />
              <Table className="mt-4" minWidth={640}>
                <thead>
                  <tr>
                    <Th>Descrição</Th>
                    <Th>Vencimento</Th>
                    <Th align="right">Valor</Th>
                    <Th align="right">Recebido</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.entries.map((e) => (
                    <tr key={e.id}>
                      <Td>
                        {e.projectId ? (
                          <Link href={`/painel/projetos/${e.projectId}?aba=financeiro`} className="hover:underline">
                            {e.description}
                          </Link>
                        ) : (
                          e.description
                        )}
                        {e.installment ? <span className="block text-[12px] text-mute">Parcela {e.installment}</span> : null}
                      </Td>
                      <Td className="text-ash">{dateBR(e.dueDate)}</Td>
                      <Td align="right">{brl(e.amount)}</Td>
                      <Td align="right" className="text-ash">
                        {brl(e.paidAmount)}
                      </Td>
                      <Td>
                        <EntryStatusBadge status={entryStatus(e, today)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : (
            <Card>
              <EmptyState title="Nenhum recebimento ainda" />
            </Card>
          )
        ) : null}

        {aba === "historico" ? (
          <Card className="min-w-0">
            <CardHeader title="Histórico" />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <ActivityForm clientId={c.id} />
              {c.activities.length ? (
                <div className="mt-8 border-t border-line pt-6">
                  <ActivityTimeline items={c.activities} showLead />
                </div>
              ) : (
                <p className="mt-6 border-t border-line pt-6 text-[14px] text-mute">Nada registrado ainda.</p>
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/** Projeto recorrente: o combinado de todo mês e como está o mês corrente. */
function RecurringCard({
  r,
  mes,
}: {
  r: ClientRecurring;
  mes: Awaited<ReturnType<typeof recurringMonth>>;
}) {
  const total = mes.feitas + mes.agendadas;
  const pct = r.days ? Math.min(100, Math.round((mes.feitas / r.days) * 100)) : 0;
  const pctAgenda = r.days ? Math.min(100 - pct, Math.round((mes.agendadas / r.days) * 100)) : 0;
  const combinado = [
    `${brl(r.value)} por mês`,
    `${r.days} ${r.days === 1 ? "diária" : "diárias"} por mês`,
    r.payDay ? `paga dia ${r.payDay}` : null,
    r.startMonth ? `desde ${monthShort(r.startMonth)}/${r.startMonth.slice(0, 4)}` : null,
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader className="flex-wrap gap-y-1" title="Projeto recorrente" description={combinado.join(" · ")} />
      <div className="grid gap-5 px-5 pt-5 pb-5 sm:grid-cols-3 sm:px-6 sm:pb-6">
        <p className="label -mb-2 text-mute sm:col-span-3">{monthLong(mes.mes)}</p>
        <div className="grid content-start gap-2">
          <p className="text-[13px] text-mute">Diárias de captação no mês</p>
          <p className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-white tabular-nums">
            {mes.feitas} <span className="text-[15px] font-normal text-mute">de {r.days}</span>
          </p>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
            <span className="h-full bg-white" style={{ width: `${pct}%` }} />
            <span className="h-full bg-white/35" style={{ width: `${pctAgenda}%` }} />
          </div>
          <p className="text-[12px] text-mute">
            {mes.agendadas ? `${mes.agendadas} ${mes.agendadas === 1 ? "agendada" : "agendadas"} até o fim do mês` : "Nenhuma diária agendada à frente"}
            {total > r.days ? ` · ${total - r.days} além do combinado` : total < r.days ? ` · faltam ${r.days - total} para agendar` : ""}
          </p>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-[13px] text-mute">Valor do mês</p>
          <p className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-white tabular-nums">
            {brl(mes.recebido)} <span className="text-[15px] font-normal text-mute">de {brl(r.value)}</span>
          </p>
          <p className={cn("text-[12px]", mes.vence && mes.vence < mes.hoje ? "text-danger" : "text-mute")}>
            {!mes.lancado
              ? r.autoFinance === false
                ? "Nada lançado no financeiro com vencimento neste mês"
                : "A cobrança entra sozinha no Financeiro"
              : mes.vence
                ? `${mes.vence < mes.hoje ? "Venceu" : "Vence"} dia ${Number(mes.vence.slice(8, 10))} · lançado ${brl(mes.lancado)}`
                : `Recebido · lançado ${brl(mes.lancado)}`}
          </p>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-[13px] text-mute">Entregas todo mês</p>
          {r.deliverables.length ? (
            <ul className="grid gap-1.5">
              {r.deliverables.map((d, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[14px] text-light">
                  <span className="min-w-6 font-semibold tabular-nums text-white">{d.qty}</span>
                  <span className="min-w-0">{d.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-mute">Nenhuma entrega fixa cadastrada.</p>
          )}
          {mes.cards.total ? (
            <Link href="/painel/pauta" className="flex w-fit items-center gap-1 text-[12px] text-ash hover:text-white">
              Na Pauta: {mes.cards.prontas} de {mes.cards.total} {mes.cards.prontas === 1 ? "pronta" : "prontas"} <ArrowUpRight className="size-3" />
            </Link>
          ) : r.deliverables.length && r.autoPauta !== false ? (
            <p className="text-[12px] text-mute">Os cards entram sozinhos na Pauta</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
