import { cn } from "@/lib/utils";

/**
 * Logo da ZRO redesenhado em vetor a partir do arquivo oficial
 * (brand/logo/zro-logo-cinza-transparente.webp). Usa currentColor.
 */
export function Logo({ className, title = "ZRO" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 914 327"
      fill="currentColor"
      fillRule="evenodd"
      role="img"
      aria-label={title}
      className={cn("h-6 w-auto", className)}
    >
      <path d="M9 1H275V9L109 269H275V326H0V318L165 58H9Z" />
      <path d="M307 1H422C497 1 540 38 540 100C540 150 510 183 457 193L554 326H473L388 199H375V326H307ZM375 60H414C450 60 471 75 471 100C471 125 450 141 414 141H375Z" />
      <path d="M607 0H894A20 20 0 0 1 914 20V307A20 20 0 0 1 894 327H607A20 20 0 0 1 587 307V20A20 20 0 0 1 607 0ZM750.5 42A121.5 121.5 0 1 0 750.5 285A121.5 121.5 0 1 0 750.5 42Z" />
    </svg>
  );
}

/** O símbolo "O": quadrado arredondado com o círculo vazado (o zero). */
export function Symbol({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 327 327"
      fill="currentColor"
      fillRule="evenodd"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("size-4", className)}
    >
      <path d="M20 0H307A20 20 0 0 1 327 20V307A20 20 0 0 1 307 327H20A20 20 0 0 1 0 307V20A20 20 0 0 1 20 0ZM163.5 42A121.5 121.5 0 1 0 163.5 285A121.5 121.5 0 1 0 163.5 42Z" />
    </svg>
  );
}
