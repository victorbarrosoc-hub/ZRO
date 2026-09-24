/**
 * Aba "Agenda" do projeto. Implementada pelo módulo Agenda.
 * Contrato: componente de servidor que recebe o id do projeto.
 */
export async function ProjectAgendaTab({ projectId }: { projectId: string }) {
  return <p className="text-[14px] text-mute">Agenda do projeto {projectId} em construção.</p>;
}
