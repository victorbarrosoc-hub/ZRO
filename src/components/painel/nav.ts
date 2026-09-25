import {
  CalendarDays,
  Clapperboard,
  Contact,
  FileText,
  Globe,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
};

export const PAINEL_NAV: NavItem[] = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard },
  {
    href: "/painel/crm",
    label: "CRM",
    icon: Contact,
    children: [
      { href: "/painel/crm", label: "Leads" },
      { href: "/painel/crm/clientes", label: "Clientes" },
    ],
  },
  { href: "/painel/projetos", label: "Projetos", icon: Clapperboard },
  { href: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/painel/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/painel/freelas", label: "Freelas", icon: Users },
  {
    href: "/painel/financeiro",
    label: "Financeiro",
    icon: Wallet,
    children: [
      { href: "/painel/financeiro", label: "Lançamentos" },
      { href: "/painel/financeiro/fluxo", label: "Fluxo e resultado" },
      { href: "/painel/financeiro/impostos", label: "Impostos" },
    ],
  },
  {
    href: "/painel/processos",
    label: "Processos",
    icon: Workflow,
    children: [
      { href: "/painel/processos", label: "Modelos de projeto" },
      { href: "/painel/processos/kits", label: "Kits de equipamento" },
    ],
  },
  {
    href: "/painel/site",
    label: "Site",
    icon: Globe,
    children: [
      { href: "/painel/site", label: "Filmes" },
      { href: "/painel/site/equipe", label: "Equipe" },
      { href: "/painel/site/clientes", label: "Clientes no site" },
      { href: "/painel/site/perguntas", label: "Perguntas frequentes" },
    ],
  },
  { href: "/painel/ajustes", label: "Ajustes", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  if (href === "/painel") return pathname === "/painel";
  return pathname === href || pathname.startsWith(`${href}/`);
}
