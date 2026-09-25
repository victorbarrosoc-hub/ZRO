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

/* Z e R da Absolute (altura 300, traço 36): o R não tem haste, como no board. */
const ZR_PATH =
  "M0 0H270V36L50 264H270V300H0V264L220 36H0Z" +
  "M356 0H531A84 84 0 0 1 531 168H356V132H531A48 48 0 0 0 531 36H356Z" +
  "M386 168H448L641 300H579Z";
const ZR_H = 300;
const ZR_W = 641;

/* "ABSOLUTE" em Montserrat Light, espaçamento 1em. Maiúsculas com 55% da altura do ZR. */
const ABSOLUTE_PATH =
  "M1 165L77 0L89 0L165 165L152 165L80 8L86 8L14 165ZM29 119L33 109L132 109L136 119ZM431 165L431 0L500 0Q527 0 542 11Q557 22 557 42Q557 56 551 65Q544 74 533 79Q522 83 508 83L512 79Q529 79 541 84Q553 89 559 98Q566 107 566 122Q566 142 551 154Q535 165 505 165ZM443 155L505 155Q529 155 541 147Q554 139 554 121Q554 103 541 95Q529 87 505 87L442 87L442 76L500 76Q521 76 533 68Q545 60 545 43Q545 27 533 19Q521 10 500 10L443 10ZM888 166Q870 166 853 160Q837 154 828 144L833 135Q842 144 857 150Q871 156 888 156Q904 156 915 151Q925 147 930 140Q936 132 936 123Q936 113 930 106Q924 100 915 96Q906 93 895 90Q884 87 873 84Q862 81 853 77Q843 72 838 64Q832 56 832 43Q832 31 839 21Q845 11 858 5Q871 -1 891 -1Q905 -1 918 3Q931 7 941 14L936 23Q926 16 914 13Q902 9 891 9Q875 9 865 14Q854 18 849 26Q844 33 844 42Q844 53 850 59Q856 66 865 70Q874 73 885 76Q896 79 907 82Q918 84 927 89Q936 94 942 102Q948 110 948 123Q948 134 941 144Q935 154 922 160Q909 166 888 166ZM1294 166Q1276 166 1260 160Q1245 154 1233 142Q1221 131 1215 116Q1209 101 1209 83Q1209 65 1215 49Q1221 34 1233 23Q1245 11 1260 5Q1276 -1 1294 -1Q1313 -1 1329 5Q1344 11 1356 23Q1367 34 1374 49Q1380 64 1380 83Q1380 101 1374 116Q1367 131 1356 143Q1344 154 1329 160Q1313 166 1294 166ZM1294 155Q1310 155 1324 150Q1337 144 1347 135Q1357 125 1363 111Q1368 98 1368 83Q1368 67 1363 54Q1357 41 1347 31Q1337 21 1324 15Q1310 10 1294 10Q1279 10 1265 15Q1252 21 1242 31Q1232 41 1226 54Q1221 67 1221 83Q1221 98 1226 111Q1232 125 1242 135Q1252 144 1265 150Q1279 155 1294 155ZM1658 165L1658 0L1670 0L1670 154L1765 154L1765 165ZM2094 166Q2063 166 2045 148Q2027 131 2027 95L2027 0L2040 0L2040 95Q2040 126 2054 140Q2068 155 2094 155Q2120 155 2134 140Q2148 126 2148 95L2148 0L2160 0L2160 95Q2160 131 2142 148Q2124 166 2094 166ZM2480 165L2480 11L2421 11L2421 0L2552 0L2552 11L2492 11L2492 165ZM2818 165L2818 0L2928 0L2928 11L2830 11L2830 154L2932 154L2932 165ZM2828 87L2828 76L2918 76L2918 87Z";
const ABSOLUTE_W = 2932;
const ABSOLUTE_CAP = 165;

/* Versão da assinatura empilhada (porta, moletom, caderno): mais larga que o ZRO. */
const ABSOLUTE_SMALL_PATH =
  "M1 108L50 0L58 0L108 108L99 108L53 5L56 5L9 108ZM19 77L22 71L86 71L89 77ZM258 108L258 0L303 0Q321 0 330 7Q340 14 340 28Q340 36 336 42Q332 48 325 51Q317 54 308 54L311 51Q322 51 330 55Q338 58 342 64Q346 70 346 79Q346 93 336 100Q326 108 306 108ZM266 101L306 101Q322 101 330 96Q338 90 338 79Q338 67 330 62Q322 57 306 57L265 57L265 50L303 50Q317 50 325 44Q332 39 332 28Q332 18 325 12Q317 7 303 7L266 7ZM533 109Q521 109 511 104Q500 100 494 94L498 88Q503 94 513 98Q522 102 533 102Q544 102 551 99Q558 96 561 91Q564 86 564 81Q564 74 561 69Q557 65 551 63Q545 60 538 59Q531 57 523 55Q516 53 510 50Q504 47 501 42Q497 36 497 28Q497 20 501 14Q505 7 513 3Q522 -1 535 -1Q544 -1 553 2Q561 4 568 9L565 15Q558 11 550 8Q542 6 535 6Q525 6 518 9Q511 12 508 17Q505 22 505 28Q505 35 508 39Q512 43 518 45Q524 48 531 50Q539 51 546 53Q553 55 559 58Q565 61 568 67Q572 72 572 80Q572 88 568 94Q564 101 555 105Q547 109 533 109ZM775 109Q763 109 753 104Q743 100 735 93Q728 85 723 76Q719 66 719 54Q719 42 723 32Q728 22 735 15Q743 7 753 3Q763 -1 775 -1Q787 -1 798 3Q808 7 815 15Q823 22 827 32Q831 42 831 54Q831 66 827 76Q823 86 815 93Q808 100 798 104Q787 109 775 109ZM775 101Q786 101 794 98Q803 94 810 88Q816 81 820 73Q823 64 823 54Q823 44 820 35Q816 26 810 20Q803 14 794 10Q786 6 775 6Q765 6 756 10Q748 14 741 20Q734 26 731 35Q727 44 727 54Q727 64 731 73Q734 81 741 88Q748 94 756 98Q765 101 775 101ZM990 108L990 0L997 0L997 101L1060 101L1060 108ZM1251 109Q1231 109 1219 97Q1208 85 1208 62L1208 0L1215 0L1215 62Q1215 82 1225 92Q1234 101 1251 101Q1268 101 1277 92Q1286 82 1286 62L1286 0L1294 0L1294 62Q1294 85 1282 97Q1271 109 1251 109ZM1480 108L1480 7L1441 7L1441 0L1527 0L1527 7L1488 7L1488 108ZM1677 108L1677 0L1749 0L1749 7L1685 7L1685 101L1751 101L1751 108ZM1684 57L1684 50L1742 50L1742 57Z";
const ABSOLUTE_SMALL_W = 1751;
const ABSOLUTE_SMALL_CAP = 108;

/* Anel: 1,37 vez a altura do ZR, traço fino, centrado na altura das letras. */
const RING_R = 195;
const RING_STROKE = 20;
const RING_GAP = 120;
const ZRO_W = ZR_W + RING_GAP + (RING_R + RING_STROKE / 2) * 2;
const GAP_E_Z = 236;

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * O Anel Absolute: azul mais fundo à esquerda, quase branco à direita (onde a luz bate),
 * com o brilho em volta e um fio de luz horizontal no lado aceso, como no board.
 */
function Ring({ cx, cy, r, stroke, glow, id }: { cx: number; cy: number; r: number; stroke: number; glow: boolean; id: string }) {
  return (
    // Cor pelo token (com o hex de reserva): o anel é sempre o azul Absolute, qualquer que seja a cor do texto.
    <g style={{ color: "var(--color-abs-blue, #2d7bff)" }}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0.5" x2="1" y2="0.45">
          <stop offset="0" stopColor="#1557d8" />
          <stop offset="0.5" stopColor="currentColor" />
          <stop offset="0.85" stopColor="#8fc0ff" />
          <stop offset="1" stopColor="#eaf4ff" />
        </linearGradient>
        {glow ? (
          <>
            <filter id={`${id}-f`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={stroke * 1.4} />
            </filter>
            <radialGradient id={`${id}-flare`}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.3" stopColor="#bcd9ff" stopOpacity="0.7" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </>
        ) : null}
      </defs>
      {glow ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke * 3} opacity={0.85} filter={`url(#${id}-f)`} />
      ) : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id}-g)`} strokeWidth={stroke} />
      {glow ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f2f8ff" strokeWidth={stroke * 0.25} opacity={0.6} />
          <ellipse cx={cx + r * 0.99} cy={cy + r * 0.08} rx={r * 0.32} ry={stroke * 0.3} fill={`url(#${id}-flare)`} opacity={0.55} />
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
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} role="img" aria-label={label} className={cn("h-10 w-auto", className)}>
      <path fill="currentColor" d={ABSOLUTE_PATH} transform={`translate(0 ${ringOver + (ZR_H - ABSOLUTE_CAP) / 2})`} />
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
