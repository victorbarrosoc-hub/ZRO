import { TabLinks } from "@/components/painel/bits";

const TABS = [
  { key: "filmes", label: "Filmes", href: "/painel/site" },
  { key: "equipe", label: "Equipe", href: "/painel/site/equipe" },
  { key: "clientes", label: "Clientes no site", href: "/painel/site/clientes" },
  { key: "perguntas", label: "Perguntas frequentes", href: "/painel/site/perguntas" },
] as const;

export type SiteTab = (typeof TABS)[number]["key"];

/** Abas das telas de conteúdo do site. */
export function SiteTabs({ active, counts }: { active: SiteTab; counts?: Partial<Record<SiteTab, number>> }) {
  return <TabLinks active={active} tabs={TABS.map((t) => ({ ...t, count: counts?.[t.key] }))} />;
}
