"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Antes e depois de cor: a mesma imagem "bruta" (plana, sem contraste) e
 * "absoluta" (com look). O filtro é só demonstração do conceito.
 */
export function CompareSlider({ src, alt = "" }: { src: string; alt?: string }) {
  const [value, setValue] = useState(52);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-media border border-abs-blue/20 bg-black select-none sm:aspect-video">
      {/* Absoluto */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1440px) 1344px, 100vw"
        className="object-cover"
        style={{ filter: "contrast(1.25) brightness(0.95) saturate(1.1)" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[#0a2a6b] mix-blend-color opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_50%_30%,transparent,rgb(0_0_0/0.45))]" />

      {/* Bruto */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1440px) 1344px, 100vw"
          className="object-cover"
          style={{ filter: "contrast(0.62) brightness(1.18) saturate(0.4) sepia(0.12)" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[#5d5d55] mix-blend-screen opacity-25" />
      </div>

      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${value}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white/80 shadow-[0_0_24px_rgb(255_255_255/0.6)]" />
        <div className="absolute top-1/2 -left-6 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/40 backdrop-blur">
          <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>

      <span className="label pointer-events-none absolute top-5 left-5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/80 backdrop-blur">
        Bruto
      </span>
      <span className="label pointer-events-none absolute top-5 right-5 rounded-full border border-abs-ice/40 bg-abs-deep/60 px-3 py-1.5 text-abs-ice backdrop-blur">
        Absoluto
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="Comparar imagem bruta e finalizada"
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
