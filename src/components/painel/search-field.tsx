"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/** Busca que atualiza o ?q= da URL (a página no servidor filtra). */
export function SearchField({ placeholder = "Buscar", className, param = "q" }: { placeholder?: string; className?: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const current = params.get(param) ?? "";
      if (current === value) return;
      const next = new URLSearchParams(params.toString());
      if (value) next.set(param, value);
      else next.delete(param);
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    }, 280);
    return () => clearTimeout(t);
  }, [value, params, param, pathname, router]);

  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-full border border-line-strong bg-white/[0.03] pr-4 pl-10 text-[14px] text-light placeholder:text-mute focus:border-white/40 focus:outline-none",
          pending && "opacity-70",
        )}
      />
    </label>
  );
}
