import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { monthLong } from "@/lib/format";
import { getCallSheetPrint } from "@/lib/queries/documents";
import { getSetting } from "@/lib/settings";
import { mapsSearchUrl, weekdayLong } from "@/app/(painel)/painel/agenda/agenda-utils";
import { CopyTextButton, PrintButton } from "../../../_tabs/documentos-client";
import {
  Paper,
  PaperFooter,
  PaperHeader,
  PaperLabel,
  PaperSection,
  PaperTable,
  PrintStyles,
} from "../../../_tabs/documentos-ui";
import { callSheetText } from "../../sheet-text";

export async function generateMetadata({ params }: PageProps<"/painel/projetos/[id]/ordem-do-dia/[sheetId]/imprimir">): Promise<Metadata> {
  await requireUser();
  const { id, sheetId } = await params;
  const data = await getCallSheetPrint(id, sheetId);
  return { title: data ? `Ordem do dia · ${data.sheet.title} · ${data.project.code}` : "Ordem do dia" };
}

export default async function CallSheetPrintPage({ params }: PageProps<"/painel/projetos/[id]/ordem-do-dia/[sheetId]/imprimir">) {
  await requireUser();
  const { id, sheetId } = await params;
  const [data, company] = await Promise.all([getCallSheetPrint(id, sheetId), getSetting("company")]);
  if (!data) notFound();
  const { project, sheet } = data;

  const mapUrl = sheet.locationUrl || (sheet.location ? mapsSearchUrl(sheet.location) : null);
  const [, mm, dd] = sheet.date.split("-");
  const text = callSheetText(sheet, project);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PrintStyles />

      <div className="zro-no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/painel/projetos/${project.id}/ordem-do-dia/${sheet.id}`}
          className="label inline-flex items-center gap-2 text-mute hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao editor
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <CopyTextButton text={text} />
          <PrintButton />
        </div>
      </div>

      <Paper>
        <PaperHeader kind="Ordem do dia" code={project.code} />

        <div className="mt-7">
          <p className="text-[13px] text-paper-mute">
            {project.title}
            {project.clientName && !project.title.toLowerCase().includes(project.clientName.toLowerCase()) ? ` · ${project.clientName}` : ""}
          </p>
          <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.03em] sm:text-[30px]">{sheet.title}</h1>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-paper-line pt-5 sm:grid-cols-[1fr_1fr_1.35fr]">
          <div className="zro-avoid-break">
            <PaperLabel>Data</PaperLabel>
            <p className="mt-2 text-[44px] leading-none font-semibold tracking-[-0.045em] tabular-nums sm:text-[54px]">
              {dd}.{mm}
            </p>
            <p className="mt-2 text-[12.5px] text-paper-ink">
              {weekdayLong(sheet.date)}
              <span className="text-paper-mute"> · {monthLong(sheet.date.slice(0, 7))}</span>
            </p>
          </div>
          <div className="zro-avoid-break">
            <PaperLabel>Chegada</PaperLabel>
            <p className="mt-2 text-[44px] leading-none font-semibold tracking-[-0.045em] tabular-nums sm:text-[54px]">
              {sheet.callTime ?? "—"}
            </p>
            <p className="mt-2 text-[12.5px] text-paper-mute">{sheet.callTime ? "horário da equipe no local" : "a definir"}</p>
          </div>
          <div className="zro-avoid-break col-span-2 sm:col-span-1">
            <PaperLabel>Local</PaperLabel>
            <p className="mt-2 text-[18px] leading-snug font-medium">{sheet.location ?? "A definir"}</p>
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-[10px] leading-relaxed break-all text-paper-mute underline decoration-paper-line underline-offset-2">
                {mapUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-7">
          {sheet.schedule.length ? (
            <PaperSection label="Cronograma">
              <PaperTable
                head={["Horário", "Atividade", "Observação"]}
                widths={["16%", "46%", "38%"]}
                rows={sheet.schedule.map((r) => [
                  <span key="t" className="font-mono text-[12px] font-medium tabular-nums">
                    {r.time || "—"}
                  </span>,
                  <span key="a" className="font-medium">
                    {r.activity}
                  </span>,
                  <span key="n" className="text-paper-mute">
                    {r.notes ?? ""}
                  </span>,
                ])}
              />
            </PaperSection>
          ) : null}

          {sheet.crew.length ? (
            <PaperSection label={`Equipe · ${sheet.crew.length}`}>
              <PaperTable
                head={["Nome", "Função", "Telefone", "Chegada"]}
                widths={["32%", "30%", "24%", "14%"]}
                rows={sheet.crew.map((c) => [
                  <span key="n" className="font-medium">
                    {c.name}
                  </span>,
                  c.role || "—",
                  <span key="p" className="tabular-nums">
                    {c.phone ?? ""}
                  </span>,
                  <span key="c" className={c.call ? "font-mono tabular-nums" : "font-mono text-paper-mute tabular-nums"}>
                    {c.call ?? sheet.callTime ?? "—"}
                  </span>,
                ])}
              />
            </PaperSection>
          ) : null}

          {sheet.contacts.length ? (
            <PaperSection label="Contatos">
              <PaperTable
                head={["Nome", "Quem é", "Telefone"]}
                widths={["32%", "44%", "24%"]}
                rows={sheet.contacts.map((c) => [
                  <span key="n" className="font-medium">
                    {c.name}
                  </span>,
                  c.role || "—",
                  <span key="p" className="tabular-nums">
                    {c.phone ?? ""}
                  </span>,
                ])}
              />
            </PaperSection>
          ) : null}

          {sheet.notes ? (
            <PaperSection label="Observações">
              <p className="text-[13px] leading-relaxed whitespace-pre-line">{sheet.notes}</p>
            </PaperSection>
          ) : null}
        </div>

        <PaperFooter brand={company.brand} instagram={company.instagram} email={company.email} />
      </Paper>
    </div>
  );
}
