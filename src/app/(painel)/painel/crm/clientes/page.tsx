import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/painel/avatar";
import { Table, Td, Th } from "@/components/painel/bits";
import { SearchField } from "@/components/painel/search-field";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { brl } from "@/lib/format";
import { filterClients, listClients } from "@/lib/queries/crm";
import { ClientRowMenu, NewClientButton } from "../crm-dialogs";
import { formatDocument } from "../crm-options";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/painel/crm/clientes">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const all = await listClients();
  const clients = filterClients(all, q);

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        label="CRM"
        title="Clientes"
        actions={<NewClientButton />}
      />

      <SearchField placeholder="Buscar nome, segmento, cidade ou contato" className="w-full sm:w-96" />

      {clients.length ? (
        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:hidden" aria-label="Clientes">
          {clients.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1 rounded-[18px] border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.05),rgb(255_255_255/0.018))] py-2 pr-1.5 pl-4"
            >
              <Link
                href={`/painel/crm/clientes/${c.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-[14px] py-2 transition-colors active:bg-white/[0.04]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} imageId={c.logoId} logo size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-white">{c.name}</span>
                    <span className="block truncate text-[13px] text-mute">
                      {[c.segment, c.city].filter(Boolean).join(" · ") || "Sem segmento"}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={c.received ? "block text-[14px] text-light" : "block text-[14px] text-mute"}>
                    {brl(c.received)}
                  </span>
                  <span className="block text-[12px] text-mute">
                    {c.projectCount} projeto{c.projectCount === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
              <ClientRowMenu id={c.id} name={c.name} />
            </li>
          ))}
        </ul>
      ) : null}

      {clients.length ? (
        <Card className="hidden min-w-0 sm:block">
          <Table minWidth={820} className="pt-1">
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Segmento</Th>
                <Th>Cidade</Th>
                <Th>Contato</Th>
                <Th align="right">Projetos</Th>
                <Th align="right">Recebido</Th>
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td className="max-w-80">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.name} imageId={c.logoId} logo size="md" />
                      <div className="min-w-0">
                        <Link href={`/painel/crm/clientes/${c.id}`} className="block truncate font-medium text-white hover:underline">
                          {c.name}
                        </Link>
                        {c.document ? (
                          <span className="block font-mono text-[11px] text-mute">{formatDocument(c.document)}</span>
                        ) : null}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-ash">{c.segment ?? "—"}</Td>
                  <Td className="text-ash">{c.city ?? "—"}</Td>
                  <Td className="text-ash">
                    {c.contactName || c.phone || c.email ? (
                      <>
                        <span className="block">{c.contactName ?? c.phone ?? c.email}</span>
                        {c.contactName && (c.phone || c.email) ? (
                          <span className="block text-[12px] text-mute">{c.phone ?? c.email}</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td align="right" className={c.projectCount ? "" : "text-mute"}>
                    {c.projectCount}
                  </Td>
                  <Td align="right" className={c.received ? "" : "text-mute"}>
                    {brl(c.received)}
                  </Td>
                  <Td align="right" className="w-12 py-2">
                    <ClientRowMenu id={c.id} name={c.name} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            action={q ? undefined : <NewClientButton />}
          />
        </Card>
      )}
    </div>
  );
}
