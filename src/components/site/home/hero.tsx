"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform  } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { FilmPlayer, PlayGlyph, type PlayableFilm } from "@/components/site/film-player";
import { OriginField } from "@/components/site/origin-field";
import { LitLines } from "@/components/site/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero({ latest }: { latest: (PlayableFilm & { year?: number | null }) | null }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.35]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const fade = (delay: number) => ({
    initial: { opacity: 0, filter: "blur(8px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    transition: { duration: reduced ? 0 : 1.2, delay: reduced ? 0 : delay, ease: EASE },
  });

  return (
    <section ref={ref} className="relative isolate h-[100svh] min-h-[640px] overflow-hidden" aria-labelledby="hero-title">
      <motion.div className="zro-parallax absolute inset-0 -z-10" style={{ scale: fieldScale, opacity: fieldOpacity }}>
        <OriginField center={{ x: 0.68, y: 0.44 }} mobileCenter={{ x: 0.5, y: 0.32 }} />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-void)_0%,rgb(5_5_5/0.85)_38%,transparent_68%)] lg:bg-[linear-gradient(to_top,var(--color-void)_0%,transparent_45%),linear-gradient(to_right,rgb(5_5_5/0.75)_0%,transparent_55%)]" />

      <motion.div
        className="zro-parallax container-zro relative flex h-full flex-col pt-24 pb-8 sm:pb-10"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <motion.div className="zro-reveal flex items-start justify-between" {...fade(0.4)}>
          <p className="label text-mute">
            <span className="text-ash">Produtora audiovisual</span>
            <span className="hidden sm:inline"> · Natal/RN</span>
          </p>
          <p className="label hidden text-mute sm:block">Filmes · Campanhas · Documentários</p>
        </motion.div>

        <div className="mt-auto grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-4xl">
            <h1 id="hero-title" className="text-h1 text-white">
              <LitLines
                delay={reduced ? 0 : 0.9}
                lines={[
                  "Onde tudo começa",
                  <>
                    e o <span className="accent text-light">comum</span> termina.
                  </>,
                ]}
              />
            </h1>
            <motion.p className="zro-reveal mt-6 max-w-lg text-body-lg text-ash" {...fade(1.4)}>
              Produtora audiovisual e criativa de Natal. Filmes de marca, campanhas, conteúdo e documentários com
              direção, conceito e linguagem cinematográfica.
            </motion.p>
            <motion.div className="zro-reveal mt-8 flex flex-wrap items-center gap-3" {...fade(1.6)}>
              <Link
                href="/filmes"
                className="group inline-flex h-12 items-center gap-4 rounded-full bg-white pr-1.5 pl-6 text-ui font-medium text-void transition-colors hover:bg-light"
              >
                Ver filmes
                <span className="grid size-9 place-items-center rounded-full bg-void text-white transition-transform duration-500 ease-out-expo group-hover:rotate-45">
                  <ArrowUpRight className="size-4" aria-hidden />
                </span>
              </Link>
              <Link
                href="/orcamento"
                className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 text-ui text-light transition-colors hover:border-white/40 hover:bg-white/[0.04]"
              >
                Começar um projeto
              </Link>
            </motion.div>
          </div>

          {latest ? (
            <motion.div className="zro-reveal hidden lg:block" {...fade(1.9)}>
              <FilmPlayer film={latest} className="block">
                <div className="w-[280px] rounded-card border border-white/10 bg-white/[0.03] p-3 opacity-80 backdrop-blur-xl transition-[opacity,border-color] duration-500 hover:border-white/25 hover:opacity-100">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="label text-mute">Último filme</p>
                    <p className="label rounded-full border border-line-strong px-2 py-0.5 text-ash">{latest.year ?? "2026"}</p>
                  </div>
                  <div className="relative aspect-video overflow-hidden rounded-thumb bg-ink">
                    {latest.posterUrl ? (
                      <Image src={latest.posterUrl} alt="" fill sizes="280px" className="object-cover" />
                    ) : null}
                    <div className="absolute inset-0 grid place-items-center">
                      <PlayGlyph size="sm" />
                    </div>
                  </div>
                  <p className="mt-3 px-1 text-ui text-white">
                    {latest.title}
                    <span className="text-mute"> · {latest.client ?? "ZRO"}</span>
                  </p>
                </div>
              </FilmPlayer>
            </motion.div>
          ) : null}
        </div>

        <motion.div className="zro-reveal mt-10 flex items-center justify-between border-t border-line pt-5" {...fade(2.1)}>
          <p className="label text-mute">A seguir: manifesto</p>
          <p className="label flex items-center gap-3 text-mute">
            Role
            <span className="relative block h-px w-10 overflow-hidden bg-white/15">
              <span className="absolute inset-y-0 left-0 w-1/2 animate-[scroll-cue_2.4s_ease-in-out_infinite] bg-white" />
            </span>
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
