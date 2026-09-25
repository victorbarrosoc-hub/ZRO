"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { FilmPlayer, PlayGlyph } from "@/components/site/film-player";
import { cn } from "@/lib/utils";

type MakingOf = {
  title: string;
  client: string;
  duration: string;
  /** Vídeo completo, com som: abre em tela cheia. */
  src: string;
  /** Trecho curto, sem som, que roda em loop no bloco. */
  loop: string;
  poster: string;
};

/**
 * Making of em vídeo: o trecho sem som roda em loop só enquanto o bloco está na tela
 * (e nunca com "menos movimento" ligado). O clique abre o vídeo inteiro, com som.
 */
export function MakingOfVideo({ film }: { film: MakingOf }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <FilmPlayer
      film={{ title: `Making of · ${film.title}`, client: film.client, videoUrl: film.src, posterUrl: film.poster }}
      label={`Assistir o making of: ${film.title}`}
      className="block w-full"
    >
      <span className="relative block aspect-video overflow-hidden rounded-media border border-line bg-ink transition-[border-color] duration-500 group-hover:border-white/20">
        <Image src={film.poster} alt="" fill sizes="(min-width: 1440px) 1344px, 100vw" className="object-cover" />
        <video
          ref={videoRef}
          src={film.loop}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" aria-hidden />
        <span className="absolute inset-0 grid place-items-center">
          <PlayGlyph size="lg" className="size-14 sm:size-24" />
        </span>
        <Caption film={film} className="absolute inset-x-0 bottom-0 hidden p-8 sm:flex" />
      </span>
      {/* No celular a legenda fica embaixo, para não brigar com o play. */}
      <Caption film={film} className="flex pt-4 sm:hidden" />
    </FilmPlayer>
  );
}

function Caption({ film, className }: { film: MakingOf; className?: string }) {
  return (
    <span className={cn("items-end justify-between gap-4", className)}>
      <span className="min-w-0">
        <span className="label block text-white/60">Making of</span>
        <span className="mt-2 block truncate text-h3 font-semibold text-white">{film.title}</span>
      </span>
      <span className="label shrink-0 text-white/60">{film.duration}</span>
    </span>
  );
}
