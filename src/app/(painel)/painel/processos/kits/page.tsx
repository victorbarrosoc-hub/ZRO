import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { countProcessos, listKits } from "@/lib/queries/admin-content";
import { KitActions, NewKitButton } from "../processos-dialogs";
import { ProcessosTabs } from "../processos-tabs";

export const metadata: Metadata = { title: "Kits de equipamento" };

export default async function KitsPage() {
  await requireUser();
  const [kits, counts] = await Promise.all([listKits(), countProcessos()]);

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Processos"
        title="Kits de equipamento"
        description="Listas prontas para o checklist de saída e retorno de cada projeto."
        actions={<NewKitButton />}
      />
      <ProcessosTabs active="kits" counts={counts} />

      {kits.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kits.map((k) => (
            <li key={k.id}>
              <Card className="flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[17px] font-medium tracking-[-0.01em] text-white">{k.name}</p>
                    {k.description ? <p className="mt-1 text-[13px] text-mute">{k.description}</p> : null}
                  </div>
                  <Badge className="shrink-0">
                    {k.items.length} {k.items.length === 1 ? "item" : "itens"}
                  </Badge>
                </div>
                <ul className="mt-4 mb-4 grid border-t border-line pt-2 text-[14px]">
                  {k.items.map((item, i) => (
                    <li key={`${item.name}-${i}`} className="flex items-baseline justify-between gap-4 py-1.5">
                      <span className="min-w-0 text-ash">{item.name}</span>
                      <span className="shrink-0 text-light tabular-nums">×{item.qty}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-4">
                  <span className="text-[13px] text-mute">
                    {k.pieces} peça{k.pieces === 1 ? "" : "s"}
                  </span>
                  <KitActions kit={{ id: k.id, name: k.name, description: k.description, items: k.items }} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="Nenhum kit ainda"
            description="Monte a lista de um kit (câmera, áudio, luz...) para usar nos checklists."
            action={<NewKitButton />}
          />
        </Card>
      )}
    </div>
  );
}
