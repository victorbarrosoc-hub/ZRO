"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string; href: string; count?: number };

/**
 * Abas de plataforma: linha de base de ponta a ponta e o traço branco na aba ativa.
 * O traço desliza até a aba tocada na hora do toque (sem esperar a página chegar).
 */
export function TabLinks({ tabs, active, className }: { tabs: Tab[]; active: string; className?: string }) {
  // aba tocada enquanto a página nova não chega; vale só enquanto o servidor ainda diz `active`
  const [tocada, setTocada] = useState<{ de: string; para: string } | null>(null);
  const atual = tocada && tocada.de === active ? tocada.para : active;
  const ulRef = useRef<HTMLUListElement>(null);
  const tracoRef = useRef<HTMLSpanElement>(null);
  const primeira = useRef(true);
  const navRef = useRef<HTMLElement>(null);
  const antes = useRef(active);

  useLayoutEffect(() => {
    const ul = ulRef.current;
    const traco = tracoRef.current;
    if (!ul || !traco) return;
    const medir = () => {
      const a = [...ul.querySelectorAll<HTMLElement>("[data-tab]")].find((el) => el.dataset.tab === atual);
      if (!a) {
        traco.style.opacity = "0";
        return;
      }
      const cs = getComputedStyle(a);
      const esq = a.offsetLeft + parseFloat(cs.paddingLeft);
      const larg = a.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      traco.style.transition = primeira.current ? "none" : "";
      traco.style.opacity = "1";
      traco.style.transform = `translateX(${esq}px)`;
      traco.style.width = `${Math.max(0, larg)}px`;
      primeira.current = false;
    };
    medir();
    addEventListener("resize", medir);
    return () => removeEventListener("resize", medir);
  }, [atual, tabs]);

  // a aba mudou de verdade (a página respondeu): o conteúdo abaixo das abas entra com movimento
  useLayoutEffect(() => {
    if (antes.current === active) return;
    antes.current = active;
    const nav = navRef.current;
    if (!nav || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pagina = nav.closest(".zro-pagina");
    for (let el: Element | null = nav; el && el !== pagina; el = el.parentElement) {
      for (let irmao = el.nextElementSibling; irmao; irmao = irmao.nextElementSibling) {
        irmao.animate?.([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
          duration: 320,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        });
      }
    }
  }, [active]);

  return (
    <nav
      ref={navRef}
      className={cn(
        "-mx-4 min-w-0 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] sm:mx-0 sm:px-0",
        className,
      )}
      aria-label="Seções"
    >
      <ul ref={ulRef} className="relative flex w-max gap-1 sm:gap-2 [&>li:first-child>a]:pl-0">
        {tabs.map((t) => {
          const on = t.key === atual;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                data-tab={t.key}
                aria-current={t.key === active ? "page" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  if (t.key !== active) setTocada({ de: active, para: t.key });
                }}
                className={cn(
                  "relative flex h-12 items-center gap-2 px-3 text-[14px] whitespace-nowrap transition-colors duration-300 sm:px-3.5",
                  on ? "font-medium text-white" : "text-mute hover:text-light",
                )}
              >
                {t.label}
                {t.count != null ? (
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums transition-colors duration-300",
                      on ? "bg-white text-void" : "bg-white/[0.07] text-ash",
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        <span
          ref={tracoRef}
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-full bg-white opacity-0 transition-[transform,width] duration-[420ms] ease-out-expo"
        />
      </ul>
    </nav>
  );
}
