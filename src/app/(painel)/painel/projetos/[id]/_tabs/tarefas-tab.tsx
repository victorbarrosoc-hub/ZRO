import { Card } from "@/components/ui/surface";
import type { ProjectDetail, ProjectFormOptions } from "@/lib/queries/projects";
import { TaskBoard } from "../_components/task-board";

/** Aba "Tarefas": checklist do processo, etapa por etapa. */
export function ProjectTasksTab({ project, templates }: { project: ProjectDetail; templates: ProjectFormOptions["templates"] }) {
  return (
    <Card className="pb-2">
      <TaskBoard
        projectId={project.id}
        category={project.category}
        currentStage={project.stage}
        tasks={project.tasks.map((t) => ({ id: t.id, stage: t.stage, title: t.title, done: t.done }))}
        templates={templates}
      />
    </Card>
  );
}
