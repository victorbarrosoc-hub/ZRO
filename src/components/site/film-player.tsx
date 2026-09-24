"use client";

import { Play, X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { parseVideo } from "@/lib/video";
import { cn } from "@/lib/utils";

export type PlayableFilm = {
  title: string;
  client?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  format?: string | null;
};

/** Botão circular de play, no estilo vidro. */
export function PlayGlyph({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-12", md: "size-16", lg: "size-20 sm:size-24" };
  return (
    <span
      className={cn(
        "relative grid place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-all duration-500 ease-out-expo group-hover:scale-105 group-hover:border-white/60 group-hover:bg-white/20 group-hover:shadow-[0_0_60px_rgb(255_255_255/0.35)]",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      <Play className="ml-0.5 size-[34%] fill-current" strokeWidth={0} />
    </span>
  );
}

/**
 * Abre o filme em tela cheia (lightbox). Se o filme ainda não tem link,
 * o gatilho aparece desativado com "vídeo em breve".
 */
export function FilmPlayer({
  film,
  children,
  className,
  label,
}: {
  film: PlayableFilm;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const video = parseVideo(film.videoUrl);
  if (!video) {
    return (
      <span className={cn("cursor-not-allowed", className)} title="Vídeo em breve" aria-disabled>
        {children}
      </span>
    );
  }
  const vertical = film.format === "9:16";

  return (
    <D.Root>
      <D.Trigger className={cn("group cursor-pointer text-left", className)} aria-label={label ?? `Assistir: ${film.title}`}>
        {children}
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm data-[state=open]:animate-[fade-in_300ms]" />
        <D.Content className="fixed inset-0 z-[101] flex flex-col p-4 focus:outline-none data-[state=open]:animate-[fade-in_400ms] sm:p-8">
          <div className="flex items-center justify-between gap-4 pb-4">
            <div className="min-w-0">
              <D.Title className="truncate text-[15px] font-medium text-white">{film.title}</D.Title>
              <D.Description className="label mt-1 text-mute">{film.client ?? "ZRO Filmes"}</D.Description>
            </div>
            <D.Close
              className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
              aria-label="Fechar vídeo"
            >
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center">
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl bg-black shadow-[0_0_120px_rgb(255_255_255/0.06)]",
                vertical ? "aspect-[9/16] h-full max-h-[82dvh]" : "aspect-video w-full max-w-[min(100%,calc(82dvh*16/9))]",
              )}
            >
              {video.kind === "file" ? (
                <video
                  src={video.src}
                  poster={film.posterUrl ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  className="size-full object-contain"
                />
              ) : (
                <iframe
                  src={video.embed}
                  title={film.title}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  className="size-full"
                />
              )}
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
