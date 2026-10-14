import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { SearchField } from "@/components/painel/search-field";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
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
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {groups.map((g) => (
            <Card key={g.key}>
              <CardHeader title={g.label} action={<span className="label pt-1 text-mute">{g.items.length}</span>} />
              <ul className="mt-2 px-3 pb-3">
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03]">
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
                      ) : (
                        <p className="text-[12px] text-mute">Nenhum freela tem</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <EditEquipmentButton id={item.id} name={item.name} category={item.category} />
                      <DeleteEquipmentButton id={item.id} name={item.name} owners={item.owners.length} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title={q ? `Nada com “${q}” no banco` : "Nenhum equipamento nessa categoria"} action={<NewEquipmentButton category={categoria} />} />
        </Card>
      )}
    </div>
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
