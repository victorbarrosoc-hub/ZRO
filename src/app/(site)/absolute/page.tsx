import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AbsoluteEclipse, AbsoluteLogo, AbsoluteSymbol } from "@/components/brand/absolute-logo";
import { Logo } from "@/components/brand/logo";
import { CompareSlider } from "@/components/site/compare-slider";
import { Reveal } from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Absolute ZRO",
  description: "Do bruto ao absoluto. Color grading, finalização de imagem e construção de look.",
};

const SERVICES = [
  { title: "Color grading", text: "A cor como decisão: cada tom a serviço da narrativa." },
  { title: "Finalização de imagem", text: "Limpeza, estabilização, ajustes finos e masterização." },
  { title: "Acabamento", text: "Os detalhes que separam o bom do absoluto." },
  { title: "Construção de look", text: "Uma linguagem visual própria para o seu filme ou marca." },
  { title: "Pós para produtoras", text: "Uma extensão técnica e estética do seu time." },
];

const VERBS = [
  ["Cria.", "Refina."],
  ["Pensa.", "Finaliza."],
  ["Dirige.", "Define."],
  ["Produz.", "Controla."],
  ["Conta.", "Aperfeiçoa."],
];

export default function AbsolutePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1200px] bg-[radial-gradient(60%_50%_at_70%_10%,color-mix(in_srgb,var(--color-abs-blue)_16%,transparent),transparent_70%),radial-gradient(50%_40%_at_10%_0%,color-mix(in_srgb,var(--color-abs-ice)_6%,transparent),transparent_70%)]"
        aria-hidden
      />

      {/* Herói no desenho do board: o logo é o título, o eclipse acende a borda. */}
      <section className="container-zro grid min-h-[88svh] items-center gap-10 pt-28 pb-16 sm:pt-40 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
        <div className="relative z-10">
          <Reveal>
            <h1>
              <AbsoluteLogo className="h-auto w-full max-w-[660px] text-abs-ice" />
            </h1>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-8 font-absolute text-[11px] tracking-[0.55em] text-abs-ice/80 uppercase sm:text-[13px]">
              Color grading &amp; finishing
            </p>
          </Reveal>
          <Reveal delay={0.3} className="mt-16 grid gap-8 sm:mt-20">
            <p className="font-absolute text-[12px] tracking-[0.5em] text-abs-ice uppercase sm:text-[13px]">Do bruto ao absoluto.</p>
            <p className="max-w-lg text-body-lg text-abs-ice/70">
              O braço de finalização da ZRO. Color grading, finalização de imagem, acabamento e construção de look, para os nossos
              filmes e para outras produtoras.
            </p>
            <Link
              href="/orcamento?tipo=finalizacao"
              className="group inline-flex h-12 w-fit items-center gap-4 rounded-full bg-abs-ice pr-1.5 pl-6 text-ui font-medium text-abs-deep transition-colors hover:bg-white"
            >
              Falar sobre finalização
              <span className="grid size-9 place-items-center rounded-full bg-abs-deep text-abs-ice transition-transform duration-500 ease-out-expo group-hover:rotate-45">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          </Reveal>
        </div>
        <Reveal delay={0.2} className="relative order-first lg:order-none">
          <AbsoluteEclipse className="mx-auto h-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[560px]" />
        </Reveal>
      </section>

      {/* O que move a Absolute: as palavras do conceito, empilhadas como no board. */}
      <section className="container-zro grid gap-12 pb-24 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:items-end">
        <Reveal>
          <p className="font-absolute text-[13px] leading-[2.2] tracking-[0.5em] text-abs-ice uppercase">
            Precisão
            <br />
            Controle
            <br />
            Profundidade
            <br />
            Cor
            <br />é o que nos move.
          </p>
          <span className="mt-8 block h-px w-12 bg-abs-blue" aria-hidden />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="max-w-xl text-body-lg text-ash">
            Aqui, cada frame é tratado com precisão, controle e intenção, para que a imagem atinja seu estado mais absoluto.
          </p>
        </Reveal>
      </section>

      <section className="container-zro">
        <Reveal>
          <CompareSlider src="/media/feixe-de-luz.jpg" />
          <p className="mt-4 text-caption text-mute">Arraste para comparar. A mesma imagem, bruta e finalizada.</p>
        </Reveal>
      </section>

      <section className="container-zro section-y grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Reveal>
          <p className="label mb-5 text-abs-ice/70">O conceito</p>
          <h2 className="text-h2 text-white">O zero absoluto é o estado mais frio possível.</h2>
          <p className="mt-6 max-w-md text-body-lg text-ash">
            Por isso, o azul: frio, precisão, controle, profundidade, tecnologia. A imagem em seu estado absoluto.
          </p>
        </Reveal>
        <ul className="border-t border-line">
          {SERVICES.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 0.05} className="grid gap-2 border-b border-line py-7 sm:grid-cols-[64px_240px_1fr] sm:items-baseline">
              <span className="font-mono text-caption text-abs-ice/60">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-h3 font-semibold text-white">{s.title}</span>
              <span className="text-ui text-ash">{s.text}</span>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="border-y border-abs-blue/15 bg-abs-deep/25">
        <div className="container-zro section-y">
          <Reveal className="mb-14 max-w-3xl">
            <p className="label mb-5 text-abs-ice/70">Dois lados da mesma imagem</p>
            <h2 className="text-h2 text-white">
              ZRO é origem, criação e direção. Absolute ZRO é finalização, precisão e estado final.
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 border-t border-abs-blue/20">
            <p className="flex h-14 items-center border-b border-abs-blue/20">
              <Logo className="h-[22px] text-white/45" />
            </p>
            <p className="flex h-14 items-center border-b border-abs-blue/20">
              <AbsoluteLogo className="h-auto w-full max-w-[240px] text-abs-ice" glow={false} />
            </p>
            {VERBS.map(([a, b], i) => (
              <Reveal key={a} delay={i * 0.05} className="col-span-2 grid grid-cols-2 border-b border-abs-blue/20">
                <span className="py-5 text-h2 text-white/40">{a}</span>
                <span className="py-5 text-h2 text-abs-blue">{b}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-zro section-y text-center">
        <Reveal>
          <AbsoluteSymbol className="mx-auto mb-10 size-20" />
          <p className="mx-auto max-w-4xl text-h1 text-white">
            Color como <span className="accent text-abs-blue">decisão</span>.
          </p>
          <Link
            href="/orcamento?tipo=finalizacao"
            className="mt-12 inline-flex h-12 items-center rounded-full border border-abs-ice/40 px-6 text-ui text-abs-ice transition-colors hover:bg-abs-ice hover:text-abs-deep"
          >
            Enviar um projeto para finalizar
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
