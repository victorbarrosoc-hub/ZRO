"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog as D } from "radix-ui";
import { ArrowUpRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { Logo, Symbol } from "@/components/brand/logo";
import { Avatar } from "@/components/painel/avatar";
import { Tip } from "@/components/ui/overlay";
import { logout } from "@/app/entrar/actions";
import { useLocalFlag } from "@/lib/use-local-flag";
import { cn } from "@/lib/utils";
import { PAINEL_NAV, isActive, type NavItem } from "./nav";

const STORAGE_KEY = "zro-sidebar-recolhida";

type ShellUser = { name: string; email: string; photoId?: string | null };

export function PainelShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalFlag(STORAGE_KEY);
  const [mobileOpen, setMobileOpen] = useState(false);
  const telaCheia = pathname === "/painel/pauta";

  function toggle() {
    setCollapsed(!collapsed);
  }

  return (
    <div className="relative min-h-dvh">
      <div className="zro-grain zro-grain--soft" aria-hidden />
      <div
        className="pointer-events-none fixed top-0 left-0 -z-0 h-[520px] w-[720px] bg-[radial-gradient(closest-side,rgb(255_255_255/0.035),transparent)]"
        aria-hidden
      />

      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-40 hidden flex-col rounded-[26px] border border-line bg-[linear-gradient(180deg,#131313,#0c0c0c)] shadow-[0_24px_80px_-24px_rgb(0_0_0/0.9)] transition-[width] duration-500 ease-out-expo lg:flex",
          collapsed ? "w-[76px]" : "w-[260px]",
        )}
        aria-label="Navegação da área interna"
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} user={user} onToggle={toggle} />
      </aside>

      {/* Topo (celular e tablet) */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-void/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/painel" className="flex items-center gap-2.5 text-white" aria-label="Visão geral">
          <Logo className="h-4" />
          <span className="label text-mute">Interno</span>
        </Link>
        <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <D.Trigger className="grid size-10 place-items-center rounded-full text-light hover:bg-white/[0.06]" aria-label="Abrir menu">
            <Menu className="size-5" />
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms]" />
            <D.Content className="fixed inset-y-2 left-2 z-[81] flex w-[min(300px,calc(100vw-16px))] flex-col rounded-[26px] border border-line-strong bg-ink data-[state=open]:animate-[sheet-in_300ms_cubic-bezier(0.16,1,0.3,1)] focus:outline-none">
              <D.Title className="sr-only">Menu</D.Title>
              <D.Description className="sr-only">Navegação da área interna</D.Description>
              <D.Close className="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-ash hover:bg-white/[0.08]" aria-label="Fechar menu">
                <X className="size-4" />
              </D.Close>
              <SidebarContent pathname={pathname} collapsed={false} user={user} onNavigate={() => setMobileOpen(false)} />
            </D.Content>
          </D.Portal>
        </D.Root>
      </div>

      <div className={cn("relative transition-[padding] duration-500 ease-out-expo", collapsed ? "lg:pl-[92px]" : "lg:pl-[276px]")}>
        <main
          className={cn(
            "mx-auto w-full px-4 pt-6 sm:px-6",
            // A Pauta ocupa a tela toda (colunas lado a lado, sem rolar para o lado)
            telaCheia ? "pb-4 lg:px-8 lg:pt-8" : "max-w-[1480px] pb-24 lg:px-10 lg:pt-10",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  collapsed,
  user,
  onToggle,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  user: ShellUser;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Recolher e abrir ficam no mesmo lugar: no topo */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-line",
          collapsed ? "flex-col justify-center gap-2 px-0 py-3" : "h-16 justify-between px-5",
        )}
      >
        <Link href="/painel" className="flex items-center gap-2.5 text-white" aria-label="Visão geral">
          {collapsed ? <Symbol className="size-6" /> : <Logo className="h-[15px]" />}
          {!collapsed ? <span className="label text-mute">Interno</span> : null}
        </Link>
        {onToggle && !collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="grid size-8 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light"
            aria-label="Recolher menu"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
        {onToggle && collapsed ? (
          <Tip content="Abrir menu" side="right">
            <button
              type="button"
              onClick={onToggle}
              className="grid size-8 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light"
              aria-label="Abrir menu"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </Tip>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none]">
        <ul className="grid gap-0.5">
          {PAINEL_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <div className="grid shrink-0 gap-3 border-t border-line p-3">
        {collapsed ? (
          <Tip content="Novo orçamento" side="right">
            <Link
              href="/painel/orcamentos/novo"
              className="mx-auto grid size-11 place-items-center rounded-2xl border border-dashed border-white/20 text-light transition-colors hover:border-white/50"
              aria-label="Novo orçamento"
            >
              <Plus className="size-4" />
            </Link>
          </Tip>
        ) : (
          <Link
            href="/painel/orcamentos/novo"
            onClick={onNavigate}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-4 text-center transition-colors hover:border-white/40 hover:bg-white/[0.02]"
          >
            <span className="grid size-8 place-items-center rounded-full bg-white text-void shadow-[0_0_24px_rgb(255_255_255/0.35)]">
              <Plus className="size-4" />
            </span>
            <span className="text-[13px] font-medium text-light">Novo orçamento</span>
          </Link>
        )}

        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "")}>
          {/* Foto e nome levam para o perfil (Ajustes → Minha conta) */}
          {collapsed ? (
            <Tip content="Editar perfil" side="right">
              <Link href="/painel/ajustes/conta" className="rounded-full" aria-label="Editar perfil">
                <Avatar name={user.name} imageId={user.photoId} className="size-9" />
              </Link>
            </Tip>
          ) : (
            <Link
              href="/painel/ajustes/conta"
              onClick={onNavigate}
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <Avatar name={user.name} imageId={user.photoId} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-light">{user.name}</span>
                <span className="block text-[12px] text-mute group-hover:text-light">Editar perfil</span>
              </span>
            </Link>
          )}
          <Tip content="Ver o site" side={collapsed ? "right" : "top"}>
            <Link
              href="/"
              target="_blank"
              className="grid size-8 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light"
              aria-label="Ver o site"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </Tip>
          <form action={logout}>
            <Tip content="Sair" side={collapsed ? "right" : "top"}>
              <button
                type="submit"
                className="grid size-8 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light"
                aria-label="Sair"
              >
                <LogOut className="size-4" />
              </button>
            </Tip>
          </form>
        </div>

      </div>
    </>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active && pathname === item.href ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-xl text-[14px] transition-colors duration-200",
        collapsed ? "mx-auto w-11 justify-center" : "px-3",
        active ? "bg-white/[0.07] text-white" : "text-ash hover:bg-white/[0.04] hover:text-light",
      )}
    >
      {active ? (
        <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-white shadow-[0_0_10px_rgb(255_255_255/0.8)]" aria-hidden />
      ) : null}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-mute group-hover:text-light")} strokeWidth={1.6} />
      {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tip content={item.label} side="right">
          {link}
        </Tip>
      ) : (
        link
      )}
      {!collapsed && active && item.children ? (
        <ul className="relative mt-0.5 mb-1 ml-[21px] grid gap-0.5 border-l border-line pl-3">
          {item.children.map((child) => {
            const inChild = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
            const childActive =
              child.href === item.href
                ? !item.children!.some((c) => c.href !== item.href && inChild(c.href))
                : inChild(child.href);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-8 items-center rounded-lg px-2.5 text-[13px] transition-colors",
                    childActive ? "bg-white/[0.06] text-white" : "text-mute hover:text-light",
                  )}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
