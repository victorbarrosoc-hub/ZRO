import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { LeadStageBadge, TabLinks, Table, Td, Th } from "@/components/painel/bits";
import { SearchField } from "@/components/painel/search-field";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { FUNNEL_BUDGETS, FUNNEL_PROJECT_TYPES, LEAD_SOURCES, optionLabel } from "@/lib/domain";
import { brl, dateBR, relativeDay, todayISO } from "@/lib/format";
import { filterLeads, listLeads, type LeadRow } from "@/lib/queries/crm";
import { NewLeadButton } from "./crm-dialogs";
import { followUpDue, isOpenStage, sinceLabel } from "./crm-options";
import { FilterChip } from "./crm-ui";
import { LeadBoard, type BoardLead } from "./lead-board";

export const metadata: Metadata = { title: "CRM" };

/** Título do cartão: empresa, cliente ligado ou a pessoa. */
function titleOf(l: LeadRow) {
  return l.company?.trim() || l.clientName || l.name;
}

export default async function CrmPage({ searchParams }: PageProps<"/painel/crm">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const origem = typeof sp.origem === "string" && LEAD_SOURCES.some((s) => s.key === sp.origem) ? sp.origem : undefined;
  const view = sp.view === "lista" ? "lista" : "quadro";
  const oldestFirst = sp.ordem === "antigos";

  const today = todayISO();
  const all = await listLeads();
  const leads = filterLeads(all, { q, origem });

  const open = all.filter((l) => isOpenStage(l.stage));
  const due = open.filter((l) => followUpDue(l, today)).length;
  const openValue = open.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const summary = [
    open.length ? `${open.length} em aberto` : "Nenhum lead em aberto",
    due ? `${due} para retornar` : null,
    openValue ? `${brl(openValue)} estimado` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      view: view === "lista" ? "lista" : undefined,
      q,
      origem,
      ordem: oldestFirst ? "antigos" : undefined,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/crm${s ? `?${s}` : ""}`;
  };

  const filtered = Boolean(q || origem);

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader label="Funil comercial" title="CRM" description={summary} actions={<NewLeadButton />} />

      <div className="grid gap-4 xl:flex xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TabLinks
            tabs={[
              { key: "quadro", label: "Quadro", href: qs({ view: undefined }) },
              { key: "lista", label: "Lista", href: qs({ view: "lista" }) },
            ]}
            active={view}
          />
          <SearchField placeholder="Buscar nome, empresa, e-mail ou telefone" className="w-full sm:w-80" />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 xl:mx-0 xl:px-0">
          <FilterChip href={qs({ origem: undefined })} active={!origem}>
            Todas as origens
          </FilterChip>
          {LEAD_SOURCES.map((s) => (
            <FilterChip key={s.key} href={qs({ origem: s.key })} active={origem === s.key}>
              {s.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {!leads.length ? (
        <Card>
          {filtered ? (
            <EmptyState
              title="Nenhum lead com esse filtro"
              description="Confira a busca ou veja todas as origens."
              action={
                <Link
                  href={qs({ q: undefined, origem: undefined })}
                  className="text-[14px] text-light underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                >
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Nenhum lead ainda"
              description="Os pedidos do site entram aqui sozinhos. Os que chegam por WhatsApp, Instagram ou indicação você cadastra em Novo lead."
              action={<NewLeadButton />}
            />
          )}
        </Card>
      ) : view === "quadro" ? (
        <div className="grid gap-3">
          <LeadBoard leads={leads.map((l) => toBoard(l, today))} today={today} />
          <p className="text-[12px] text-mute">
            <span className="pointer-coarse:hidden">
              Para mudar a etapa, arraste o cartão para outra coluna ou use o menu de cada cartão.
            </span>
            <span className="hidden pointer-coarse:inline">
              Para mudar a etapa, toque no menu do cartão. Deslize para ver as outras colunas.
            </span>
          </p>
        </div>
      ) : (
        <LeadTable
          leads={oldestFirst ? [...leads].reverse() : leads}
          today={today}
          sortHref={qs({ ordem: oldestFirst ? undefined : "antigos" })}
          oldestFirst={oldestFirst}
        />
      )}
    </div>
  );
}

function toBoard(l: LeadRow, today: string): BoardLead {
  const title = titleOf(l);
  return {
    id: l.id,
    title,
    contact: title !== l.name ? l.name : l.segment,
    stage: l.stage,
    fromSite: l.source === "site",
    projectLabel: l.projectType ? optionLabel(FUNNEL_PROJECT_TYPES, l.projectType) : null,
    budgetLabel: l.budget ? optionLabel(FUNNEL_BUDGETS, l.budget) : null,
    estimatedValue: l.estimatedValue,
    since: sinceLabel(l.createdAt, today),
    followUpAt: l.followUpAt,
    createdAt: l.createdAt.getTime(),
    updatedAt: l.updatedAt.getTime(),
  };
}

function LeadTable({
  leads,
  today,
  sortHref,
  oldestFirst,
}: {
  leads: LeadRow[];
  today: string;
  sortHref: string;
  oldestFirst: boolean;
}) {
  return (
    <>
      <ul className="grid min-w-0 grid-cols-1 gap-2 sm:hidden" aria-label="Leads">
        {leads.map((l) => {
          const title = titleOf(l);
          const due = followUpDue(l, today);
          const detail = [
            l.projectType ? optionLabel(FUNNEL_PROJECT_TYPES, l.projectType) : null,
            l.budget ? optionLabel(FUNNEL_BUDGETS, l.budget) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={l.id}>
              <Link
                href={`/painel/crm/${l.id}`}
                className="block rounded-[18px] border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.05),rgb(255_255_255/0.018))] p-4 transition-colors active:bg-white/[0.04]"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-white">{title}</span>
                    <span className="block truncate text-[13px] text-ash">{title !== l.name ? l.name : (l.segment ?? "")}</span>
                  </span>
                  <LeadStageBadge stage={l.stage} />
                </span>
                {detail ? <span className="mt-2 block text-[13px] text-mute">{detail}</span> : null}
                <span className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[12px]">
                  <span className="flex items-center gap-2 text-mute">
                    {due ? (
                      <Badge tone="warn" dot>
                        Retornar
                      </Badge>
                    ) : null}
                    {optionLabel(LEAD_SOURCES, l.source)} · {sinceLabel(l.createdAt, today)}
                  </span>
                  {l.estimatedValue ? <span className="text-light">{brl(l.estimatedValue)}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Card className="hidden min-w-0 sm:block">
        <Table minWidth={940} className="pt-1">
          <thead>
            <tr>
              <Th>Lead</Th>
              <Th>Etapa</Th>
              <Th>Projeto</Th>
              <Th align="right">Valor estimado</Th>
              <Th>Origem</Th>
              <Th>Retorno</Th>
              <Th align="right">
                <Link
                  href={sortHref}
                  scroll={false}
                  className="inline-flex items-center gap-1 hover:text-light"
                  aria-label={
                    oldestFirst
                      ? "Entrada: mais antigos primeiro. Mudar para mais recentes"
                      : "Entrada: mais recentes primeiro. Mudar para mais antigos"
                  }
                >
                  Entrada {oldestFirst ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                </Link>
              </Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const title = titleOf(l);
              const due = followUpDue(l, today);
              const created = todayISO(l.createdAt);
              return (
                <tr key={l.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td className="max-w-72">
                    <Link href={`/painel/crm/${l.id}`} className="block truncate font-medium text-white hover:underline">
                      {title}
                    </Link>
                    <span className="block truncate text-[12px] text-mute">{title !== l.name ? l.name : (l.segment ?? "")}</span>
                  </Td>
                  <Td>
                    <LeadStageBadge stage={l.stage} />
                  </Td>
                  <Td className="whitespace-nowrap text-ash">
                    {l.projectType ? optionLabel(FUNNEL_PROJECT_TYPES, l.projectType) : "—"}
                    {l.budget ? (
                      <span className="block text-[12px] text-mute">{optionLabel(FUNNEL_BUDGETS, l.budget)}</span>
                    ) : null}
                  </Td>
                  <Td align="right">{l.estimatedValue ? brl(l.estimatedValue) : <span className="text-mute">—</span>}</Td>
                  <Td className="text-ash">{optionLabel(LEAD_SOURCES, l.source)}</Td>
                  <Td>
                    {l.followUpAt ? (
                      due ? (
                        <span className="grid justify-items-start gap-1">
                          <Badge tone="warn" dot>
                            Retornar
                          </Badge>
                          <span className="text-[12px] text-mute">
                            {dateBR(l.followUpAt)} · {relativeDay(l.followUpAt, today)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ash">
                          {dateBR(l.followUpAt)}
                          <span className="block text-[12px] text-mute">{relativeDay(l.followUpAt, today)}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </Td>
                  <Td align="right" className="text-ash">
                    {dateBR(created)}
                    <span className="block text-[12px] text-mute">{sinceLabel(l.createdAt, today)}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
