"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "A luz revela": o conteúdo entra saindo do desfoque e do escuro,
 * quase sem deslizar.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  as = "div",
  amount = 0.25,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "p" | "h2" | "span" | "article";
  amount?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const Comp = motion[as];
  if (reduced) {
    const Static = as;
    return <Static className={className}>{children}</Static>;
  }
  return (
    <Comp
      className={cn(className)}
      initial={{ opacity: 0, y, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount }}
      transition={{ duration: 1.1, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/** Linhas de título que acendem uma depois da outra ao carregar a página. */
export function LitLines({
  lines,
  className,
  lineClassName,
  delay = 0,
  stagger = 0.14,
}: {
  lines: React.ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <span className={cn("block", className)}>
      {lines.map((line, i) =>
        reduced ? (
          <span key={i} className={cn("block", lineClassName)}>
            {line}
          </span>
        ) : (
          <motion.span
            key={i}
            className={cn("block", lineClassName)}
            initial={{ opacity: 0, y: 18, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.4, delay: delay + i * stagger, ease: EASE }}
          >
            {line}
          </motion.span>
        ),
      )}
    </span>
  );
}
