import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out-expo select-none disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary:
    "bg-white text-void hover:bg-light shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_8px_32px_-8px_rgb(255_255_255/0.35)]",
  secondary: "border border-line-strong bg-white/[0.02] text-light hover:border-white/30 hover:bg-white/[0.06]",
  ghost: "text-ash hover:bg-white/[0.06] hover:text-light",
  subtle: "bg-white/[0.06] text-light hover:bg-white/[0.1]",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "size-10",
  "icon-sm": "size-8 [&_svg]:size-[15px]",
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export function Button({ variant, size, asChild, className, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp type={asChild ? undefined : type} className={buttonClasses({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

/**
 * Cápsula com seta num círculo (referência Azentos). Para chamadas do site.
 */
export function CtaPill({
  href,
  children,
  tone = "light",
  className,
  external,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
  external?: boolean;
}) {
  const content = (
    <>
      <span className="pl-5">{children}</span>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full transition-transform duration-500 ease-out-expo group-hover:rotate-45",
          tone === "light" ? "bg-void text-white" : "bg-white text-void",
        )}
      >
        <ArrowUpRight className="size-4" aria-hidden />
      </span>
    </>
  );
  const classes = cn(
    "group inline-flex h-12 items-center gap-4 rounded-full pr-1.5 text-[15px] font-medium transition-colors duration-300",
    tone === "light"
      ? "bg-white text-void hover:bg-light"
      : "border border-line-strong bg-white/[0.02] text-light hover:border-white/40",
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
