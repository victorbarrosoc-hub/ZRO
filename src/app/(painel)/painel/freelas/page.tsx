import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { SearchField } from "@/components/painel/search-field";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { RATE_UNITS, functionOptions, optionLabel } from "@/lib/domain";
import { brl } from "@/lib/format";
import { listCustomFunctions, listEquipmentCatalog, listFreelancers } from "@/lib/queries/freelas";
import { cn } from "@/lib/utils";
import { NewFreelaButton } from "./freela-dialogs";

export const metadata: Metadata = { title: "Freelas" };

export default async function FreelasPage({ searchParams }: PageProps<"/painel/freelas">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const funcao = typeof sp.funcao === "string" ? sp.funcao : undefined;
  const arquivados = sp.arquivados === "1";
  const [freelas, customFunctions, equipmentCatalog] = await Promise.all([
    listFreelancers({ q, funcao, ativos: !arquivados }),
    listCustomFunctions(),
    listEquipmentCatalog(),
  ]);
  const functions = functionOptions(customFunctions);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, funcao, arquivados: arquivados ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/painel/freelas${s ? `?${s}` : ""}`;
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Banco de freelas"
        title="Freelas"
        actions={
          <>
            <ButtonLink href="/painel/freelas/equipamentos" variant="secondary">
              <Camera /> Equipamentos
            </ButtonLink>
            <NewFreelaButton customFunctions={customFunctions} equipmentCatalog={equipmentCatalog} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-center">
        <SearchField placeholder="Buscar por nome, cidade ou equipamento" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
          <FilterChip href={qs({ funcao: undefined })} active={!funcao}>
            Todas as funções
          </FilterChip>
          {functions.map((f) => (
            <FilterChip key={f.key} href={qs({ funcao: f.key })} active={funcao === f.key}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {freelas.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {freelas.map((f) => {
            const rate = f.rates[0];
            return (
              <li key={f.id}>
                <Link href={`/painel/freelas/${f.id}`} className="group block h-full">
                  <Card className="flex h-full flex-col gap-5 p-5 transition-colors duration-300 group-hover:border-white/20">
                    <div className="flex items-start gap-4">
                      <Avatar name={f.name} imageId={f.photoId} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium text-white">{f.name}</p>
                        <p className="text-[13px] text-mute">{f.city ?? "—"}</p>
                      </div>
                      {f.openAmount > 0 ? (
                        <Badge tone="warn">{brl(f.openAmount)}</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.functions.map((fn) => (
                        <Badge key={fn}>{optionLabel(functions, fn)}</Badge>
                      ))}
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-4 text-[13px]">
                      <span className="text-mute">
                        {rate ? (
                          <>
                            <span className="text-light">{brl(rate.amount)}</span> {optionLabel(RATE_UNITS, rate.unit)}
                          </>
                        ) : (
                          "Sem valor padrão"
                        )}
                      </span>
                      <span className="text-mute">
                        {f.jobs} job{f.jobs === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title={q || funcao ? "Ninguém encontrado com esse filtro" : "Nenhum freela cadastrado"}
            action={<NewFreelaButton customFunctions={customFunctions} equipmentCatalog={equipmentCatalog} />}
          />
        </Card>
      )}

      <p className="text-[13px] text-mute">
        <Link href={qs({ arquivados: arquivados ? undefined : "1" })} className="underline decoration-white/20 underline-offset-4 hover:text-light">
          {arquivados ? "Ver freelas ativos" : "Ver também os arquivados"}
        </Link>
      </p>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
        active ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
      )}
    >
      {children}
    </Link>
  );
}
