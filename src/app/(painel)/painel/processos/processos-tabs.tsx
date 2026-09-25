import { TabLinks } from "@/components/painel/bits";

/** Abas de Processos: modelos de projeto e kits de equipamento. */
export function ProcessosTabs({ active, counts }: { active: "modelos" | "kits"; counts?: { templates: number; kits: number } }) {
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "modelos", label: "Modelos de projeto", href: "/painel/processos", count: counts?.templates },
        { key: "kits", label: "Kits de equipamento", href: "/painel/processos/kits", count: counts?.kits },
      ]}
    />
  );
}
