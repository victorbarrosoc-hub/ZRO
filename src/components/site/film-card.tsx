"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { categoryLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { PlayGlyph } from "./film-player";

export type FilmSummary = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  category: string;
  year: number | null;
  duration: string | null;
  format: string;
  posterUrl: string | null;
  previewUrl: string | null;
  videoUrl: string | null;
  summary: string | null;
};

/** Cartão de filme. Sem pôster, vira uma cartela de título (antes da imagem, a ideia). */
export function FilmCard({
  film,
  className,
  priority,
  aspect = "aspect-[16/10]",
}: {
  film: FilmSummary;
  className?: string;
  priority?: boolean;
  aspect?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(film.videoUrl);

  return (
    <Link
      href={`/filmes/${film.slug}`}
      className={cn("group block focus-visible:outline-offset-4", className)}
      onPointerEnter={() => {
        const v = videoRef.current;
        if (v) void v.play().catch(() => {});
      }}
      onPointerLeave={() => {
        const v = videoRef.current;
        if (v) v.pause();
      }}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[22px] border border-line bg-ink transition-[border-color] duration-500 group-hover:border-white/20",
          aspect,
        )}
      >
        {film.posterUrl ? (
          <>
            <Image
              src={film.posterUrl}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-[1400ms] ease-out-expo group-hover:scale-[1.04]"
            />
            {film.previewUrl ? (
              <video
                ref={videoRef}
                src={film.previewUrl}
                muted
                loop
                playsInline
                preload="none"
                className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </>
        ) : (
          <TitleCard film={film} />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 sm:p-6">
          <span className="label text-white/60">{film.client ?? "ZRO"}</span>
          <span className="label text-white/40">{film.year ?? ""}</span>
        </div>

        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          {hasVideo ? <PlayGlyph size="md" /> : <span className="label rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/70 backdrop-blur">Vídeo em breve</span>}
        </div>

        {film.posterUrl ? (
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <p className="text-[clamp(20px,2vw,28px)] leading-tight font-semibold tracking-[-0.03em] text-white">
              {film.title}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4 px-1">
        <p className="truncate text-[15px] text-light">
          {film.title}
          {film.client ? <span className="text-mute"> · {film.client}</span> : null}
        </p>
        <p className="label shrink-0 text-mute">{categoryLabel(film.category)}</p>
      </div>
    </Link>
  );
}

function TitleCard({ film }: { film: FilmSummary }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(90%_70%_at_70%_35%,rgb(255_255_255/0.05),transparent_70%)]">
      <div className="absolute top-1/2 left-[68%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid size-[min(38vw,220px)] place-items-center rounded-full border border-white/10 transition-[transform,border-color] duration-[1200ms] ease-out-expo group-hover:scale-110 group-hover:border-white/25">
          <div className="absolute size-[62%] rounded-full border border-white/[0.06]" />
          <span className="size-1.5 rounded-full bg-white shadow-[0_0_24px_6px_rgb(255_255_255/0.45)] transition-shadow duration-700 group-hover:shadow-[0_0_48px_14px_rgb(255_255_255/0.55)]" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <p className="max-w-[80%] text-[clamp(24px,2.6vw,40px)] leading-[1.02] font-semibold tracking-[-0.04em] text-white">
          {film.title}
        </p>
        {film.summary ? <p className="mt-2 max-w-[70%] text-[13px] text-mute">{film.summary}</p> : null}
      </div>
    </div>
  );
}
