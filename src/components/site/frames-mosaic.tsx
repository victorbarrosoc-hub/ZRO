import Image from "next/image";
import { Reveal } from "@/components/site/reveal";
import type { Frame } from "@/lib/frames";
import { cn } from "@/lib/utils";

/**
 * Linhas do mosaico: destaque (wide) em linha inteira; os outros em pares (7/5, depois 5/7).
 * Quem sobra sem par vira linha inteira, para não deixar buraco.
 */
function layout(frames: Frame[]) {
  const out: { frame: Frame; full: boolean; left: boolean }[] = [];
  let run: Frame[] = [];
  let flip = false;
  const flush = () => {
    for (let i = 0; i < run.length; i += 2) {
      const a = run[i];
      const b = run[i + 1];
      if (!b) {
        out.push({ frame: a, full: true, left: true });
        continue;
      }
      out.push({ frame: a, full: false, left: !flip });
      out.push({ frame: b, full: false, left: flip });
      flip = !flip;
    }
    run = [];
  };
  for (const f of frames) {
    if (f.wide) {
      flush();
      out.push({ frame: f, full: true, left: true });
    } else run.push(f);
  }
  flush();
  return out;
}

/**
 * Mosaico de frames. Em telas largas, duas colunas com o destaque (wide) ocupando a linha;
 * no celular, um embaixo do outro, cada frame no seu formato.
 * - "zro": cantos arredondados, como os filmes da home
 * - "board": painéis pretos colados com fio de 1px, como o board da Absolute
 */
export function FramesMosaic({ frames, variant = "zro" }: { frames: Frame[]; variant?: "zro" | "board" }) {
  const board = variant === "board";
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-12", board ? "gap-px bg-white/10" : "gap-3 sm:gap-4")}>
      {layout(frames).map(({ frame: f, full, left }, i) => {
        const span = full ? "md:col-span-12" : left ? "md:col-span-7" : "md:col-span-5";
        return (
          <Reveal
            key={f.src}
            delay={(i % 2) * 0.06}
            className={cn(
              "relative overflow-hidden bg-black",
              span,
              full ? "md:aspect-[2.39/1]" : "md:aspect-auto md:h-[clamp(260px,32vw,460px)]",
              board ? null : "rounded-media",
            )}
          >
            <Image
              src={f.src}
              width={f.width}
              height={f.height}
              alt={f.alt}
              sizes={full ? "100vw" : "(min-width: 768px) 58vw, 100vw"}
              className="h-auto w-full md:absolute md:inset-0 md:h-full md:object-cover"
            />
          </Reveal>
        );
      })}
    </div>
  );
}
