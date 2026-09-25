import { cn } from "@/lib/utils";

/*
 * Absolute ZRO: proposta 02 "Módulo", aplicada como PROVISÓRIA (aguardando o Victor).
 * O logo real da ZRO entre as barras do valor absoluto: |ZRO|. Como |0| = 0,
 * o zero continua sendo o zero, só que em estado absoluto.
 *
 * - Base em currentColor (use text-logo, text-white, text-paper-ink...).
 * - As barras usam o azul da Absolute (token --color-abs-blue). Sobre fundo
 *   claro, passe accentClassName="text-abs-deep".
 * - "ABSOLUTE" está em contorno (Geist Mono 500), então não depende de fonte.
 * - As outras propostas e as paletas estão em docs/marca/identidade-visual.md.
 */

/* Paths do logo oficial, os mesmos de components/brand/logo.tsx. */
const ZRO_PATH =
  "M9 1H275V9L109 269H275V326H0V318L165 58H9ZM307 1H422C497 1 540 38 540 100C540 150 510 183 457 193L554 326H473L388 199H375V326H307ZM375 60H414C450 60 471 75 471 100C471 125 450 141 414 141H375ZM607 0H894A20 20 0 0 1 914 20V307A20 20 0 0 1 894 327H607A20 20 0 0 1 587 307V20A20 20 0 0 1 607 0ZM750.5 42A121.5 121.5 0 1 0 750.5 285A121.5 121.5 0 1 0 750.5 42Z";
const O_PATH =
  "M20 0H307A20 20 0 0 1 327 20V307A20 20 0 0 1 307 327H20A20 20 0 0 1 0 307V20A20 20 0 0 1 20 0ZM163.5 42A121.5 121.5 0 1 0 163.5 285A121.5 121.5 0 1 0 163.5 42Z";

/* "ABSOLUTE" em contorno, já no espaçamento de cada versão. */
const ABSOLUTE_STACKED =
  "M102 116L123.1 44L136.9 44L158 116L146.9 116L141.8 97.2L118.2 97.2L113.1 116ZM139 87.4L130 55.1L121 87.4ZM231.2 116L231.2 44L252.1 44Q264 44 270.1 49.2Q276.3 54.3 276.3 63.6Q276.3 68 274.3 71.5Q272.3 75 268.4 77.1Q266 78.4 263 78.9Q267.1 79.4 270.2 80.8Q274.7 83 277 87Q279.4 90.9 279.4 96Q279.4 105.6 272.8 110.8Q266.3 116 254.5 116ZM241.8 106.1L254.6 106.1Q261.6 106.1 265 103.3Q268.3 100.5 268.3 95.5Q268.3 90.2 264.8 87.3Q261.3 84.4 254.6 84.4L241.8 84.4ZM241.8 74.5L252.3 74.5Q259 74.5 262.1 71.8Q265.3 69.2 265.3 64.3Q265.3 59.3 262.1 56.6Q259 53.9 252.3 53.9L241.8 53.9ZM377.3 117.6Q369.5 117.6 363.7 114.5Q357.9 111.3 354.4 105.7Q351 100.1 350.4 92.6L361.3 91.9Q362 97 364.1 100.6Q366.3 104.1 369.7 105.9Q373.2 107.7 377.7 107.7Q382.2 107.7 385.2 106.5Q388.3 105.4 389.9 103.1Q391.5 100.9 391.5 97.7Q391.5 94.4 390 92.1Q388.5 89.7 384.5 87.8Q380.6 85.8 373 83.7Q365.6 81.6 360.9 79Q356.2 76.5 354.1 72.7Q352 68.9 352 63.3Q352 57.1 354.9 52.4Q357.8 47.7 363.2 45Q368.6 42.4 376.2 42.4Q383.7 42.4 389 45.3Q394.4 48.3 397.5 53.5Q400.6 58.7 401.3 65.7L390.3 66.3Q389.8 62.2 388 59Q386.3 55.9 383.2 54.1Q380.2 52.3 375.9 52.3Q369.9 52.3 366.4 55.2Q362.9 58 362.9 62.8Q362.9 65.8 364.4 67.9Q365.8 70 369.3 71.5Q372.9 73.1 379.3 74.9Q387.9 77.3 392.9 80.4Q398 83.5 400.2 87.6Q402.5 91.8 402.5 97.7Q402.5 103.5 399.3 108.1Q396.2 112.7 390.6 115.1Q384.9 117.6 377.3 117.6ZM499.6 117.6Q491 117.6 485.1 113.3Q479.1 108.9 476 100.5Q472.9 92.1 472.9 80.1Q472.9 67.9 476 59.5Q479.1 51.1 485.1 46.7Q491 42.4 499.6 42.4Q508.3 42.4 514.2 46.7Q520.2 51.1 523.3 59.5Q526.4 67.9 526.4 80.1Q526.4 92.1 523.3 100.5Q520.2 108.9 514.2 113.3Q508.3 117.6 499.6 117.6ZM499.6 107.7Q504.7 107.7 508.2 104.6Q511.7 101.6 513.5 95.4Q515.3 89.2 515.3 80.1Q515.3 71 513.5 64.7Q511.7 58.5 508.2 55.4Q504.7 52.3 499.6 52.3Q494.6 52.3 491.1 55.4Q487.6 58.5 485.7 64.7Q483.9 71 483.9 80.1Q483.9 89.2 485.7 95.4Q487.6 101.6 491.1 104.6Q494.6 107.7 499.6 107.7ZM602.4 116L602.4 44L613 44L613 106L647.4 106L647.4 116ZM746.1 117.6Q734.5 117.6 728 110.5Q721.5 103.4 721.5 91L721.5 44L732.2 44L732.2 91.4Q732.2 99.3 735.7 103.5Q739.3 107.7 746.1 107.7Q752.8 107.7 756.4 103.5Q759.9 99.3 759.9 91.4L759.9 44L770.6 44L770.6 91Q770.6 103.4 764.1 110.5Q757.6 117.6 746.1 117.6ZM864 116L864 54L842.9 54L842.9 44L895.6 44L895.6 54L874.5 54L874.5 116ZM971 116L971 44L1015.2 44L1015.2 54L981.6 54L981.6 75L1014 75L1014 84.8L981.6 84.8L981.6 106L1016 106L1016 116Z";
const ABSOLUTE_HORIZONTAL =
  "M0 259.5L30.5 155.5L50.4 155.5L80.9 259.5L64.9 259.5L57.4 232.4L23.4 232.4L16 259.5ZM53.5 218.2L40.4 171.5L27.4 218.2ZM117.3 259.5L117.3 155.5L147.5 155.5Q164.6 155.5 173.6 163Q182.5 170.4 182.5 183.8Q182.5 190.2 179.6 195.3Q176.7 200.3 171.1 203.3Q167.6 205.2 163.3 205.9Q169.2 206.6 173.7 208.7Q180.2 211.9 183.5 217.5Q186.9 223.2 186.9 230.6Q186.9 244.4 177.5 252Q168 259.5 151 259.5ZM132.7 245.2L151.2 245.2Q161.3 245.2 166.1 241.1Q170.9 237.1 170.9 229.9Q170.9 222.3 165.9 218.1Q160.8 213.8 151.2 213.8L132.7 213.8ZM132.7 199.6L147.8 199.6Q157.5 199.6 162 195.7Q166.6 191.8 166.6 184.8Q166.6 177.6 162 173.7Q157.5 169.9 147.8 169.9L132.7 169.9ZM259.1 261.8Q247.8 261.8 239.4 257.3Q231 252.8 226 244.6Q221 236.5 220.2 225.7L236 224.6Q237 232.1 240.1 237.2Q243.2 242.4 248.1 244.9Q253.1 247.5 259.7 247.5Q266.2 247.5 270.6 245.8Q274.9 244.1 277.3 240.9Q279.6 237.7 279.6 233Q279.6 228.3 277.4 224.9Q275.2 221.6 269.5 218.7Q263.8 215.9 252.8 212.8Q242.1 209.8 235.4 206.1Q228.7 202.4 225.6 196.9Q222.5 191.4 222.5 183.3Q222.5 174.4 226.7 167.6Q230.9 160.8 238.7 157Q246.5 153.2 257.5 153.2Q268.4 153.2 276 157.4Q283.7 161.7 288.2 169.2Q292.7 176.7 293.7 186.9L277.9 187.7Q277.1 181.7 274.6 177.2Q272 172.6 267.6 170.1Q263.2 167.5 257.1 167.5Q248.4 167.5 243.4 171.6Q238.3 175.7 238.3 182.6Q238.3 187 240.4 190Q242.4 193 247.6 195.3Q252.7 197.5 261.9 200.2Q274.4 203.6 281.7 208Q289 212.5 292.2 218.5Q295.5 224.5 295.5 233Q295.5 241.5 290.9 248.1Q286.4 254.7 278.2 258.3Q270.1 261.8 259.1 261.8ZM366.5 261.8Q354 261.8 345.5 255.6Q336.9 249.3 332.4 237.1Q327.8 224.9 327.8 207.7Q327.8 190.1 332.4 177.9Q336.9 165.8 345.5 159.5Q354 153.2 366.5 153.2Q378.9 153.2 387.6 159.5Q396.2 165.8 400.7 177.9Q405.2 190.1 405.2 207.7Q405.2 224.9 400.7 237.1Q396.2 249.3 387.6 255.6Q378.9 261.8 366.5 261.8ZM366.5 247.5Q373.8 247.5 378.9 243.1Q383.9 238.7 386.6 229.8Q389.2 220.8 389.2 207.7Q389.2 194.5 386.6 185.5Q383.9 176.5 378.9 172Q373.8 167.5 366.5 167.5Q359.2 167.5 354.1 172Q349.1 176.5 346.4 185.5Q343.8 194.5 343.8 207.7Q343.8 220.8 346.4 229.8Q349.1 238.7 354.1 243.1Q359.2 247.5 366.5 247.5ZM445.6 259.5L445.6 155.5L461 155.5L461 245L510.6 245L510.6 259.5ZM583.9 261.8Q567.2 261.8 557.8 251.6Q548.4 241.3 548.4 223.3L548.4 155.5L563.8 155.5L563.8 223.9Q563.8 235.3 568.9 241.4Q574.1 247.5 583.9 247.5Q593.7 247.5 598.8 241.4Q603.9 235.3 603.9 223.9L603.9 155.5L619.3 155.5L619.3 223.3Q619.3 241.3 609.9 251.6Q600.6 261.8 583.9 261.8ZM684.9 259.5L684.9 170L654.5 170L654.5 155.5L730.6 155.5L730.6 170L700.2 170L700.2 259.5ZM770.2 259.5L770.2 155.5L834.1 155.5L834.1 170L785.6 170L785.6 200.3L832.3 200.3L832.3 214.4L785.6 214.4L785.6 245L835.2 245L835.2 259.5Z";

type BrandProps = {
  className?: string;
  "aria-label"?: string;
  /** Classe de cor das barras azuis. Padrão: text-abs-blue. */
  accentClassName?: string;
};

function a11y(label: string | undefined, decorative: boolean) {
  return decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);
}

/**
 * Logo da Absolute ZRO.
 * - horizontal (padrão): ABSOLUTE |ZRO|, para cabeçalhos e assinaturas em linha
 * - stacked: |ABSOLUTE / ZRO| num bloco só, para heróis, cartões e capas
 */
export function AbsoluteLogo({
  className,
  "aria-label": label = "Absolute ZRO",
  accentClassName,
  variant = "horizontal",
}: BrandProps & { variant?: "horizontal" | "stacked" }) {
  const accent = cn("text-abs-blue", accentClassName);

  if (variant === "stacked") {
    return (
      <svg
        viewBox="0 0 1118 547"
        fill="currentColor"
        {...a11y(label, false)}
        className={cn("h-20 w-auto", className)}
      >
        <g className={accent}>
          <rect width="22" height="547" fill="currentColor" />
          <rect x="1096" width="22" height="547" fill="currentColor" />
        </g>
        <path d={ABSOLUTE_STACKED} />
        <path fillRule="evenodd" transform="translate(102 176)" d={ZRO_PATH} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 2061.2 415"
      fill="currentColor"
      {...a11y(label, false)}
      className={cn("h-8 w-auto", className)}
    >
      <path d={ABSOLUTE_HORIZONTAL} />
      <g className={accent}>
        <rect x="959.2" width="22" height="415" fill="currentColor" />
        <rect x="2039.2" width="22" height="415" fill="currentColor" />
      </g>
      <path fillRule="evenodd" transform="translate(1053.2 44)" d={ZRO_PATH} />
    </svg>
  );
}

/**
 * Símbolo da Absolute ZRO: o "O" da ZRO entre as barras, |O|.
 * Para avatar, favicon, marca d'água e selos. Sem aria-label, fica decorativo.
 */
export function AbsoluteSymbol({ className, "aria-label": label, accentClassName }: BrandProps) {
  return (
    <svg
      viewBox="0 0 495 411"
      fill="currentColor"
      {...a11y(label, !label)}
      className={cn("h-6 w-auto", className)}
    >
      <g className={cn("text-abs-blue", accentClassName)}>
        <rect width="26" height="411" fill="currentColor" />
        <rect x="469" width="26" height="411" fill="currentColor" />
      </g>
      <path fillRule="evenodd" transform="translate(84 42)" d={O_PATH} />
    </svg>
  );
}
