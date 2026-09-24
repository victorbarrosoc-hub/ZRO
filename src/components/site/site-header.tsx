"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/filmes", label: "Filmes" },
  { href: "/sobre", label: "Sobre" },
  { href: "/absolute", label: "Absolute ZRO" },
  { href: "/#contato", label: "Contato" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "absolute inset-0 border-b transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled || open
            ? "border-line bg-void/70 backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent",
        )}
        aria-hidden
      />
      <div className="container-zro relative flex h-16 items-center justify-between gap-6">
        <Link href="/" className="relative z-10 -m-2 p-2 text-white" aria-label="ZRO Filmes, início">
          <Logo className="h-[18px]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {NAV.map((item) => {
            const active = item.href !== "/#contato" && pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[14px] transition-colors duration-300",
                  active ? "text-white" : "text-ash hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/orcamento"
            className="hidden h-9 items-center rounded-full bg-white px-4 text-[13px] font-medium text-void transition-colors hover:bg-light sm:inline-flex"
          >
            Começar um projeto
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="relative z-10 grid size-10 place-items-center rounded-full md:hidden"
            aria-expanded={open}
            aria-controls="menu-celular"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            <span className="relative block h-3 w-5">
              <span
                className={cn(
                  "absolute left-0 block h-px w-5 bg-white transition-transform duration-500 ease-out-expo",
                  open ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-px w-5 bg-white transition-transform duration-500 ease-out-expo",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="menu-celular"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-16 bg-void/95 backdrop-blur-xl md:hidden"
          >
            <nav className="container-zro flex h-full flex-col pt-8 pb-10" aria-label="Menu">
              <ul className="grid gap-1">
                {[{ href: "/", label: "Início" }, ...NAV].map((item, i) => (
                  <motion.li
                    key={item.href}
                    initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block py-2 text-[40px] leading-tight font-semibold tracking-[-0.04em] text-white"
                    >
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto grid gap-6">
                <Link
                  href="/orcamento"
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center justify-center rounded-full bg-white text-[16px] font-medium text-void"
                >
                  Começar um projeto
                </Link>
                <p className="label text-center text-mute">Onde tudo começa e o comum termina.</p>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
