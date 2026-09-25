import { cn } from "@/lib/utils";

/** O ponto de luz: um pixel de branco com halo, pulsando devagar. */
export function LightPoint({ className, size = 6 }: { className?: string; size?: number }) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)} aria-hidden>
      <span
        className="absolute rounded-full bg-white/20 blur-md animate-pulse-light"
        style={{ width: size * 6, height: size * 6 }}
      />
      <span
        className="relative rounded-full bg-white shadow-[0_0_12px_2px_rgb(255_255_255/0.8)]"
        style={{ width: size, height: size }}
      />
    </span>
  );
}
