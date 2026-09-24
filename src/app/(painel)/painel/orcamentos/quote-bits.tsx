/**
 * Peças pequenas do módulo de orçamentos (servidor e cliente podem usar).
 */
import Link from "next/link";
import { Badge } from "@/components/ui/surface";
import { dateBR } from "@/lib/format";
import { validityInfo } from "@/lib/services/quotes";
import { cn } from "@/lib/utils";

export function FilterChip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
        active ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
      )}
    >
      {children}
      {count != null ? <span className={cn("text-[11px] tabular-nums", active ? "text-void/60" : "text-mute")}>{count}</span> : null}
    </Link>
  );
}

/** Data de validade com aviso quando vence em até 3 dias ou já venceu. */
export function ValidityCell({
  validUntil,
  status,
  today,
  inline,
}: {
  validUntil: string | null;
  status: string;
  today: string;
  inline?: boolean;
}) {
  const info = validityInfo(validUntil, today, status);
  if (!validUntil) return <span className="text-mute">—</span>;
  return (
    <span className={cn("flex gap-1.5 text-[13px]", inline ? "flex-wrap items-center" : "flex-col items-start")}>
      <span className="text-[14px] text-ash">{dateBR(validUntil)}</span>
      {info?.tone ? (
        <Badge tone={info.tone} dot className="h-5 px-2 text-[11px]">
          {info.label}
        </Badge>
      ) : null}
    </span>
  );
}
