import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { SearchField } from "@/components/painel/search-field";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { EQUIPMENT_CATEGORIES } from "@/lib/domain";
import { listEquipmentWithOwners } from "@/lib/queries/freelas";
import { cn } from "@/lib/utils";
import { DeleteEquipmentButton, EditEquipmentButton, NewEquipmentButton } from "./equipamentos-dialogs";

export const metadata: Metadata = { title: "Equipamentos" };

export default async function EquipamentosPage({ searchParams }: PageProps<"/painel/freelas/equipamentos">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const categoria = EQUIPMENT_CATEGORIES.find((c) => c.key === sp.categoria)?.key;
  const items = await listEquipmentWithOwners(q);

  const groups = EQUIPMENT_CATEGORIES.filter((c) => !categoria || c.key === categoria)
    // Quem tem dono vem primeiro: a pergunta da página é "quem tem isso?".
    .map((c) => ({
      ...c,
      items: items.filter((i) => i.category === c.key).sort((a, b) => Number(!a.owners.length) - Number(!b.owners.length)),
    }))
    .filter((g) => g.items.length);
  const counts = new Map(EQUIPMENT_CATEGORIES.map((c) => [c.key, items.filter((i) => i.category === c.key).length]));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, categoria, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/freelas/equipamentos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="grid gap-8">
      <Link href="/painel/freelas" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Freelas
      </Link>
      <PageHeader label="Banco de freelas" title="Equipamentos" actions={<NewEquipmentButton category={categoria} />} />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-center">
        <SearchField placeholder="Buscar equipamento" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
          <FilterChip href={qs({ categoria: undefined })} active={!categoria}>
            Tudo
          </FilterChip>
          {EQUIPMENT_CATEGORIES.map((c) => (
            <FilterChip key={c.key} href={qs({ categoria: c.key })} active={categoria === c.key}>
              {c.label}
              <span className={cn("tabular-nums", categoria === c.key ? "text-void/50" : "text-mute")}>{counts.get(c.key) ?? 0}</span>
            </FilterChip>
          ))}
        </div>
      </div>

      {groups.length ? (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {groups.map((g) => {
            const owned = g.items.filter((i) => i.owners.length);
            const rest = g.items.filter((i) => !i.owners.length);
            // Fechadas por padrão; abrem sozinhas quando há busca ou uma categoria escolhida.
            const open = Boolean(q || categoria);
            return (
              <details
                key={g.key}
                open={open}
                className="group rounded-card border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.035),rgb(255_255_255/0.012))]"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-card px-5 py-3 select-none hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium text-white">{g.label}</span>
                    <span className="block text-[12px] text-mute">
                      {g.items.length} no banco{owned.length ? ` · ${owned.length} com freela` : ""}
                    </span>
                  </span>
                  {owned.length ? (
                    <span className="flex -space-x-1.5" aria-hidden>
                      {[...new Map(owned.flatMap((i) => i.owners).map((o) => [o.id, o])).values()].slice(0, 4).map((o) => (
                        <Avatar key={o.id} name={o.name} imageId={o.photoId} size="xs" className="ring-2 ring-ink" />
                      ))}
                    </span>
                  ) : null}
                  <ChevronDown className="size-4 shrink-0 text-mute transition-transform duration-200 group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-line px-3 py-2">
                  {owned.length ? (
                    <ul>
                      {owned.map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-2 text-[13px] text-mute">Nenhum freela com equipamento dessa categoria ainda.</p>
                  )}
                  {rest.length ? (
                    <details open={Boolean(q)} className="group/rest">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-[13px] text-ash select-none hover:bg-white/[0.03] hover:text-light [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">
                          {owned.length ? "Ver também os sem freela" : "Ver o que tem no banco"} · {rest.length}
                        </span>
                        <ChevronDown className="size-4 text-mute transition-transform duration-200 group-open/rest:rotate-180" aria-hidden />
                      </summary>
                      <ul>
                        {rest.map((item) => (
                          <ItemRow key={item.id} item={item} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState title={q ? `Nada com “${q}” no banco` : "Nenhum equipamento nessa categoria"} action={<NewEquipmentButton category={categoria} />} />
        </Card>
      )}
    </div>
  );
}

type Item = Awaited<ReturnType<typeof listEquipmentWithOwners>>[number];

function ItemRow({ item }: { item: Item }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-light">{item.name}</p>
        {item.owners.length ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.owners.map((o) => (
              <Link
                key={o.id}
                href={`/painel/freelas/${o.id}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line py-0.5 pr-2.5 pl-0.5 text-[12px] text-ash transition-colors hover:border-white/30 hover:text-light"
              >
                <Avatar name={o.name} imageId={o.photoId} size="xs" />
                {o.name.split(" ")[0]}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">
        <EditEquipmentButton id={item.id} name={item.name} category={item.category} />
        <DeleteEquipmentButton id={item.id} name={item.name} owners={item.owners.length} />
      </div>
    </li>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
        active ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
      )}
    >
      {children}
    </Link>
  );
}
