import { Symbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Faixa correndo com as frentes da ZRO, separadas pelo símbolo O. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (hidden?: boolean) => (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden}>
      {items.map((item) => (
        <span key={item} className="flex items-center gap-10">
          <span className="text-[clamp(28px,4.4vw,64px)] font-semibold tracking-[-0.04em] whitespace-nowrap text-white/90">
            {item}
          </span>
          <Symbol className="size-[clamp(18px,2.4vw,32px)] text-white/25" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={cn("group relative overflow-hidden border-y border-line py-8 sm:py-10", className)}>
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {row()}
        {row(true)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-void to-transparent" />
    </div>
  );
}
