"use client";

/*
 * Absolute ZRO: logo e símbolos, desenhados a partir do board de referência do Victor
 * (brand/absolute-zro/referencia-board.png).
 * - "A B S O L U T E" em Montserrat Light, espaçamento de 1em, centrado na altura do ZRO.
 * - "ZR" próprio da Absolute (traço fino, R sem haste) + o O virando o Anel Absolute: azul, com brilho.
 * - Símbolos: Anel (estado final), Eclipse (mistério, origem) e Lente (precisão, controle).
 * Paleta: preto #000000, azul profundo #0B1F2D, azul Absolute #2D7BFF, branco frio #F5F7FA.
 * Base em currentColor; o azul vem de --color-abs-blue.
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

/* Z e R da Absolute (altura 300, traço 54), medidos no logo enviado pelo Victor: o R não tem haste. */
const ZR_PATH =
  "M0 0H341V54L103 246H341V300H0V246L238 54H0Z" +
  "M420 0H595A101 101 0 0 1 595 202H420V148H595A47 47 0 0 0 595 54H420Z" +
  "M420 202H525L681 300H576Z";
const ZR_H = 300;
const ZR_W = 696;

/* "ΛBSOLUTE": Montserrat Light, o A sem travessão, espaçamento 1,22em. Maiúsculas com 42% da altura do ZR. */
const ABSOLUTE_PATH =
  "M58 0L1 127L11 127L66 6L60 6L114 127L124 127L67 0ZM369 127L369 0L422 0Q443 0 455 8Q466 17 466 33Q466 43 461 50Q456 57 448 61Q439 64 428 64L432 61Q445 61 454 64Q463 68 468 76Q473 83 473 94Q473 110 461 119Q450 127 426 127ZM379 119L426 119Q444 119 454 113Q464 107 464 93Q464 79 454 73Q444 67 426 67L377 67L377 59L422 59Q439 59 448 52Q457 46 457 33Q457 21 448 14Q439 8 422 8L379 8ZM762 128Q747 128 735 123Q722 119 715 111L719 104Q726 111 737 115Q749 120 761 120Q774 120 782 117Q790 113 794 108Q798 102 798 95Q798 87 794 82Q790 77 782 74Q775 71 767 69Q759 67 750 65Q741 63 734 59Q727 56 723 49Q719 43 719 33Q719 24 723 16Q728 9 738 4Q748 -1 764 -1Q774 -1 785 2Q795 5 802 11L799 18Q791 13 782 10Q772 7 764 7Q752 7 744 11Q736 14 732 20Q728 26 728 33Q728 41 732 46Q737 51 744 54Q751 57 759 59Q768 61 776 63Q785 65 792 69Q799 72 803 79Q808 85 808 95Q808 104 803 111Q798 119 788 124Q778 128 762 128ZM1115 128Q1101 128 1089 123Q1077 119 1068 110Q1059 101 1054 89Q1049 78 1049 64Q1049 50 1054 38Q1059 26 1068 18Q1077 9 1089 4Q1101 -1 1115 -1Q1129 -1 1141 4Q1154 9 1162 17Q1171 26 1176 38Q1181 50 1181 64Q1181 78 1176 89Q1171 101 1162 110Q1154 119 1141 123Q1129 128 1115 128ZM1115 120Q1127 120 1138 116Q1148 111 1156 104Q1163 96 1168 86Q1172 76 1172 64Q1172 52 1168 41Q1163 31 1156 24Q1148 16 1138 12Q1127 8 1115 8Q1103 8 1093 12Q1082 16 1074 24Q1067 31 1062 41Q1058 52 1058 64Q1058 76 1062 86Q1067 96 1074 104Q1082 111 1093 116Q1103 120 1115 120ZM1436 127L1436 0L1445 0L1445 119L1518 119L1518 127ZM1811 128Q1788 128 1774 114Q1760 101 1760 73L1760 0L1770 0L1770 73Q1770 97 1781 108Q1792 120 1812 120Q1831 120 1842 108Q1853 97 1853 73L1853 0L1863 0L1863 73Q1863 101 1849 114Q1835 128 1811 128ZM2150 127L2150 8L2104 8L2104 0L2205 0L2205 8L2159 8L2159 127ZM2450 127L2450 0L2535 0L2535 8L2459 8L2459 119L2538 119L2538 127ZM2458 67L2458 59L2527 59L2527 67Z";
const ABSOLUTE_W = 2538;
const ABSOLUTE_CAP = 127;

/* Versão da assinatura empilhada. */
const ABSOLUTE_SMALL_PATH =
  "M38 0L1 84L7 84L43 4L39 4L75 84L82 84L44 0ZM205 84L205 0L240 0Q254 0 261 6Q269 11 269 21Q269 28 266 33Q263 38 257 40Q251 42 244 42L246 40Q255 40 261 42Q267 45 270 50Q273 55 273 62Q273 72 266 78Q258 84 243 84ZM211 79L243 79Q255 79 261 75Q267 70 267 61Q267 52 261 48Q255 44 243 44L210 44L210 39L240 39Q251 39 257 35Q263 30 263 22Q263 14 257 9Q251 5 240 5L211 5ZM425 85Q416 85 408 81Q399 78 395 73L398 69Q402 73 409 76Q417 79 425 79Q434 79 439 77Q444 75 447 71Q450 67 450 63Q450 57 447 54Q444 51 439 49Q434 47 429 46Q423 44 418 43Q412 41 407 39Q403 37 400 32Q397 28 397 22Q397 16 400 11Q403 6 410 3Q417 -1 427 -1Q434 -1 441 1Q447 3 452 7L450 12Q445 8 439 7Q432 5 427 5Q419 5 414 7Q408 9 406 13Q403 17 403 22Q403 27 406 30Q409 33 414 35Q418 37 424 39Q429 40 435 41Q441 43 445 45Q450 48 453 52Q456 56 456 62Q456 68 452 73Q449 78 443 82Q436 85 425 85ZM620 85Q611 85 603 81Q595 78 589 72Q583 67 580 59Q576 51 576 42Q576 33 580 25Q583 17 589 12Q595 6 603 3Q611 -1 620 -1Q629 -1 637 3Q645 6 651 12Q657 17 660 25Q664 33 664 42Q664 51 660 59Q657 67 651 72Q645 78 637 81Q629 85 620 85ZM620 79Q628 79 635 76Q642 73 647 68Q652 63 655 57Q657 50 657 42Q657 34 655 27Q652 21 647 16Q642 11 635 8Q628 5 620 5Q612 5 605 8Q598 11 593 16Q588 21 585 27Q582 34 582 42Q582 50 585 57Q588 63 593 68Q598 73 605 76Q612 79 620 79ZM793 84L793 0L799 0L799 78L847 78L847 84ZM1002 85Q987 85 978 75Q969 66 969 48L969 0L975 0L975 48Q975 64 982 71Q989 79 1002 79Q1016 79 1023 71Q1030 64 1030 48L1030 0L1036 0L1036 48Q1036 66 1027 75Q1018 85 1002 85ZM1187 84L1187 6L1157 6L1157 0L1223 0L1223 6L1193 6L1193 84ZM1347 84L1347 0L1403 0L1403 6L1353 6L1353 78L1404 78L1404 84ZM1352 44L1352 39L1397 39L1397 44Z";
const ABSOLUTE_SMALL_W = 1404;
const ABSOLUTE_SMALL_CAP = 84;

/* Anel: diâmetro de 1,34 vez a altura do ZR, traço fino, a 1/3 da altura depois do R. */
const RING_R = 195;
const RING_STROKE = 13;
const RING_GAP = 100;
const ZRO_W = ZR_W + RING_GAP + (RING_R + RING_STROKE / 2) * 2;
const GAP_E_Z = 233;

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * O Anel Absolute, como no logo enviado: traço fino azul-claro, mais aceso à direita,
 * com o ponto de luz (branco, com brilho azul e um fio horizontal) no lado direito.
 */
function Ring({ cx, cy, r, stroke, glow, id }: { cx: number; cy: number; r: number; stroke: number; glow: boolean; id: string }) {
  return (
    // Cor pelo token (com o hex de reserva): o brilho é sempre o azul Absolute, qualquer que seja a cor do texto.
    <g style={{ color: "var(--color-abs-blue, #2d7bff)" }}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0" stopColor="#8fb6e0" />
          <stop offset="0.6" stopColor="#a9ccf2" />
          <stop offset="1" stopColor="#e6f3ff" />
        </linearGradient>
        <linearGradient id={`${id}-lit`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
        </linearGradient>
        {glow ? (
          <>
            <filter id={`${id}-f`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={stroke * 1.6} />
            </filter>
            <radialGradient id={`${id}-flare`}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.12" stopColor="#ffffff" />
              <stop offset="0.35" stopColor="#8cc0ff" stopOpacity="0.7" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-streak`} x1="0" y1="0.5" x2="1" y2="0.5">
              <stop offset="0" stopColor="#8cc0ff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#8cc0ff" stopOpacity="0" />
            </linearGradient>
          </>
        ) : null}
      </defs>
      {glow ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke * 3.2} opacity={0.35} filter={`url(#${id}-f)`} />
      ) : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id}-g)`} strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id}-lit)`} strokeWidth={stroke * 1.35} />
      {glow ? (
        <>
          <circle cx={cx + r} cy={cy + r * 0.03} r={r * 0.34} fill={`url(#${id}-flare)`} opacity={0.9} />
          <ellipse cx={cx + r} cy={cy + r * 0.03} rx={r * 0.45} ry={stroke * 0.2} fill={`url(#${id}-streak)`} opacity={0.7} />
        </>
      ) : null}
    </g>
  );
}

/** Z R ◯ a partir de (x, y), com as letras de altura ZR_H. */
function ZroMark({ x, y, glow, id }: { x: number; y: number; glow: boolean; id: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path fill="currentColor" d={ZR_PATH} />
      <Ring cx={ZR_W + RING_GAP + RING_R + RING_STROKE / 2} cy={ZR_H / 2} r={RING_R} stroke={RING_STROKE} glow={glow} id={id} />
    </g>
  );
}

type LogoProps = {
  className?: string;
  "aria-label"?: string;
  /** Brilho do anel (desligue em tamanhos muito pequenos ou impressão). */
  glow?: boolean;
};

/**
 * Logo da Absolute ZRO.
 * - horizontal (padrão): A B S O L U T E  Z R ◯, como no topo do board
 * - stacked: A B S O L U T E em cima, Z R ◯ embaixo (porta, moletom, caderno)
 */
export function AbsoluteLogo({
  className,
  "aria-label": label = "Absolute ZRO",
  glow = true,
  variant = "horizontal",
}: LogoProps & { variant?: "horizontal" | "stacked" }) {
  const id = useSvgId("abs");
  const pad = glow ? 90 : 20;
  const ringOver = RING_R + RING_STROKE / 2 - ZR_H / 2; // quanto o anel passa das letras, em cima e embaixo
  if (variant === "stacked") {
    const w = Math.max(ABSOLUTE_SMALL_W, ZRO_W);
    const zroTop = ABSOLUTE_SMALL_CAP + 110 + ringOver;
    const h = zroTop + ZR_H + ringOver;
    return (
      <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} role="img" aria-label={label} className={cn("h-24 w-auto", className)}>
        <path fill="currentColor" d={ABSOLUTE_SMALL_PATH} transform={`translate(${(w - ABSOLUTE_SMALL_W) / 2} 0)`} />
        <ZroMark x={(w - ZRO_W) / 2} y={zroTop} glow={glow} id={id} />
      </svg>
    );
  }
  const w = ABSOLUTE_W + GAP_E_Z + ZRO_W;
  const h = ZR_H + ringOver * 2;
  const absY = ringOver + (ZR_H - ABSOLUTE_CAP) / 2;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} role="img" aria-label={label} className={cn("h-10 w-auto", className)}>
      {glow ? (
        // Halo suave nas letras, como no logo original.
        <>
          <defs>
            <filter id={`${id}-bloom`} x="-10%" y="-60%" width="120%" height="220%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <g fill="currentColor" opacity={0.4} filter={`url(#${id}-bloom)`}>
            <path d={ABSOLUTE_PATH} transform={`translate(0 ${absY})`} />
            <path d={ZR_PATH} transform={`translate(${ABSOLUTE_W + GAP_E_Z} ${ringOver})`} />
          </g>
        </>
      ) : null}
      <path fill="currentColor" d={ABSOLUTE_PATH} transform={`translate(0 ${absY})`} />
      <ZroMark x={ABSOLUTE_W + GAP_E_Z} y={ringOver} glow={glow} id={id} />
    </svg>
  );
}

/** Anel Absolute sozinho: o estado final. Avatar, ícone, selo. */
export function AbsoluteSymbol({ className, "aria-label": label, glow = true }: LogoProps) {
  const id = useSvgId("ring");
  return (
    <svg viewBox="0 0 400 400" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} className={cn("size-10", className)}>
      <Ring cx={200} cy={200} r={128} stroke={13} glow={glow} id={id} />
    </svg>
  );
}

/** Eclipse: disco escuro com a borda acesa em azul. Mistério, origem. */
export function AbsoluteEclipse({ className, "aria-label": label }: Omit<LogoProps, "glow">) {
  const id = useSvgId("ecl");
  return (
    <svg viewBox="0 0 400 400" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} className={cn("size-40 text-abs-blue", className)}>
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.15" y1="0.85" x2="1" y2="0.3">
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.82" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="1" stopColor="#d6e6ff" />
        </linearGradient>
        <radialGradient id={`${id}-disc`} cx="0.35" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#05080d" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id={`${id}-flare`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#bcd6ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <circle cx="200" cy="200" r="150" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="22" filter={`url(#${id}-blur)`} opacity="0.9" />
      <circle cx="200" cy="200" r="150" fill={`url(#${id}-disc)`} />
      <circle cx="200" cy="200" r="150" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="3.5" />
      <ellipse cx="341" cy="150" rx="26" ry="9" fill={`url(#${id}-flare)`} transform="rotate(-62 341 150)" />
      <circle cx="341" cy="150" r="4" fill="#fff" />
    </svg>
  );
}

/** Lente: anéis concêntricos e o ponto de luz no centro. Precisão, controle. */
export function AbsoluteLens({ className, "aria-label": label }: Omit<LogoProps, "glow">) {
  const id = useSvgId("lens");
  return (
    <svg viewBox="0 0 400 400" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} className={cn("size-40 text-abs-blue", className)}>
      <defs>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.18" stopColor="#9cc4ff" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[150, 122, 96].map((r, i) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.22 + i * 0.14} />
      ))}
      <circle cx="200" cy="200" r="70" fill="#02060c" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="200" cy="200" r="58" fill={`url(#${id}-core)`} />
      <circle cx="200" cy="200" r="7" fill="#fff" />
    </svg>
  );
}
