import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StatTile } from "@/components/painel/stat";
import { Card, CardHeader } from "@/components/ui/surface";
import { stageInfo } from "@/lib/domain";
import { brl } from "@/lib/format";
import type { ProjectDetail, ProjectSummary } from "@/lib/queries/projects";
import { EditBriefingButton } from "../_components/briefing-dialog";
import { CreativeRuleForm } from "../_components/creative-rule-form";
import { percent } from "../_components/meter";
import { StageStepper } from "../_components/stage-stepper";
import { StageChecklist } from "../_components/task-board";

/** Aba "Visão geral": números do projeto, briefing, tarefas da etapa e a regra criativa. */
export function ProjectOverviewTab({ project, summary }: { project: ProjectDetail; summary: ProjectSummary }) {
  const stage = stageInfo(project.stage);
  const stageTasks = project.tasks
    .filter((t) => t.stage === project.stage)
    .map((t) => ({ id: t.id, stage: t.stage, title: t.title, done: t.done }));
  const { tasks, deliverables, crew, finance } = summary;
  const tab = (aba: string) => `/painel/projetos/${project.id}?aba=${aba}`;
  const tileLink = "group block rounded-[22px] focus-visible:outline-offset-4";
  const tileHover = "h-full transition-colors duration-300 group-hover:border-white/20";

  return (
    <div className="grid grid-cols-1 gap-4">
      <StageStepper projectId={project.id} stage={project.stage} answers={project.creativeRule ?? null} />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Resumo do projeto">
        <Link href={tab("tarefas")} scroll={false} className={tileLink}>
          <StatTile
            className={tileHover}
            label="Tarefas"
            value={`${tasks.pct}%`}
            sub={tasks.total ? `${tasks.done} de ${tasks.total}` : "Nenhuma ainda"}
          />
        </Link>
        <Link href={tab("entregas")} scroll={false} className={tileLink}>
          <StatTile
            className={tileHover}
            label="Entregas"
            value={`${deliverables.delivered} de ${deliverables.total}`}
            sub={
              deliverables.total
                ? `entregues${deliverables.withClient ? ` · ${deliverables.withClient} com o cliente` : ""}`
                : "Nenhuma ainda"
            }
          />
        </Link>
        <Link href={tab("equipe")} scroll={false} className={tileLink}>
          <StatTile
            className={tileHover}
            label="Equipe"
            value={brl(finance.breakdown.crew.total)}
            sub={
              finance.breakdown.crew.open
                ? `falta pagar ${brl(finance.breakdown.crew.open)}`
                : crew.people
                  ? `${crew.people} pessoa${crew.people > 1 ? "s" : ""}, tudo pago`
                  : "Ninguém ainda"
            }
          />
        </Link>
        <Link href={tab("financeiro")} scroll={false} className={tileLink}>
          <StatTile
            className={tileHover}
            tone={finance.contracted > 0 && finance.margin < 0 ? "danger" : "default"}
            label="Margem"
            value={finance.contracted > 0 ? brl(finance.margin) : "—"}
            sub={finance.contracted > 0 ? `${percent(finance.marginPct)} do valor` : "Sem valor contratado"}
          />
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 xl:col-span-5">
          <Card>
            <CardHeader title="Briefing" action={<EditBriefingButton id={project.id} briefing={project.briefing} notes={project.notes} />} />
            <div className="px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
              {project.briefing ? (
                <p className="text-[15px] leading-relaxed whitespace-pre-line text-ash">{project.briefing}</p>
              ) : (
                <p className="text-[14px] text-mute">Sem briefing ainda.</p>
              )}
              {project.notes ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="label mb-1.5 text-mute">Observações internas</p>
                  <p className="text-[14px] leading-relaxed whitespace-pre-line text-ash">{project.notes}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={`Nesta etapa · ${stage.label}`}
              description={stage.hint}
              action={
                <Link href={tab("tarefas")} scroll={false} className="flex items-center gap-1 text-[13px] text-ash hover:text-white">
                  Todas <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
            {stageTasks.length ? (
              <div className="px-3 pt-2 pb-3">
                <StageChecklist tasks={stageTasks} />
              </div>
            ) : (
              <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nenhuma tarefa em {stage.label}.</p>
            )}
          </Card>
        </div>

        <Card id="regra-criativa" className="scroll-mt-24 xl:col-span-7">
          <CardHeader title="Regra criativa" />
          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
            <CreativeRuleForm projectId={project.id} answers={project.creativeRule ?? null} collapsible />
          </div>
        </Card>
      </div>
    </div>
  );
}
