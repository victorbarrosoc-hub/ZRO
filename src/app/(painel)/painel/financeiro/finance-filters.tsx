"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Filtro de projeto: troca o ?projeto= da URL (a página no servidor filtra). */
export function ProjectFilter({
  value,
  projects,
  className,
}: {
  value?: string;
  projects: { id: string; code: string; title: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    setSelected(next);
    const qs = new URLSearchParams(params.toString());
    if (next) qs.set("projeto", next);
    else qs.delete("projeto");
    startTransition(() => router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  }

  return (
    <div className={cn("w-full sm:w-72", className)}>
      <label htmlFor="filtro-projeto" className="sr-only">
        Projeto
      </label>
      <Select
        id="filtro-projeto"
        value={selected}
        onChange={(e) => change(e.target.value)}
        className={cn("h-10 rounded-full text-[14px]", selected ? "border-white/40 text-white" : "text-ash", pending && "opacity-70")}
      >
        <option value="">Todos os projetos</option>
        <option value="sem">Sem projeto</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.title}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * No celular, os filtros de tipo, status e projeto ficam atrás de um botão
 * (com a contagem dos ativos). Do tablet para cima, sempre à mostra.
 */
export function FilterDrawer({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] transition-colors md:hidden",
          open || active ? "border-white/40 text-white" : "border-line-strong text-ash",
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
        {active ? (
          <span className="grid size-5 place-items-center rounded-full bg-white text-[11px] font-medium text-void tabular-nums">{active}</span>
        ) : null}
      </button>
      <div id={id} className={cn("min-w-0 basis-full flex-wrap items-center gap-2 md:flex", open ? "flex" : "hidden")}>
        {children}
      </div>
    </>
  );
}
