import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { dateBR, todayISO } from "@/lib/format";
import { getScript } from "@/lib/queries/documents";
import { getSetting } from "@/lib/settings";
import { PrintButton } from "../../../_tabs/documentos-client";
import { Paper, PaperFooter, PaperHeader, PaperLabel, PaperTable, PrintStyles } from "../../../_tabs/documentos-ui";
import { isShotKind, scriptKindLabel, wordCount } from "../../script-kinds";

export async function generateMetadata({ params }: PageProps<"/painel/projetos/[id]/roteiros/[scriptId]/imprimir">): Promise<Metadata> {
  await requireUser();
  const { id, scriptId } = await params;
  const data = await getScript(id, scriptId);
  return { title: data ? `${scriptKindLabel(data.script.kind)} · ${data.script.title} · ${data.project.code}` : "Roteiro" };
}

export default async function ScriptPrintPage({ params }: PageProps<"/painel/projetos/[id]/roteiros/[scriptId]/imprimir">) {
  await requireUser();
  const { id, scriptId } = await params;
  const [data, company] = await Promise.all([getScript(id, scriptId), getSetting("company")]);
  if (!data) notFound();
  const { project, script } = data;
  const shots = script.shots;
  const done = shots.filter((s) => s.done).length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PrintStyles />
      <div className="zro-no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/painel/projetos/${project.id}/roteiros/${script.id}`} className="label inline-flex items-center gap-2 text-mute hover:text-white">
          <ArrowLeft className="size-3.5" /> Voltar ao editor
        </Link>
        <PrintButton />
      </div>

      <Paper>
        <PaperHeader kind={scriptKindLabel(script.kind)} code={project.code} />
        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-paper-mute">{project.title}</p>
            <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.03em] sm:text-[30px]">{script.title}</h1>
          </div>
          <PaperLabel>
            {isShotKind(script.kind)
              ? `${shots.length} ${shots.length === 1 ? "plano" : "planos"} · ${done} ${done === 1 ? "feito" : "feitos"}`
              : `${wordCount(script.content)} palavras`}{" "}
            · versão de {dateBR(todayISO(script.updatedAt))}
          </PaperLabel>
        </div>

        <div className="mt-7 border-t border-paper-line pt-5">
          {isShotKind(script.kind) ? (
            shots.length ? (
              <PaperTable
                head={["#", "Cena", "Plano", "Descrição", "Lente", "Movimento", "Ok"]}
                widths={["5%", "8%", "15%", "38%", "11%", "17%", "6%"]}
                rows={shots.map((s, i) => [
                  <span key="n" className="font-mono text-[11px] text-paper-mute tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>,
                  <span key="c" className="font-mono">
                    {s.scene}
                  </span>,
                  <span key="p" className="font-medium">
                    {s.shot}
                  </span>,
                  s.description,
                  s.lens ?? "",
                  s.movement ?? "",
                  <span
                    key="d"
                    className="inline-grid size-3.5 place-items-center border border-paper-ink text-[10px] leading-none"
                    aria-label={s.done ? "Feito" : "A fazer"}
                  >
                    {s.done ? "✓" : ""}
                  </span>,
                ])}
              />
            ) : (
              <p className="text-[13px] text-paper-mute">Nenhum plano ainda.</p>
            )
          ) : (
            <div className="font-mono text-[12.5px] leading-[1.8] whitespace-pre-wrap">{script.content?.trim() || "Em branco."}</div>
          )}
        </div>

        <PaperFooter brand={company.brand} instagram={company.instagram} email={company.email} />
      </Paper>
    </div>
  );
}
