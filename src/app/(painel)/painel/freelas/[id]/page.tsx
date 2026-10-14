import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Avatar } from "@/components/painel/avatar";
import { EntryStatusBadge, InfoList, TabLinks, Table, Td, Th, whatsappHref, WhatsAppButton } from "@/components/painel/bits";
import { StatTile } from "@/components/painel/stat";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { CATEGORIES, EQUIPMENT_CATEGORIES, FUNCTIONS, RATE_UNITS, freelaWhatsappText, optionLabel } from "@/lib/domain";
import { addDaysISO, brl, brlCompact, dateBR, dateShort, entryStatus, formatDocument, formatPhone, instagramUrl, todayISO } from "@/lib/format";
import { listEventsInRange } from "@/lib/queries/agenda";
import { getFreelancer, listCustomFunctions, listEquipmentCatalog } from "@/lib/queries/freelas";
import {
  AddRateButton,
  ArchiveFreelaButton,
  DeleteFreelaButton,
  DeleteRateButton,
  EditFreelaButton,
  PayEntryButton,
  WhatsappMessageButton,
} from "../freela-dialogs";
import { CopyTextButton } from "../../projetos/[id]/_tabs/documentos-client";

export async function generateMetadata({ params }: PageProps<"/painel/freelas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const f = await getFreelancer(id);
  return { title: f?.name ?? "Freela" };
}

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "jobs", label: "Jobs" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function FreelaPage({ params, searchParams }: PageProps<"/painel/freelas/[id]">) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const aba: TabKey = TABS.find((t) => t.key === sp.aba)?.key ?? "resumo";
  const f = await getFreelancer(id);
  if (!f) notFound();

  const today = todayISO();
  const [agenda, customFunctions, equipmentCatalog] = await Promise.all([
    listEventsInRange({ start: today, end: addDaysISO(today, 120), freelancerId: f.id }),
    listCustomFunctions(),
    listEquipmentCatalog(),
  ]);
  const gearGroups = EQUIPMENT_CATEGORIES.map((c) => ({ ...c, items: f.gear.filter((g) => g.category === c.key) })).filter(
    (g) => g.items.length,
  );
  const late = f.entries.filter((e) => e.dueDate < today).reduce((s, e) => s + Math.max(0, e.amount - e.paidAmount), 0);
  const counts: Partial<Record<TabKey, number>> = { pagamentos: f.entries.length, jobs: f.crew.length };
  const totalPaid = f.entries.reduce((s, e) => s + e.paidAmount, 0);
  const totalOpen = f.entries.reduce((s, e) => s + Math.max(0, e.amount - e.paidAmount), 0);
  const wa = whatsappHref(f.phone, freelaWhatsappText(f.whatsappMessage, f.name));

  return (
    <div className="grid gap-8">
      <Link href="/painel/freelas" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Freelas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-5">
          <Avatar name={f.name} imageId={f.photoId} size="xl" />
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
          <WhatsAppButton href={wa} />
          <WhatsappMessageButton id={f.id} name={f.name} message={f.whatsappMessage} />
          {f.email ? (
            <a
              href={`mailto:${f.email}`}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[13px] text-light hover:border-white/30"
            >
              <Mail className="size-4" /> E-mail
            </a>
          ) : null}
          {f.document ? (
            <CopyTextButton
              text={`${f.name}\nCPF: ${formatDocument(f.document)}`}
              label="Copiar nome e CPF"
              done="Nome completo e CPF copiados."
            />
          ) : null}
          <EditFreelaButton
            defaults={{
              id: f.id,
              name: f.name,
              city: f.city,
              phone: f.phone,
              email: f.email,
              instagram: f.instagram,
              document: f.document,
              pixKey: f.pixKey,
              functions: f.functions,
              equipment: f.gear,
              notes: f.notes,
              photoId: f.photoId,
            }}
            customFunctions={customFunctions}
            equipmentCatalog={equipmentCatalog}
          />
          <ArchiveFreelaButton id={f.id} active={f.active} />
          <DeleteFreelaButton id={f.id} name={f.name} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <TabLinks
          active={aba}
          tabs={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: counts[t.key],
            href: `/painel/freelas/${f.id}${t.key === "resumo" ? "" : `?aba=${t.key}`}`,
          }))}
        />

        {aba === "resumo" ? (
          <div className="grid grid-cols-1 gap-4">
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Resumo">
              <StatTile label="Jobs" value={f.crew.length} />
              <StatTile label="Pago" value={brlCompact(totalPaid)} />
              <StatTile
                className="col-span-2 sm:col-span-1"
                label="A pagar"
                value={brlCompact(totalOpen)}
                sub={late ? `${brlCompact(late)} vencido` : undefined}
                tone={late ? "danger" : "default"}
              />
            </section>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
              <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-7">
                <Card>
                  <CardHeader title="Próximas diárias" />
                  {agenda.length ? (
                    <ul className="mt-3 px-3 pb-3">
                      {agenda.map((ev) => (
                        <li key={ev.id}>
                          <Link
                            href={ev.projectId ? `/painel/projetos/${ev.projectId}?aba=agenda` : "/painel/agenda"}
                            className="flex items-center gap-4 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                          >
                            <span className="w-14 shrink-0 text-[13px] font-medium text-white tabular-nums">{dateShort(ev.date)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] text-light">{ev.title}</span>
                              <span className="block truncate text-[12px] text-mute">
                                {[ev.projectTitle, ev.startTime, ev.location].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nada marcado.</p>
                  )}
                </Card>
                <Card>
                  <CardHeader title="Valores padrão" action={<AddRateButton freelancerId={f.id} functions={f.functions} />} />
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
                <Card>
                  <CardHeader
                    title="Equipamento"
                    action={
                      <Link href="/painel/freelas/equipamentos" className="label text-mute hover:text-white">
                        Banco de equipamentos
                      </Link>
                    }
                  />
                  {gearGroups.length ? (
                    <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6">
                      {gearGroups.map((g) => (
                        <div key={g.key} className="grid gap-2">
                          <p className="label text-mute">{g.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {g.items.map((item) => (
                              <Link
                                key={item.id}
                                href={`/painel/freelas?q=${encodeURIComponent(item.name)}`}
                                title={`Quem mais tem ${item.name}`}
                                className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13px] text-light transition-colors hover:border-white/40"
                              >
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : f.equipment ? (
                    <p className="px-5 pt-3 pb-5 text-[14px] text-ash sm:px-6">{f.equipment}</p>
                  ) : (
                    <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nenhum equipamento ainda.</p>
                  )}
                </Card>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-5">
                <Card>
                  <CardHeader title="Contato e dados" />
                  <div className="px-5 pb-2 sm:px-6">
                    <InfoList
                      items={[
                        {
                          label: "CPF",
                          value: f.document ? <span className="font-mono text-[13px]">{formatDocument(f.document)}</span> : null,
                        },
                        {
                          label: "WhatsApp",
                          value: formatPhone(f.phone) ? (
                            <a href={wa ?? undefined} target="_blank" rel="noreferrer" className="hover:underline">
                              {formatPhone(f.phone)}
                            </a>
                          ) : null,
                        },
                        { label: "E-mail", value: f.email },
                        {
                          label: "Instagram",
                          value: f.instagram ? (
                            <a href={instagramUrl(f.instagram) ?? undefined} target="_blank" rel="noreferrer" className="hover:underline">
                              @{f.instagram}
                            </a>
                          ) : null,
                        },
                        {
                          label: "Chave Pix",
                          value: f.pixKey ? <span className="font-mono text-[13px] break-all">{f.pixKey}</span> : null,
                        },
                      ]}
                    />
                  </div>
                  {f.notes ? (
                    <div className="grid gap-4 border-t border-line px-5 py-5 text-[14px] sm:px-6">
                      {f.notes ? (
                        <div>
                          <p className="label mb-1.5 text-mute">Observações</p>
                          <p className="whitespace-pre-line text-ash">{f.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              </div>
            </div>
          </div>
        ) : null}

        {aba === "pagamentos" ? (
          <Card>
            <CardHeader title="Pagamentos" />
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
                        <Td align="right">{status !== "pago" ? <PayEntryButton entry={e} freelancerId={f.id} /> : null}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="Nenhum pagamento ainda" />
            )}
          </Card>
        ) : null}

        {aba === "jobs" ? (
          <Card>
            <CardHeader title="Jobs" />
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
              <EmptyState title="Ainda sem jobs" />
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
