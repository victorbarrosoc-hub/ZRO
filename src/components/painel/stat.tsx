import { cn } from "@/lib/utils";

/**
 * Stat tile (skill dataviz): rótulo em caixa de frase, valor em sans semibold
 * com algarismos proporcionais, linha de apoio opcional.
 */
export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "@container relative flex flex-col justify-between gap-6 rounded-[22px] border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.035),rgb(255_255_255/0.012))] p-5",
        tone === "danger" && "border-danger/25",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-ash">{label}</p>
        {icon ? <span className="text-mute [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div>
        {/* O número encolhe com a largura do cartão (container query): valor em reais não estoura no celular. */}
        <p className="text-[clamp(17px,11cqi,28px)] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap text-white">{value}</p>
        {/* Sempre com a linha de apoio (vazia se preciso): numa fileira, os números ficam na mesma altura. */}
        <p className="mt-2 truncate text-[13px] text-mute">{sub ?? "\u00a0"}</p>
      </div>
    </div>
  );
}

/** O número que o painel lidera (um por tela), com o brilho da referência TaskFlow. */
export function HeroFigure({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-8 overflow-hidden rounded-[22px] border border-white/15 bg-[#111] p-6",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.16),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:radial-gradient(70%_80%_at_85%_10%,black,transparent)]"
        aria-hidden
      />
      <p className="relative text-[13px] text-ash">{label}</p>
      <div className="relative">
        <p className="text-[clamp(40px,4vw,56px)] leading-none font-semibold tracking-[-0.04em] text-white">{value}</p>
        {sub ? <p className="mt-3 text-[13px] text-mute">{sub}</p> : null}
      </div>
    </div>
  );
}
