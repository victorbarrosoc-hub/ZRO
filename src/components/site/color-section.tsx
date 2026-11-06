import Image from "next/image";
import { AbsoluteEclipse, AbsoluteLens, AbsoluteSymbol } from "@/components/brand/absolute-logo";
import { CompareSlider } from "@/components/site/compare-slider";
import { FramesMosaic } from "@/components/site/frames-mosaic";
import { Reveal } from "@/components/site/reveal";
import { FRAMES } from "@/lib/frames";

/* O caminho do material: do bruto à entrega. Os três símbolos vêm do board de color da ZRO. */
const STEPS = [
  { name: "O bruto", sub: "LOG · RAW", text: "A imagem como saiu da câmera: plana, aberta, cheia de possibilidade.", Icon: AbsoluteEclipse },
  { name: "O grading", sub: "Balanço · match · pele · look", text: "Cada plano ganha temperatura, contraste e pele, nó a nó, com direção e fotografia.", Icon: AbsoluteLens },
  { name: "A entrega", sub: "Master · versões", text: "O master final e as versões para cada tela em que o filme vai viver.", Icon: AbsoluteSymbol },
] as const;

/**
 * Color grading como parte do processo (etapa 06, Finalização). Antes era uma página à parte;
 * agora mora em Trabalhos: o bruto, o grading, o antes e depois, o DaVinci e frames reais.
 */
export function ColorSection() {
  return (
    <section id="cor" className="mt-32 scroll-mt-28 border-t border-line pt-20 sm:mt-44 sm:pt-28" aria-labelledby="cor-titulo">
      <div className="mb-14 grid gap-8 lg:mb-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <Reveal>
          <p className="label mb-5 text-mute">Processo · 06 Finalização</p>
          <h2 id="cor-titulo" className="text-h1 text-white">
            Cada frame tem uma <span className="text-abs-blue">temperatura</span>.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="max-w-md text-body-lg text-ash">
            O color grading não é um retoque no fim: é uma decisão de direção. Faz parte de todo filme da ZRO, do bruto ao absoluto.
          </p>
        </Reveal>
      </div>

      <ol className="grid gap-px overflow-hidden rounded-media border border-line bg-line sm:grid-cols-3">
        {STEPS.map(({ name, sub, text, Icon }, i) => (
          <Reveal as="li" key={name} delay={i * 0.08} className="grid content-start justify-items-center gap-4 bg-void px-6 py-10 text-center">
            <Icon className="size-28 sm:size-32" />
            <p className="label text-light">
              <span className="mr-2 text-abs-blue">0{i + 1}</span>
              {name}
            </p>
            <p className="label text-mute">{sub}</p>
            <p className="max-w-[28ch] text-ui text-ash">{text}</p>
          </Reveal>
        ))}
      </ol>

      <div className="mt-16 grid gap-8 lg:mt-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center">
        <Reveal>
          <p className="label mb-5 text-mute">Bruto × absoluto</p>
          <p className="max-w-sm text-h3 font-light text-light">
            A mesma imagem, antes e depois da <span className="text-abs-blue">cor</span>.
          </p>
          <p className="label mt-8 text-mute">Arraste para comparar</p>
        </Reveal>
        <Reveal delay={0.1} className="mx-auto w-full max-w-[760px]">
          <CompareSlider src="/media/feixe-de-luz.jpg" />
        </Reveal>
      </div>

      <div className="mt-16 grid gap-8 lg:mt-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center">
        <Reveal>
          <p className="label mb-5 text-mute">Por dentro da cor</p>
          <p className="max-w-sm text-h3 font-light text-light">
            Pele, look, grão e balanço, <span className="text-abs-blue">nó a nó</span>.
          </p>
          <p className="label mt-8 text-mute">DaVinci Resolve Studio</p>
        </Reveal>
        <Reveal delay={0.1} className="overflow-hidden rounded-media border border-line">
          <Image
            src="/media/absolute/davinci.jpg"
            width={2400}
            height={1383}
            alt="Tela do DaVinci Resolve num grading da ZRO: árvore de nós, rodas de cor e waveform"
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="h-auto w-full"
          />
        </Reveal>
      </div>

      <div className="mt-16 lg:mt-24">
        <Reveal>
          <p className="label mb-8 text-mute">Frames finalizados</p>
        </Reveal>
        <FramesMosaic frames={FRAMES} />
      </div>
    </section>
  );
}
