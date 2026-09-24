import { cn } from "@/lib/utils";

const control =
  "w-full rounded-field border border-line-strong bg-white/[0.03] px-3.5 text-[15px] text-light placeholder:text-mute transition-[border-color,background-color,box-shadow] duration-200 hover:border-white/25 focus:border-white/50 focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-white/[0.06] disabled:opacity-50 aria-[invalid=true]:border-danger/60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-ash"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  );
}

/** Campo de valor em reais. O servidor converte com parseBRL. */
export function MoneyInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-mute">R$</span>
      <input inputMode="decimal" className={cn(control, "h-11 pl-10 tabular-nums", className)} {...props} />
    </div>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("block text-[13px] font-medium text-ash", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | string[] | null;
  className?: string;
  children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {message ? (
        <p className="text-[13px] text-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-mute">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, label, ...props }: React.ComponentProps<"input"> & { label?: React.ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-start gap-3 text-[14px] text-ash", className)}>
      <span className="relative mt-0.5 grid size-[18px] shrink-0">
        <input
          type="checkbox"
          className="peer size-[18px] cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-white/[0.03] transition-colors checked:border-white checked:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          {...props}
        />
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 hidden p-[3px] text-void peer-checked:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      {label ? <span className="leading-snug">{label}</span> : null}
    </label>
  );
}
