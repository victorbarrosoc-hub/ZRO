import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TabLinks } from "@/components/painel/bits";
import { requireUser } from "@/lib/auth/dal";
import { categoryLabel } from "@/lib/domain";
import { brl, dateBR, relativeDay, todayISO } from "@/lib/format";
import { getProject, getProjectFormOptions, getTaxRate, summarizeProject } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { DeleteProjectButton, DriveLinkButton, EditProjectButton, ProjectStatusMenu } from "../projeto-dialogs";
import { KeepActiveTabVisible } from "./_components/keep-tab-visible";
import { StageStepper } from "./_components/stage-stepper";
import { ProjectAgendaTab } from "./_tabs/agenda-tab";
import { ProjectDocumentsTab } from "./_tabs/documentos-tab";
import { ProjectDeliverablesTab } from "./_tabs/entregas-tab";
import { ProjectCrewTab } from "./_tabs/equipe-tab";
import { ProjectFinanceTab } from "./_tabs/financeiro-tab";
import { ProjectTasksTab } from "./_tabs/tarefas-tab";
import { ProjectOverviewTab } from "./_tabs/visao-tab";

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "tarefas", label: "Tarefas" },
  { key: "entregas", label: "Entregas" },
  { key: "equipe", label: "Equipe" },
  { key: "agenda", label: "Agenda" },
  { key: "financeiro", label: "Financeiro" },
  { key: "documentos", label: "Documentos" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: PageProps<"/painel/projetos/[id]">): Promise<Metadata> {
  await requireUser();
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.title ?? "Projeto" };
}

export default async function ProjetoPage({ params, searchParams }: PageProps<"/painel/projetos/[id]">) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const aba: TabKey = TABS.find((t) => t.key === sp.aba)?.key ?? "visao";
  const [project, options, taxRate] = await Promise.all([getProject(id), getProjectFormOptions(), getTaxRate()]);
  if (!project) notFound();

  const summary = summarizeProject(project, taxRate);
  const today = todayISO();
  const closed = project.status === "concluido" || project.status === "cancelado";
  const late = Boolean(project.dueDate && project.dueDate < today && !closed);
  const counts: Partial<Record<TabKey, number>> = {
    tarefas: project.tasks.length,
    entregas: project.deliverables.length,
    equipe: project.crew.length,
    financeiro: project.entries.length,
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <Link href="/painel/projetos" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Projetos
      </Link>

      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label text-mute">{project.code}</span>
            <ProjectStatusMenu id={project.id} status={project.status} />
          </div>
          <h1 className="mt-3 text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">{project.title}</h1>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            <Meta label="Cliente">
              {project.client ? (
                <Link href={`/painel/crm/clientes/${project.client.id}`} className="underline decoration-white/20 underline-offset-4 hover:text-white">
                  {project.client.name}
                </Link>
              ) : (
                <span className="text-mute">Sem cliente</span>
              )}
            </Meta>
            <Meta label="Categoria">{categoryLabel(project.category)}</Meta>
            <Meta label="Início">{dateBR(project.startDate)}</Meta>
            <Meta label="Prazo">
              {project.dueDate ? (
                <>
                  {dateBR(project.dueDate)}
                  {!closed ? (
                    <span className={cn("ml-2 text-[13px]", late ? "text-warn" : "text-mute")}>
                      {late ? `venceu ${relativeDay(project.dueDate, today)}` : relativeDay(project.dueDate, today)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-mute">Sem prazo</span>
              )}
            </Meta>
            <Meta label="Valor">{project.value ? brl(project.value) : <span className="text-mute">A definir</span>}</Meta>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <DriveLinkButton id={project.id} driveUrl={project.driveUrl} />
          <EditProjectButton
            options={options}
            defaults={{
              id: project.id,
              title: project.title,
              clientId: project.clientId,
              category: project.category,
              startDate: project.startDate,
              dueDate: project.dueDate,
              value: project.value,
            }}
          />
          <DeleteProjectButton id={project.id} title={project.title} />
        </div>
      </header>

      <StageStepper projectId={project.id} stage={project.stage} answers={project.creativeRule ?? null} />

      <div className="grid grid-cols-1 gap-5">
        <TabLinks
          active={aba}
          tabs={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: counts[t.key],
            href: `/painel/projetos/${project.id}${t.key === "visao" ? "" : `?aba=${t.key}`}`,
          }))}
        />
        <KeepActiveTabVisible active={aba} />

        {aba === "visao" ? <ProjectOverviewTab project={project} summary={summary} /> : null}
        {aba === "tarefas" ? <ProjectTasksTab project={project} templates={options.templates} /> : null}
        {aba === "entregas" ? <ProjectDeliverablesTab project={project} /> : null}
        {aba === "equipe" ? <ProjectCrewTab project={project} summary={summary} /> : null}
        {aba === "agenda" ? <ProjectAgendaTab projectId={project.id} /> : null}
        {aba === "financeiro" ? <ProjectFinanceTab project={project} summary={summary} /> : null}
        {aba === "documentos" ? <ProjectDocumentsTab projectId={project.id} /> : null}
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-mute">{label}</dt>
      <dd className="mt-1 text-[14px] text-light">{children}</dd>
    </div>
  );
}
