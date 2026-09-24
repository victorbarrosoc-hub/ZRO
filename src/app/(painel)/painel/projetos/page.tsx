import type { Metadata } from "next";
import Link from "next/link";
import { Film, ListChecks } from "lucide-react";
import { ProjectStatusBadge, StageBadge, TabLinks, Table, Td, Th } from "@/components/painel/bits";
import { SearchField } from "@/components/painel/search-field";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { STAGES, categoryLabel } from "@/lib/domain";
import { brl, dateBR, dateShort, initials, todayISO } from "@/lib/format";
import {
  countProjectsByFilter,
  getProjectFormOptions,
  listProjects,
  parseStatusFilter,
  type ProjectListItem,
  type ProjectStatusFilter,
} from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { NewProjectButton } from "./projeto-dialogs";

export const metadata: Metadata = { title: "Projetos" };

const STATUS_FILTERS: { key: ProjectStatusFilter; label: string }[] = [
  { key: "ativos", label: "Ativos" },
  { key: "concluidos", label: "Concluídos" },
  { key: "todos", label: "Todos" },
];

function isLate(p: { dueDate: string | null; status: string }, today: string) {
  return Boolean(p.dueDate && p.dueDate < today && p.status !== "concluido" && p.status !== "cancelado");
}

export default async function ProjetosPage({ searchParams }: PageProps<"/painel/projetos">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const view = sp.view === "lista" ? "lista" : "quadro";
  const status = parseStatusFilter(sp.status);
  const [items, counts, options] = await Promise.all([listProjects({ q, status }), countProjectsByFilter(), getProjectFormOptions()]);
  const today = todayISO();

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, view: view === "lista" ? "lista" : undefined, status: status === "ativos" ? undefined : status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/projetos${s ? `?${s}` : ""}`;
  };

  const total = items.reduce((s, p) => s + p.value, 0);
  const late = items.filter((p) => isLate(p, today)).length;
  const noun =
    status === "ativos"
      ? `${items.length} em andamento`
      : status === "concluidos"
        ? `${items.length} concluído${items.length === 1 ? "" : "s"}`
        : `${items.length} projeto${items.length === 1 ? "" : "s"}`;
  const description = [noun, total > 0 ? `${brl(total)} contratados` : null, late ? `${late} com prazo vencido` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid gap-8">
      <PageHeader label="Processo criativo" title="Projetos" description={description} actions={<NewProjectButton options={options} />} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField placeholder="Buscar por título, código ou cliente" className="sm:w-[320px]" />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {STATUS_FILTERS.map((f) => (
              <FilterChip key={f.key} href={qs({ status: f.key === "ativos" ? undefined : f.key })} active={status === f.key} count={counts[f.key]}>
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>
        <TabLinks
          active={view}
          tabs={[
            { key: "quadro", label: "Quadro", href: qs({ view: undefined }) },
            { key: "lista", label: "Lista", href: qs({ view: "lista" }) },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <Card>
          {counts.todos === 0 ? (
            <EmptyState
              title="Nenhum projeto ainda"
              description="Todo projeto começa do zero: crie o primeiro e ele entra em 01 Origem."
              action={<NewProjectButton options={options} />}
            />
          ) : (
            <EmptyState
              title="Nenhum projeto com esse filtro"
              description={q ? `Nada encontrado para "${q}".` : "Troque o filtro para ver outros projetos."}
              action={
                <Link href="/painel/projetos" className="text-[14px] text-ash underline decoration-white/20 underline-offset-4 hover:text-white">
                  Limpar filtros
                </Link>
              }
            />
          )}
        </Card>
      ) : view === "quadro" ? (
        <Board items={items} today={today} />
      ) : (
        <ProjectTable items={items} today={today} />
      )}
    </div>
  );
}

/* ---------------- Quadro: uma coluna por etapa ---------------- */

function Board({ items, today }: { items: ProjectListItem[]; today: string }) {
  return (
    <section aria-label="Quadro de projetos por etapa" className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <ol className="flex w-max snap-x snap-mandatory gap-3 sm:snap-none">
        {STAGES.map((stage) => {
          const list = items.filter((p) => p.stage === stage.key);
          return (
            <li
              key={stage.key}
              className="flex w-[82vw] max-w-[296px] shrink-0 snap-start flex-col rounded-card border border-line bg-white/[0.012] p-2 sm:w-[272px]"
            >
              <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5 pb-3" title={stage.hint}>
                <h2 className="flex min-w-0 items-baseline gap-2">
                  <span className="font-mono text-[11px] text-mute">{stage.n}</span>
                  <span className="truncate text-[14px] font-medium text-light">{stage.label}</span>
                </h2>
                <span className="text-[12px] text-mute tabular-nums" aria-label={`${list.length} projetos`}>
                  {list.length}
                </span>
              </div>
              {list.length ? (
                <ul className="grid gap-2">
                  {list.map((p) => (
                    <li key={p.id}>
                      <BoardCard p={p} today={today} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mx-1 mb-1 grid min-h-24 place-items-center rounded-[18px] border border-dashed border-line px-4 text-center text-[13px] text-mute">
                  Nenhum projeto aqui
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BoardCard({ p, today }: { p: ProjectListItem; today: string }) {
  const late = isLate(p, today);
  const pct = p.tasksTotal ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
  const shown = p.crew.slice(0, 3);
  const extra = p.crew.length - shown.length;
  return (
    <Link
      href={`/painel/projetos/${p.id}`}
      className="group block rounded-[18px] border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.05),rgb(255_255_255/0.02))] p-4 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-mute">{p.code}</span>
        {p.status !== "ativo" ? <ProjectStatusBadge status={p.status} /> : null}
      </div>
      <p className="mt-2 text-[15px] leading-snug font-medium text-white">{p.title}</p>
      <p className="mt-1 truncate text-[13px] text-mute">{p.clientName ?? "Sem cliente"}</p>

      <div className="mt-4">
        <div
          className="h-1 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Tarefas concluídas"
          aria-valuemin={0}
          aria-valuemax={p.tasksTotal}
          aria-valuenow={p.tasksDone}
        >
          <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-mute">
          <span className="flex items-center gap-1.5">
            <ListChecks className="size-3.5" aria-hidden />
            {p.tasksTotal ? `${p.tasksDone}/${p.tasksTotal} tarefas` : "Sem tarefas"}
          </span>
          <span className="flex items-center gap-1.5">
            <Film className="size-3.5" aria-hidden />
            {p.deliverablesTotal ? `${p.deliverablesDone}/${p.deliverablesTotal} entregas` : "Sem entregas"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex min-h-7 items-center justify-between gap-3 border-t border-line pt-3">
        {late ? (
          <Badge tone="warn" dot>
            Atrasado · {dateShort(p.dueDate)}
          </Badge>
        ) : (
          <span className="text-[12px] text-ash">{p.dueDate ? `Prazo ${dateShort(p.dueDate)}` : "Sem prazo"}</span>
        )}
        {shown.length ? (
          <span className="flex items-center -space-x-2" aria-label={`Equipe: ${p.crew.join(", ")}`}>
            {shown.map((name) => (
              <span
                key={name}
                title={name}
                className="grid size-7 place-items-center rounded-full border-2 border-[#101010] bg-smoke text-[10px] font-medium text-light"
              >
                {initials(name)}
              </span>
            ))}
            {extra > 0 ? (
              <span className="grid size-7 place-items-center rounded-full border-2 border-[#101010] bg-mist text-[10px] text-ash">+{extra}</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/* ---------------- Lista ---------------- */

function ProjectTable({ items, today }: { items: ProjectListItem[]; today: string }) {
  return (
    <Card>
      <Table minWidth={920}>
        <thead>
          <tr>
            <Th>Código</Th>
            <Th>Projeto</Th>
            <Th>Cliente</Th>
            <Th>Categoria</Th>
            <Th>Etapa</Th>
            <Th>Status</Th>
            <Th>Prazo</Th>
            <Th align="right">Valor</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const late = isLate(p, today);
            return (
              <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                <Td className="font-mono text-[12px] whitespace-nowrap text-mute">{p.code}</Td>
                <Td>
                  <Link href={`/painel/projetos/${p.id}`} className="font-medium text-white hover:underline">
                    {p.title}
                  </Link>
                </Td>
                <Td className="text-ash">{p.clientName ?? "—"}</Td>
                <Td className="text-ash">{categoryLabel(p.category)}</Td>
                <Td>
                  <StageBadge stage={p.stage} />
                </Td>
                <Td>
                  <ProjectStatusBadge status={p.status} />
                </Td>
                <Td className={cn("whitespace-nowrap", late ? "text-warn" : "text-ash")}>
                  {dateBR(p.dueDate)}
                  {late ? <span className="sr-only"> (atrasado)</span> : null}
                </Td>
                <Td align="right">{p.value ? brl(p.value) : <span className="text-mute">—</span>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

function FilterChip({ href, active, count, children }: { href: string; active: boolean; count: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
        active ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
      )}
    >
      {children}
      <span className={cn("text-[11px] tabular-nums", active ? "text-void/60" : "text-mute")}>{count}</span>
    </Link>
  );
}
