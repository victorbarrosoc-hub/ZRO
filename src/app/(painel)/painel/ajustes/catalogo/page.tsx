import type { Metadata } from "next";
import { Fragment } from "react";
import { Table, Td, Th } from "@/components/painel/bits";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { CATALOG_UNITS, optionLabel } from "@/lib/domain";
import { brl } from "@/lib/format";
import { listCatalogAdmin } from "@/lib/queries/admin-content";
import { cn } from "@/lib/utils";
import { AjustesTabs } from "../ajustes-tabs";
import { CatalogRowActions, EditCatalogItemButton, NewCatalogItemButton } from "../catalog-dialogs";

export const metadata: Metadata = { title: "Catálogo de preços" };

function margin(price: number, cost: number) {
  if (!cost || !price) return null;
  return { value: price - cost, pct: Math.round(((price - cost) / price) * 100) };
}

export default async function CatalogoPage() {
  await requireUser();
  const catalog = await listCatalogAdmin();
  const groups = catalog.groups.filter((g) => g.items.length);

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Ajustes"
        title="Catálogo de preços"
        description={`Itens com preço sugerido para montar orçamentos. ${catalog.active} de ${catalog.total} ativos. O custo é interno: o cliente não vê.`}
        actions={<NewCatalogItemButton />}
      />
      <AjustesTabs active="catalogo" />

      {groups.length ? (
        <Card className="min-w-0 pt-2">
          <Table minWidth={880} className="[&_tbody_tr:last-child>td]:border-b-0">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Cobrado por</Th>
                <Th align="right">Preço</Th>
                <Th align="right">Custo</Th>
                <Th align="right">Margem</Th>
                <Th align="right">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <tr>
                    <td colSpan={6} className="border-b border-line bg-white/[0.02] px-5 pt-5 pb-2.5 sm:px-6">
                      <span className="label text-ash">{g.label}</span>
                      <span className="ml-2 text-[12px] text-mute">
                        {g.items.length} ite{g.items.length === 1 ? "m" : "ns"}
                      </span>
                    </td>
                  </tr>
                  {g.items.map((item, i) => {
                    const m = margin(item.price, item.cost);
                    const defaults = {
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      group: item.group,
                      unit: item.unit,
                      price: item.price,
                      cost: item.cost,
                      active: item.active,
                    };
                    return (
                      <tr key={item.id} className={cn(!item.active && "[&>td]:text-mute")}>
                        <Td className="max-w-[360px]">
                          <div className="flex items-start gap-2">
                            <EditCatalogItemButton item={defaults} />
                            {!item.active ? <Badge className="mt-px shrink-0">Inativo</Badge> : null}
                          </div>
                        </Td>
                        <Td className="text-ash">{optionLabel(CATALOG_UNITS, item.unit)}</Td>
                        <Td align="right">{brl(item.price)}</Td>
                        <Td align="right" className="text-ash">
                          {item.cost ? brl(item.cost) : <span className="text-mute">—</span>}
                        </Td>
                        <Td align="right" className="text-ash">
                          {m ? (
                            <>
                              {brl(m.value)} <span className="text-[12px] text-mute">· {m.pct}%</span>
                            </>
                          ) : (
                            <span className="text-[12px] text-mute">sem custo</span>
                          )}
                        </Td>
                        <Td align="right" className="w-px whitespace-nowrap">
                          <CatalogRowActions item={defaults} quotes={item.quotes} first={i === 0} last={i === g.items.length - 1} />
                        </Td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Catálogo vazio"
            description="Cadastre pacotes, diárias e extras com o preço de sempre. Eles aparecem ao montar um orçamento."
            action={<NewCatalogItemButton />}
          />
        </Card>
      )}

      <p className="text-[13px] text-mute">
        Mudar um preço aqui não muda orçamentos que já existem. Inativo some da lista dos orçamentos novos. As setas mudam a
        ordem dentro do grupo.
      </p>
    </div>
  );
}
