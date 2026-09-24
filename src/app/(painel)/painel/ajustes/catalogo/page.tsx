import type { Metadata } from "next";
import { Table, Td, Th } from "@/components/painel/bits";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
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
        groups.map((g) => (
          <Card key={g.key}>
            <CardHeader title={g.label} description={`${g.items.length} ite${g.items.length === 1 ? "m" : "ns"}`} />
            <Table className="mt-3" minWidth={860}>
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
                {g.items.map((item, i) => {
                  const m = margin(item.price, item.cost);
                  return (
                    <tr key={item.id} className={cn(!item.active && "[&>td]:text-mute")}>
                      <Td className="max-w-[340px]">
                        <div className="flex items-start gap-2">
                          <EditCatalogItemButton
                            item={{
                              id: item.id,
                              name: item.name,
                              description: item.description,
                              group: item.group,
                              unit: item.unit,
                              price: item.price,
                              cost: item.cost,
                              active: item.active,
                            }}
                          />
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
                        <CatalogRowActions
                          item={{
                            id: item.id,
                            name: item.name,
                            description: item.description,
                            group: item.group,
                            unit: item.unit,
                            price: item.price,
                            cost: item.cost,
                            active: item.active,
                          }}
                          quotes={item.quotes}
                          first={i === 0}
                          last={i === g.items.length - 1}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ))
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
        Mudar um preço aqui não muda orçamentos que já existem. Inativo some da lista dos orçamentos novos.
      </p>
    </div>
  );
}
