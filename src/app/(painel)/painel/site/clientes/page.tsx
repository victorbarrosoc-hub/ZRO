import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { listShowcaseClientsAdmin } from "@/lib/queries/admin-content";
import { NewShowcaseClientButton, ShowcaseRowActions } from "../content-dialogs";
import { SiteTabs } from "../site-tabs";

export const metadata: Metadata = { title: "Clientes no site" };

export default async function SiteClientesPage() {
  await requireUser();
  const clients = await listShowcaseClientsAdmin();
  const published = clients.filter((c) => c.published);

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Site"
        title="Clientes no site"
        description={`Os nomes de “Quem confia na ZRO”, na página inicial. ${published.length} de ${clients.length} no site.`}
        actions={<NewShowcaseClientButton />}
      />
      <SiteTabs active="clientes" />

      <Card className="flex items-start gap-3 border-warn/30 p-5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <div className="text-[14px]">
          <p className="text-light">Confirme a autorização de cada cliente antes de publicar o nome.</p>
          <p className="mt-1 text-mute">
            Contrato de confidencialidade ou pedido do cliente valem mais que a vitrine. Na dúvida, deixe fora do site.
          </p>
        </div>
      </Card>

      {clients.length ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <ol className="divide-y divide-line">
              {clients.map((c, i) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[28px_minmax(0,1fr)_auto]"
                >
                  <span className="hidden font-mono text-[12px] text-mute tabular-nums lg:block">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className={c.published ? "text-[20px] font-semibold tracking-[-0.03em] text-white" : "text-[20px] font-semibold tracking-[-0.03em] text-white/40"}>
                      {c.name}
                    </p>
                    {c.published ? (
                      <Badge tone="ok" dot>
                        No site
                      </Badge>
                    ) : (
                      <Badge>Fora do site</Badge>
                    )}
                  </div>
                  <div className="-ml-1 lg:ml-0">
                    <ShowcaseRowActions client={{ id: c.id, name: c.name, published: c.published }} first={i === 0} last={i === clients.length - 1} />
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5 xl:col-span-4">
            <p className="label mb-4 text-mute">Como aparece no site</p>
            {published.length ? (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[26px] leading-tight font-semibold tracking-[-0.05em] text-white/40">
                {published.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-4">
                    {c.name}
                    {i < published.length - 1 ? <span className="size-1.5 rounded-full bg-white/20" aria-hidden /> : null}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-[14px] text-mute">Nenhum nome publicado: a seção “Quem confia na ZRO” não aparece.</p>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Nenhum cliente no site"
            description="Sem nomes publicados, a seção “Quem confia na ZRO” some da página inicial."
            action={<NewShowcaseClientButton />}
          />
        </Card>
      )}
    </div>
  );
}
