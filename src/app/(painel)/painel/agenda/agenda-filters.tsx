"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

/** Seletor de filtro que grava o valor na URL (a página filtra no servidor). */
export function FilterSelect({
  param,
  value,
  label,
  allLabel,
  options,
  className,
}: {
  param: string;
  value?: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = !!value;

  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          next.delete("evento");
          const qs = next.toString();
          startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
        }}
        className={cn(
          "h-10 w-full max-w-full cursor-pointer appearance-none truncate rounded-full border pr-9 pl-4 text-[13px] transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          active
            ? "border-white bg-white text-void"
            : "border-line-strong bg-white/[0.02] text-ash hover:border-white/30 hover:text-light",
          pending && "opacity-70",
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cn("pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2", active ? "text-void" : "text-ash")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </label>
  );
}
