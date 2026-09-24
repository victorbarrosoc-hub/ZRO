/**
 * Aba "Documentos" do projeto (ordens do dia, checklists, roteiros e shot lists).
 * Implementada pelo módulo Agenda + Documentos.
 * Contrato: componente de servidor que recebe o id do projeto.
 */
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardList, FileText, ListChecks, Printer } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/surface";
import { dateShort, monthShort, relativeDay, todayISO, weekdayShort } from "@/lib/format";
import { listProjectDocuments } from "@/lib/queries/documents";
import { cn } from "@/lib/utils";
import { newChecklist } from "../checklists/actions";
import { newCallSheet } from "../ordem-do-dia/actions";
import { isShotKind, scriptKindLabel } from "../roteiros/script-kinds";
import { NewDocButton, NewScriptMenu } from "./documentos-client";

export async function ProjectDocumentsTab({ projectId }: { projectId: string }) {
  const today = todayISO();
  const docs = await listProjectDocuments(projectId);
  const base = `/painel/projetos/${projectId}`;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="flex flex-col">
        <CardHeader
          title="Ordens do dia"
          description="Horários, local, equipe e contatos de cada diária."
          action={<NewDocButton action={newCallSheet} projectId={projectId} label="Nova" />}
        />
        {docs.callSheets.length ? (
          <ul className="mt-3 grid px-3 pb-3">
            {docs.callSheets.map((s) => {
              const past = s.date < today;
              return (
                <li key={s.id} className={cn("group flex items-center gap-1 rounded-2xl transition-colors hover:bg-white/[0.04]", past && "opacity-60")}>
                  <Link href={`${base}/ordem-do-dia/${s.id}`} className="flex min-w-0 flex-1 items-center gap-4 px-3 py-3">
                    <DateBlock iso={s.date} lit={s.date === today} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-light">{s.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-mute">
                        {[
                          s.callTime ? `Chegada ${s.callTime}` : null,
                          s.location,
                          s.crewCount ? `${s.crewCount} na equipe` : "Equipe vazia",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="label mt-1 block text-[10px] text-mute">{relativeDay(s.date, today)}</span>
                    </span>
                  </Link>
                  <Link
                    href={`${base}/ordem-do-dia/${s.id}/imprimir`}
                    className="mr-2 grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.08] hover:text-white"
                    aria-label={`Imprimir ${s.title}`}
                    title="Versão para imprimir"
                  >
                    <Printer className="size-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <DocEmpty icon={<FileText />} text="Nenhuma ordem do dia ainda. A nova já vem com a próxima diária do projeto e a equipe escalada." />
        )}
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          title="Checklists de equipamento"
          description="O que sai e o que volta de cada diária."
          action={<NewDocButton action={newChecklist} projectId={projectId} label="Novo" />}
        />
        {docs.checklists.length ? (
          <ul className="mt-3 grid px-3 pb-3">
            {docs.checklists.map((c) => {
              const late = c.missing > 0 && !!c.date && c.date < today;
              return (
                <li key={c.id}>
                  <Link
                    href={`${base}/checklists/${c.id}`}
                    className="flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong text-mute">
                      <ClipboardList className="size-5" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-light">{c.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-mute">
                        {c.date ? `${dateShort(c.date)} · ` : ""}
                        {c.total ? `${c.out} de ${c.total} saíram · ${c.back} voltaram` : "Sem itens ainda"}
                      </span>
                      {c.total ? (
                        <span className="mt-2 flex h-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                          <span className="h-full bg-white/80" style={{ width: `${(c.back / c.total) * 100}%` }} />
                          <span className="h-full bg-white/30" style={{ width: `${((c.out - c.back) / c.total) * 100}%` }} />
                        </span>
                      ) : null}
                      {late ? (
                        <span className="mt-2 flex items-center gap-1.5 text-[12px] text-warn">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          {c.missing} {c.missing > 1 ? "itens ainda não voltaram" : "item ainda não voltou"}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-mute" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <DocEmpty icon={<ClipboardList />} text="Nenhum checklist ainda. Monte a lista com os kits (Câmera A, Áudio, Luz, Drone) e confira no set." />
        )}
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          title="Roteiros e shot lists"
          description="Roteiro, decupagem e a lista de planos do set."
          action={<NewScriptMenu projectId={projectId} />}
        />
        {docs.scripts.length ? (
          <ul className="mt-3 grid px-3 pb-3">
            {docs.scripts.map((s) => (
              <li key={s.id}>
                <Link
                  href={`${base}/roteiros/${s.id}`}
                  className="flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong text-mute">
                    {isShotKind(s.kind) ? <ListChecks className="size-5" strokeWidth={1.6} /> : <FileText className="size-5" strokeWidth={1.6} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="label block text-[10px] text-mute">{scriptKindLabel(s.kind)}</span>
                    <span className="mt-0.5 block truncate text-[15px] font-medium text-light">{s.title}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-mute">
                      {isShotKind(s.kind)
                        ? s.shotCount
                          ? `${s.shotCount} plano${s.shotCount > 1 ? "s" : ""} · ${s.shotsDone} feito${s.shotsDone === 1 ? "" : "s"}`
                          : "Nenhum plano ainda"
                        : s.words
                          ? `${s.words} palavra${s.words > 1 ? "s" : ""}`
                          : "Em branco"}
                      {` · editado ${relativeDay(todayISO(s.updatedAt), today)}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-mute" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <DocEmpty icon={<FileText />} text="Nenhum roteiro ainda. Comece pelo texto ou vá direto para a lista de planos." />
        )}
      </Card>
    </div>
  );
}

function DateBlock({ iso, lit }: { iso: string; lit: boolean }) {
  return (
    <span
      className={cn(
        "grid w-12 shrink-0 justify-items-center rounded-xl py-1.5",
        lit ? "bg-white text-void shadow-[0_0_22px_rgb(255_255_255/0.35)]" : "border border-line-strong text-white",
      )}
    >
      <span className={cn("label text-[10px]", lit ? "text-void/70" : "text-mute")}>{weekdayShort(iso)}</span>
      <span className="text-[20px] leading-tight font-semibold">{Number(iso.slice(8, 10))}</span>
      <span className={cn("label text-[10px]", lit ? "text-void/70" : "text-mute")}>{monthShort(iso.slice(0, 7))}</span>
    </span>
  );
}

function DocEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-start gap-3 px-5 pt-5 pb-6 sm:px-6">
      <span className="grid size-10 place-items-center rounded-full border border-dashed border-white/20 text-mute [&_svg]:size-4">{icon}</span>
      <p className="max-w-sm text-[14px] text-mute">{text}</p>
    </div>
  );
}
