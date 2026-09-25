import { Symbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Selo circular com a assinatura girando em volta do símbolo O. */
export function RotatingBadge({ className, text = "Onde tudo começa · e o comum termina · " }: { className?: string; text?: string }) {
  return (
    <div className={cn("relative grid size-36 place-items-center", className)} aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full animate-spin-slow text-mute">
        <defs>
          <path id="badge-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text className="fill-current font-mono text-[12.5px] tracking-[0.28em] uppercase">
          <textPath href="#badge-circle">{text}</textPath>
        </text>
      </svg>
      <div className="relative grid size-14 place-items-center">
        <Symbol className="absolute inset-0 size-14 text-white" />
        <span className="relative size-1.5 rounded-full bg-void shadow-[0_0_0_2px_rgb(255_255_255/0.08)]" />
      </div>
    </div>
  );
}
