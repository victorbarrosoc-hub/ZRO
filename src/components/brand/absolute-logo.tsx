"use client";

/*
 * Absolute ZRO: logo e símbolos (direção escolhida pelo Victor a partir do board de referência).
 * - "A B S O L U T E" em Montserrat Light, bem espaçado (em contorno: não depende da fonte).
 * - "ZR" do logo oficial da ZRO + o O virando o Anel Absolute: um anel azul que brilha.
 * - Símbolos: Anel (estado final), Eclipse (mistério, origem) e Lente (precisão, controle).
 * Paleta: preto #000000, azul profundo #0B1F2D, azul Absolute #2D7BFF, branco frio #F5F7FA.
 * Base em currentColor; o azul vem de --color-abs-blue.
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

/* Z e R do logo oficial (components/brand/logo.tsx), sem o O. */
const ZR_PATH =
  "M9 1H275V9L109 269H275V326H0V318L165 58H9ZM307 1H422C497 1 540 38 540 100C540 150 510 183 457 193L554 326H473L388 199H375V326H307ZM375 60H414C450 60 471 75 471 100C471 125 450 141 414 141H375Z";

/* "ABSOLUTE" em Montserrat Light, espaçamento 0,62em. Maiúsculas com 62% da altura do ZRO. */
const ABSOLUTE_PATH =
  "M1 203L95 0L110 0L203 203L187 203L99 9L105 9L17 203ZM36 146L41 133L162 133L167 146ZM420 203L420 0L504 0Q537 0 556 13Q574 27 574 52Q574 68 566 80Q559 91 545 97Q531 102 514 102L519 97Q540 97 555 103Q570 109 577 120Q585 132 585 149Q585 175 566 189Q548 203 510 203ZM434 190L510 190Q539 190 555 180Q570 170 570 148Q570 126 555 116Q539 106 510 106L433 106L433 94L504 94Q530 94 545 84Q559 73 559 53Q559 33 545 23Q530 13 504 13L434 13ZM871 204Q848 204 828 197Q808 189 797 177L804 166Q814 177 832 184Q850 191 871 191Q891 191 904 186Q917 181 923 172Q929 163 929 152Q929 139 922 131Q915 123 904 118Q893 114 879 110Q866 107 852 104Q839 100 827 94Q816 88 809 78Q802 68 802 52Q802 38 810 26Q818 14 833 6Q849 -1 874 -1Q891 -1 908 3Q924 8 936 17L930 29Q917 20 903 16Q888 12 874 12Q855 12 842 17Q829 23 823 32Q817 41 817 52Q817 65 824 73Q831 81 842 86Q853 90 867 93Q881 97 894 100Q907 104 919 110Q930 115 937 125Q944 135 944 151Q944 165 936 177Q928 190 912 197Q896 204 871 204ZM1260 204Q1237 204 1218 197Q1199 189 1185 175Q1170 161 1162 142Q1154 124 1154 102Q1154 79 1162 61Q1170 42 1185 28Q1199 14 1218 6Q1237 -1 1260 -1Q1283 -1 1302 6Q1321 14 1335 28Q1350 42 1358 60Q1366 79 1366 102Q1366 124 1358 143Q1350 161 1335 175Q1321 189 1302 197Q1283 204 1260 204ZM1260 191Q1279 191 1296 184Q1313 177 1325 165Q1337 153 1344 137Q1351 121 1351 102Q1351 82 1344 66Q1337 50 1325 38Q1313 26 1296 19Q1279 12 1260 12Q1241 12 1224 19Q1208 26 1195 38Q1183 50 1176 66Q1169 82 1169 102Q1169 121 1176 137Q1183 153 1195 165Q1208 177 1224 184Q1241 191 1260 191ZM1597 203L1597 0L1612 0L1612 190L1728 190L1728 203ZM2022 204Q1984 204 1962 182Q1940 160 1940 117L1940 0L1955 0L1955 116Q1955 154 1973 173Q1990 191 2022 191Q2053 191 2071 173Q2088 154 2088 116L2088 0L2103 0L2103 117Q2103 160 2081 182Q2060 204 2022 204ZM2387 203L2387 13L2314 13L2314 0L2475 0L2475 13L2401 13L2401 203ZM2691 203L2691 0L2827 0L2827 13L2706 13L2706 190L2831 190L2831 203ZM2704 106L2704 93L2814 93L2814 106Z";
const ABSOLUTE_CAP = 203;

/* Versão menor, para a assinatura empilhada. */
const ABSOLUTE_SMALL_PATH =
  "M1 77L36 0L42 0L77 77L71 77L38 4L40 4L7 77ZM14 55L15 51L61 51L63 55ZM159 77L159 0L191 0Q204 0 211 5Q218 10 218 20Q218 26 215 30Q212 35 207 37Q201 39 195 39L197 37Q205 37 210 39Q216 41 219 46Q222 50 222 57Q222 66 215 72Q208 77 193 77ZM165 72L193 72Q205 72 210 68Q216 65 216 56Q216 48 210 44Q205 40 193 40L164 40L164 36L191 36Q201 36 207 32Q212 28 212 20Q212 13 207 9Q201 5 191 5L165 5ZM330 78Q322 78 314 75Q306 72 302 67L305 63Q309 67 316 70Q323 73 330 73Q338 73 343 71Q348 69 350 65Q352 62 352 58Q352 53 350 50Q347 47 343 45Q339 43 334 42Q328 41 323 39Q318 38 314 36Q310 34 307 30Q304 26 304 20Q304 14 307 10Q310 5 316 2Q322 -1 332 -1Q338 -1 344 1Q350 3 355 6L353 11Q348 8 342 6Q337 4 332 4Q324 4 319 6Q315 9 312 12Q310 16 310 20Q310 25 313 28Q315 31 319 32Q324 34 329 35Q334 37 339 38Q344 39 348 42Q353 44 355 48Q358 51 358 57Q358 63 355 67Q352 72 346 75Q340 78 330 78ZM478 78Q469 78 462 75Q455 72 449 66Q444 61 441 54Q438 47 438 39Q438 30 441 23Q444 16 449 11Q455 5 462 2Q469 -1 478 -1Q487 -1 494 2Q501 5 507 11Q512 16 515 23Q518 30 518 39Q518 47 515 54Q512 61 507 66Q501 72 494 75Q487 78 478 78ZM478 72Q485 72 492 70Q498 67 502 63Q507 58 510 52Q512 46 512 39Q512 31 510 25Q507 19 502 14Q498 10 492 7Q485 5 478 5Q471 5 464 7Q458 10 453 14Q449 19 446 25Q444 31 444 39Q444 46 446 52Q449 58 453 63Q458 67 464 70Q471 72 478 72ZM606 77L606 0L611 0L611 72L656 72L656 77ZM767 78Q753 78 744 69Q736 61 736 44L736 0L742 0L742 44Q742 59 748 65Q755 72 767 72Q779 72 786 65Q792 59 792 44L792 0L798 0L798 44Q798 61 789 69Q781 78 767 78ZM905 77L905 5L878 5L878 0L939 0L939 5L911 5L911 77ZM1021 77L1021 0L1072 0L1072 5L1026 5L1026 72L1074 72L1074 77ZM1026 40L1026 35L1067 35L1067 40Z";

const H = 327;
const RING_R = 168;

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** O anel azul com brilho, centrado em (cx, cy). Raio e traço nas unidades do desenho. */
function Ring({ cx, cy, r, stroke, glow, id }: { cx: number; cy: number; r: number; stroke: number; glow: boolean; id: string }) {
  return (
    // Cor pelo token (com o hex de reserva): o anel é sempre o azul Absolute, qualquer que seja a cor do texto.
    <g style={{ color: "var(--color-abs-blue, #2d7bff)" }}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9cc4ff" />
          <stop offset="0.45" stopColor="currentColor" />
          <stop offset="1" stopColor="#1d5fe0" />
        </linearGradient>
        {glow ? (
          <filter id={`${id}-f`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={stroke * 0.9} />
          </filter>
        ) : null}
      </defs>
      {glow ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke * 2.6} opacity={0.9} filter={`url(#${id}-f)`} />
      ) : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id}-g)`} strokeWidth={stroke} />
      {glow ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e3efff" strokeWidth={stroke * 0.22} opacity={0.85} /> : null}
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
  const pad = glow ? 70 : 12;
  if (variant === "stacked") {
    const w = 1074;
    const zroTop = 188;
    const h = zroTop + H;
    return (
      <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} role="img" aria-label={label} className={cn("h-24 w-auto", className)}>
        <path fill="currentColor" d={ABSOLUTE_SMALL_PATH} transform="translate(0 0)" />
        <g transform={`translate(70 ${zroTop})`}>
          <path fill="currentColor" d={ZR_PATH} />
          <Ring cx={554 + 44 + RING_R} cy={H / 2} r={RING_R} stroke={24} glow={glow} id={id} />
        </g>
      </svg>
    );
  }
  const w = 4015;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${H + pad * 2}`} role="img" aria-label={label} className={cn("h-10 w-auto", className)}>
      <path fill="currentColor" d={ABSOLUTE_PATH} transform={`translate(0 ${H - 1 - ABSOLUTE_CAP})`} />
      <g transform="translate(3081 0)">
        <path fill="currentColor" d={ZR_PATH} />
        <Ring cx={554 + 44 + RING_R} cy={H / 2} r={RING_R} stroke={24} glow={glow} id={id} />
      </g>
    </svg>
  );
}

/** Anel Absolute sozinho: o estado final. Avatar, ícone, selo. */
export function AbsoluteSymbol({ className, "aria-label": label, glow = true }: LogoProps) {
  const id = useSvgId("ring");
  return (
    <svg viewBox="0 0 400 400" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} className={cn("size-10", className)}>
      <Ring cx={200} cy={200} r={128} stroke={18} glow={glow} id={id} />
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
