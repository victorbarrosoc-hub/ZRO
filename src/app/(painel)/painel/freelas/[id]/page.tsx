import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { EntryStatusBadge, InfoList, Table, Td, Th, whatsappHref } from "@/components/painel/bits";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { CATEGORIES, FUNCTIONS, RATE_UNITS, optionLabel } from "@/lib/domain";
import { brl, dateBR, entryStatus, initials, todayISO } from "@/lib/format";
import { getFreelancer } from "@/lib/queries/freelas";
import {
  AddRateButton,
  ArchiveFreelaButton,
  DeleteFreelaButton,
  DeleteRateButton,
  EditFreelaButton,
  PayEntryButton,
} from "../freela-dialogs";

export async function generateMetadata({ params }: PageProps<"/painel/freelas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const f = await getFreelancer(id);
  return { title: f?.name ?? "Freela" };
}

export default async function FreelaPage({ params }: PageProps<"/painel/freelas/[id]">) {
  await requireUser();
  const { id } = await params;
  const f = await getFreelancer(id);
  if (!f) notFound();

  const today = todayISO();
  const totalPaid = f.entries.reduce((s, e) => s + e.paidAmount, 0);
  const totalOpen = f.entries.reduce((s, e) => s + Math.max(0, e.amount - e.paidAmount), 0);
  const wa = whatsappHref(f.phone, `Oi, ${f.name.split(" ")[0]}! Tudo bem? Aqui é da ZRO.`);

  return (
    <div className="grid gap-8">
      <Link href="/painel/freelas" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Freelas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-[18px] font-medium text-light">
            {initials(f.name)}
          </span>
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] leading-none font-semibold tracking-[-0.035em] text-white">{f.name}</h1>
            <p className="mt-2 text-[14px] text-ash">
              {f.city ?? "Cidade não informada"}
              {!f.active ? " · arquivado" : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {f.functions.map((fn) => (
                <Badge key={fn}>{optionLabel(FUNCTIONS, fn)}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-medium text-void hover:bg-light">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          ) : null}
          {f.email ? (
            <a href={`mailto:${f.email}`} className="inline-flex h-8 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[13px] text-light hover:border-white/30">
              <Mail className="size-4" /> E-mail
            </a>
          ) : null}
          <EditFreelaButton
            defaults={{
              id: f.id,
              name: f.name,
              city: f.city,
              phone: f.phone,
              email: f.email,
              instagram: f.instagram,
              pixKey: f.pixKey,
              functions: f.functions,
              equipment: f.equipment,
              notes: f.notes,
            }}
          />
          <ArchiveFreelaButton id={f.id} active={f.active} />
          <DeleteFreelaButton id={f.id} name={f.name} />
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid content-start gap-4 xl:col-span-4">
          <Card>
            <CardHeader title="Contato e dados" />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={[
                  { label: "WhatsApp", value: f.phone },
                  { label: "E-mail", value: f.email },
                  { label: "Instagram", value: f.instagram ? `@${f.instagram}` : null },
                  { label: "Chave Pix", value: f.pixKey ? <span className="font-mono text-[13px] break-all">{f.pixKey}</span> : null },
                ]}
              />
            </div>
            {f.equipment || f.notes ? (
              <div className="grid gap-4 border-t border-line px-5 py-5 text-[14px] sm:px-6">
                {f.equipment ? (
                  <div>
                    <p className="label mb-1.5 text-mute">Equipamento</p>
                    <p className="text-ash">{f.equipment}</p>
                  </div>
                ) : null}
                {f.notes ? (
                  <div>
                    <p className="label mb-1.5 text-mute">Observações</p>
                    <p className="whitespace-pre-line text-ash">{f.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title="Valores padrão"
              description="Usados nos projetos e orçamentos."
              action={<AddRateButton freelancerId={f.id} functions={f.functions} />}
            />
            {f.rates.length ? (
              <ul className="mt-3 px-3 pb-3">
                {f.rates.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
                    <span className="min-w-0">
                      <span className="block text-[14px] text-light">{optionLabel(FUNCTIONS, r.function)}</span>
                      <span className="text-[12px] text-mute">
                        {r.category ? CATEGORIES.find((c) => c.key === r.category)?.short : "Qualquer job"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] text-white">
                        {brl(r.amount)} <span className="text-[12px] text-mute">{optionLabel(RATE_UNITS, r.unit)}</span>
                      </span>
                      <DeleteRateButton id={r.id} freelancerId={f.id} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nenhum valor padrão ainda.</p>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4 xl:col-span-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-[13px] text-ash">Jobs</p>
              <p className="mt-4 text-[28px] leading-none font-semibold text-white">{f.crew.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-[13px] text-ash">Já pago</p>
              <p className="mt-4 text-[28px] leading-none font-semibold text-white">{brl(totalPaid)}</p>
            </Card>
            <Card className={totalOpen ? "border-warn/25 p-5" : "p-5"}>
              <p className="text-[13px] text-ash">A pagar</p>
              <p className="mt-4 text-[28px] leading-none font-semibold text-white">{brl(totalOpen)}</p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Pagamentos" description="Lançamentos do financeiro ligados a este freela." />
            {f.entries.length ? (
              <Table className="mt-4" minWidth={620}>
                <thead>
                  <tr>
                    <Th>Descrição</Th>
                    <Th>Vencimento</Th>
                    <Th align="right">Valor</Th>
                    <Th align="right">Pago</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {f.entries.map((e) => {
                    const status = entryStatus(e, today);
                    return (
                      <tr key={e.id}>
                        <Td>
                          {e.projectId ? (
                            <Link href={`/painel/projetos/${e.projectId}?aba=financeiro`} className="hover:underline">
                              {e.description}
                            </Link>
                          ) : (
                            e.description
                          )}
                        </Td>
                        <Td className="text-ash">{dateBR(e.dueDate)}</Td>
                        <Td align="right">{brl(e.amount)}</Td>
                        <Td align="right" className="text-ash">
                          {brl(e.paidAmount)}
                        </Td>
                        <Td>
                          <EntryStatusBadge status={status} />
                        </Td>
                        <Td align="right">
                          {status !== "pago" ? <PayEntryButton entry={e} freelancerId={f.id} /> : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="Nenhum pagamento registrado" description="Ao escalar este freela num projeto, o pagamento aparece aqui." />
            )}
          </Card>

          <Card>
            <CardHeader title="Histórico de jobs" />
            {f.crew.length ? (
              <Table className="mt-4" minWidth={560}>
                <thead>
                  <tr>
                    <Th>Projeto</Th>
                    <Th>Função</Th>
                    <Th>Trabalho</Th>
                    <Th>Início</Th>
                    <Th align="right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {f.crew.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <Link href={`/painel/projetos/${c.projectId}?aba=equipe`} className="hover:underline">
                          {c.projectTitle}
                        </Link>
                        <span className="block font-mono text-[11px] text-mute">{c.projectCode}</span>
                      </Td>
                      <Td className="text-ash">{optionLabel(FUNCTIONS, c.function)}</Td>
                      <Td className="text-ash">{c.work ?? "—"}</Td>
                      <Td className="text-ash">{dateBR(c.startDate)}</Td>
                      <Td align="right">{brl(c.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="Ainda sem jobs" description="Os projetos em que este freela entrar aparecem aqui." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
