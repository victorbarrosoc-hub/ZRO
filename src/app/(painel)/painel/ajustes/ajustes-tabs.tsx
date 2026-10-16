import { TabLinks } from "@/components/painel/bits";

/** Abas de Ajustes. */
export function AjustesTabs({ active }: { active: "geral" | "catalogo" | "conta" | "dados" | "google" }) {
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "geral", label: "Empresa e site", href: "/painel/ajustes" },
        { key: "catalogo", label: "Catálogo de preços", href: "/painel/ajustes/catalogo" },
        { key: "conta", label: "Minha conta", href: "/painel/ajustes/conta" },
        { key: "dados", label: "Dados e backup", href: "/painel/ajustes/dados" },
        { key: "google", label: "Google Drive", href: "/painel/ajustes/google" },
      ]}
    />
  );
}
