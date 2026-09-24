/**
 * Aba "Documentos" do projeto (ordens do dia, checklists, roteiros e shot lists).
 * Implementada pelo módulo Agenda + Documentos.
 * Contrato: componente de servidor que recebe o id do projeto.
 */
export async function ProjectDocumentsTab({ projectId }: { projectId: string }) {
  return <p className="text-[14px] text-mute">Documentos do projeto {projectId} em construção.</p>;
}
