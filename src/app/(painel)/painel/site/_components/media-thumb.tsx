"use client";

/* eslint-disable @next/next/no-img-element -- prévia do painel: mostra qualquer link, sem passar pelo otimizador */
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Miniatura de imagem para o painel. Sem imagem, mostra a cartela da ZRO
 * (círculo com ponto de luz e o título), como o site faz.
 */
export function MediaThumb({
  src,
  title,
  className,
  rounded = "rounded-[12px]",
}: {
  src?: string | null;
  title?: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const broken = Boolean(src) && failed === src;

  return (
    <span
      className={cn(
        "relative block aspect-[16/10] shrink-0 overflow-hidden border border-line bg-ink",
        rounded,
        className,
      )}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : broken ? (
        <span className="absolute inset-0 grid place-items-center p-2 text-center">
          <span className="grid justify-items-center gap-1 text-[11px] leading-tight text-warn">
            <ImageOff className="size-4" aria-hidden />
            Imagem não encontrada
          </span>
        </span>
      ) : (
        <span className="absolute inset-0 bg-[radial-gradient(90%_70%_at_70%_35%,rgb(255_255_255/0.06),transparent_70%)]">
          <span className="absolute top-1/2 left-[68%] grid aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10">
            <span className="size-1 rounded-full bg-white shadow-[0_0_12px_3px_rgb(255_255_255/0.45)]" />
          </span>
          {title ? (
            <span className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-[11px] leading-tight font-semibold tracking-[-0.02em] text-white">
              {title}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
