import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { QuoteStatusBadge, Table, Td, Th } from "@/components/painel/bits";
import { SearchField } from "@/components/painel/search-field";
import { StatTile } from "@/components/painel/stat";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { QUOTE_STATUS } from "@/lib/domain";
import { brl, dateBR, monthLong, todayISO } from "@/lib/format";
import { filterQuotes, listQuotes, summarizeQuotes } from "@/lib/queries/quotes";
import { percentLabel } from "@/lib/services/quotes";
import { FilterChip, ValidityCell } from "./quote-bits";

export const metadata: Metadata = { title: "Orçamentos" };

const STATUS_KEYS = QUOTE_STATUS.map((s) => s.key) as string[];

export default async function OrcamentosPage({ searchParams }: PageProps<"/painel/orcamentos">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q : undefined;
  const status = typeof sp.status === "string" && STATUS_KEYS.includes(sp.status) ? sp.status : undefined;
  const today = todayISO();

  const all = await listQuotes(today);
  const summary = summarizeQuotes(all, today);
  const rows = filterQuotes(all, { status, q });
  const countBy = (key: string) => filterQuotes(all, { status: key, q }).length;

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/orcamentos${s ? `?${s}` : ""}`;
  };

  const newButton = (
    <ButtonLink href="/painel/orcamentos/novo" variant="primary">
      <Plus /> Novo orçamento
    </ButtonLink>
  );

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Comercial"
        title="Orçamentos"
        actions={newButton}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo dos orçamentos">
        <StatTile
          label="Em aberto"
          value={brl(summary.openTotal)}
          sub={
            summary.openCount
              ? `${summary.openCount} enviado${summary.openCount > 1 ? "s" : ""}, dentro da validade`
              : "Nada enviado aguardando resposta"
          }
          icon={<FileText />}
        />
        <StatTile
          label="Aprovados no mês"
          value={brl(summary.approvedMonthTotal)}
          sub={
            summary.approvedMonthCount
              ? `${summary.approvedMonthCount} aprovado${summary.approvedMonthCount > 1 ? "s" : ""} em ${monthLong(today.slice(0, 7))}`
              : `Nenhum aprovado em ${monthLong(today.slice(0, 7))}`
          }
        />
        <StatTile
          label="Taxa de aprovação"
          value={percentLabel(summary.approvalRate)}
          sub={
            summary.decidedYear
              ? `${summary.approvedYear} de ${summary.decidedYear} decidido${summary.decidedYear > 1 ? "s" : ""} em ${summary.year}`
              : `Nenhum decidido em ${summary.year} ainda`
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-center">
        <SearchField placeholder="Buscar por número, título ou cliente" />
        <nav
          aria-label="Filtrar por status"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0"
        >
          <FilterChip href={qs({ status: undefined })} active={!status} count={filterQuotes(all, { q }).length}>
            Todos
          </FilterChip>
          {QUOTE_STATUS.map((s) => (
            <FilterChip key={s.key} href={qs({ status: s.key })} active={status === s.key} count={countBy(s.key)}>
              {s.label}
            </FilterChip>
          ))}
        </nav>
      </div>

      {rows.length ? (
        <Card>
          {/* Celular: cartões */}
          <ul className="grid divide-y divide-line sm:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/painel/orcamentos/${r.id}`} className="grid gap-2 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] text-mute">
                      {r.number} <span className="text-ash">v{r.version}</span>
                    </span>
                    <QuoteStatusBadge status={r.effectiveStatus} />
                  </span>
                  <span className="text-[15px] leading-snug text-white">{r.title}</span>
                  <span className="text-[13px] text-mute">{r.who}</span>
                  <span className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[16px] font-medium text-white">{brl(r.totals.total)}</span>
                    <ValidityCell validUntil={r.validUntil} status={r.status} today={today} inline />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet e desktop: tabela */}
          <Table className="hidden sm:block" minWidth={860}>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Título</Th>
                <Th>Cliente</Th>
                <Th>Emissão</Th>
                <Th>Validade</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td className="whitespace-nowrap">
                    <Link href={`/painel/orcamentos/${r.id}`} className="font-mono text-[13px] text-light hover:underline">
                      {r.number} <span className="text-mute">v{r.version}</span>
                    </Link>
                    {r.versions > 1 ? <span className="block text-[11px] text-mute">{r.versions} versões</span> : null}
                  </Td>
                  <Td className="max-w-[320px]">
                    <Link href={`/painel/orcamentos/${r.id}`} className="line-clamp-2 hover:underline">
                      {r.title}
                    </Link>
                  </Td>
                  <Td className="text-ash">{r.who}</Td>
                  <Td className="whitespace-nowrap text-ash">{dateBR(r.issueDate)}</Td>
                  <Td className="whitespace-nowrap">
                    <ValidityCell validUntil={r.validUntil} status={r.status} today={today} />
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {brl(r.totals.total)}
                  </Td>
                  <Td>
                    <QuoteStatusBadge status={r.effectiveStatus} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title={q || status ? "Nenhum orçamento com esse filtro" : "Nenhum orçamento ainda"}
            action={q || status ? undefined : newButton}
          />
        </Card>
      )}
    </div>
  );
}
