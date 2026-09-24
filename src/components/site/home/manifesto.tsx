"use client";

import { motion, useMotionTemplate, useScroll, useTransform  } from "motion/react";
import { useRef } from "react";
import { Logo } from "@/components/brand/logo";
import { FilmPlayer, type PlayableFilm } from "@/components/site/film-player";
import { COLOR } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/** Manifesto oficial (documento-mestre §05). Não reescrever. */
const LINES = [
  "Tudo começa do zero.",
  "Até que a luz atravessa a escuridão.",
  "Sem forma. Sem cor. Sem direção.",
  "E do contraste… nasce a forma.",
  "No ponto exato onde intenção vira direção.",
  "E deixa de existir o comum.",
];

function ManifestoLine({ text, index }: { text: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const color = useTransform(scrollYProgress, [0.18, 0.44, 0.56, 0.82], [COLOR.dim, COLOR.white, COLOR.white, COLOR.dim]);
  const blurValue = useTransform(scrollYProgress, [0.18, 0.44, 0.56, 0.82], [10, 0, 0, 10]);
  const filter = useMotionTemplate`blur(${blurValue}px)`;
  const glow = useTransform(scrollYProgress, [0.25, 0.5, 0.75], [0, 1, 0]);
  const glowScale = useTransform(scrollYProgress, [0.25, 0.5, 0.75], [0.6, 1, 0.6]);

  return (
    <div ref={ref} className="relative flex min-h-[58vh] items-center justify-center sm:min-h-[72vh]">
      <motion.div
        aria-hidden
        className="zro-manifesto-glow halo pointer-events-none absolute top-1/2 left-1/2 size-[120vw] max-w-[1100px] -translate-x-1/2 -translate-y-1/2 sm:size-[80vw]"
        style={{ opacity: glow, scale: glowScale }}
      />
      <motion.p
        className="zro-manifesto-line relative max-w-[16ch] text-center text-manifesto"
        style={{ color, filter }}
      >
        <span className="label mb-6 block text-[11px] tracking-[0.3em] text-mute sm:mb-8">
          {String(index + 1).padStart(2, "0")}
        </span>
        {text}
      </motion.p>
    </div>
  );
}

export function Manifesto({ film }: { film: PlayableFilm | null }) {
  return (
    <section className="relative overflow-hidden" aria-label="Manifesto">
      <div className="container-zro">
        <p className="label pt-24 text-center text-mute">Manifesto</p>
        {LINES.map((line, i) => (
          <ManifestoLine key={line} text={line} index={i} />
        ))}
        <div className={cn("relative flex min-h-[80vh] flex-col items-center justify-center pb-24 text-center")}>
          <div className="halo pointer-events-none absolute top-1/2 left-1/2 size-[900px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 opacity-80" aria-hidden />
          <Logo className="relative h-[clamp(48px,9vw,120px)] text-white" />
          <p className="relative mt-8 max-w-[18ch] text-[clamp(24px,3.2vw,44px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
            Onde tudo começa e o comum termina.
          </p>
          {film ? (
            <FilmPlayer film={film} className="relative mt-10" label="Assistir ao manifesto">
              <span className="inline-flex h-12 items-center gap-3 rounded-full border border-line-strong pr-6 pl-2 text-ui text-light transition-colors group-hover:border-white/50 group-hover:bg-white/[0.05]">
                <span className="grid size-9 place-items-center rounded-full bg-white text-void">
                  <svg viewBox="0 0 24 24" className="ml-0.5 size-3.5 fill-current" aria-hidden>
                    <path d="M6 4l14 8-14 8z" />
                  </svg>
                </span>
                Assistir ao manifesto
              </span>
            </FilmPlayer>
          ) : null}
        </div>
      </div>
    </section>
  );
}
