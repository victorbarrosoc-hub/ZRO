import { Symbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.035),rgb(255_255_255/0.012))]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-light">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-mute">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "light" | "abs";

const tones: Record<Tone, string> = {
  neutral: "border-line-strong text-ash",
  light: "border-white/40 text-white",
  ok: "border-ok/35 bg-ok/[0.08] text-ok",
  warn: "border-warn/35 bg-warn/[0.08] text-warn",
  danger: "border-danger/40 bg-danger/[0.08] text-danger",
  abs: "border-abs-blue/40 bg-abs-blue/10 text-abs-ice",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5 grid size-14 place-items-center">
        <div className="absolute inset-0 rounded-full bg-white/5 blur-xl" aria-hidden />
        <Symbol className="relative size-7 text-white/70" />
      </div>
      <p className="text-[15px] font-medium text-light">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-[14px] text-mute">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  label,
  title,
  description,
  actions,
  className,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        {label ? <p className="label mb-3 text-mute">{label}</p> : null}
        <h1 className="text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-[15px] text-ash">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} aria-hidden />;
}
