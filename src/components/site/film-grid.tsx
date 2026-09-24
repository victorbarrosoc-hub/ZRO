"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { FilmCard, type FilmSummary } from "./film-card";

export function FilmGrid({
  films,
  limit,
  initialCategory = "todos",
}: {
  films: FilmSummary[];
  limit?: number;
  initialCategory?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(initialCategory);

  const available = useMemo(
    () => CATEGORIES.filter((c) => films.some((f) => f.category === c.key)),
    [films],
  );

  const visible = useMemo(() => {
    const list = active === "todos" ? films : films.filter((f) => f.category === active);
    return limit ? list.slice(0, limit) : list;
  }, [films, active, limit]);

  return (
    <div>
      <div className="-mx-5 mb-10 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Filtrar por categoria">
        {[{ key: "todos", label: "Todos" }, ...available].map((c) => {
          const selected = active === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(c.key)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-[14px] transition-all duration-300",
                selected
                  ? "border-white bg-white text-void"
                  : "border-line-strong text-ash hover:border-white/40 hover:text-white",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <motion.ul layout={!reduced} className="grid gap-x-6 gap-y-12 md:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((film, i) => (
            <motion.li
              key={film.id}
              className={visible.length % 2 === 1 && i === 0 ? "md:col-span-2" : undefined}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={reduced ? undefined : { opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <FilmCard film={film} priority={i < 2} aspect={visible.length % 2 === 1 && i === 0 ? "aspect-[16/10] md:aspect-[21/9]" : undefined} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-mute">Nenhum filme nesta categoria ainda.</p>
      ) : null}
    </div>
  );
}
