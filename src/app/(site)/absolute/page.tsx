import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CompareSlider } from "@/components/site/compare-slider";
import { LitLines, Reveal } from "@/components/site/reveal";

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
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1200px] bg-[radial-gradient(60%_50%_at_70%_10%,rgb(76_141_255/0.22),transparent_70%),radial-gradient(50%_40%_at_10%_0%,rgb(169_200_255/0.08),transparent_70%)]"
        aria-hidden
      />

      <section className="container-zro pt-36 pb-20 sm:pt-44">
        <p className="label mb-6 text-abs-ice/80">Absolute ZRO · Finalização</p>
        <h1 className="text-display text-white">
          <LitLines lines={["Do bruto", <span key="b" className="text-abs-ice">ao absoluto.</span>]} delay={0.1} />
        </h1>
        <Reveal delay={0.4} className="mt-10 grid gap-8 lg:grid-cols-2">
          <p className="max-w-xl text-body-lg text-abs-ice/75">
            O braço de finalização da ZRO. Color grading, finalização de imagem, acabamento e construção de look, para
            os nossos filmes e para outras produtoras.
          </p>
          <div className="flex items-end lg:justify-end">
            <Link
              href="/orcamento?tipo=finalizacao"
              className="group inline-flex h-12 items-center gap-4 rounded-full bg-abs-ice pr-1.5 pl-6 text-[15px] font-medium text-abs-deep transition-colors hover:bg-white"
            >
              Falar sobre finalização
              <span className="grid size-9 place-items-center rounded-full bg-abs-deep text-abs-ice transition-transform duration-500 ease-out-expo group-hover:rotate-45">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="container-zro">
        <Reveal>
          <CompareSlider src="/media/feixe-de-luz.jpg" />
          <p className="mt-4 text-[13px] text-mute">Arraste para comparar. A mesma imagem, bruta e finalizada.</p>
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
              <span className="font-mono text-[13px] text-abs-ice/60">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[22px] font-semibold tracking-[-0.03em] text-white">{s.title}</span>
              <span className="text-[15px] text-ash">{s.text}</span>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="border-y border-abs-blue/15 bg-abs-deep/60">
        <div className="container-zro section-y">
          <Reveal className="mb-14 max-w-3xl">
            <p className="label mb-5 text-abs-ice/70">Dois lados da mesma imagem</p>
            <h2 className="text-h2 text-white">
              ZRO é origem, criação e direção. Absolute ZRO é finalização, precisão e estado final.
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 border-t border-abs-blue/20">
            <p className="label border-b border-abs-blue/20 py-4 text-mute">ZRO</p>
            <p className="label border-b border-abs-blue/20 py-4 text-abs-ice/80">Absolute ZRO</p>
            {VERBS.map(([a, b], i) => (
              <Reveal key={a} delay={i * 0.05} className="col-span-2 grid grid-cols-2 border-b border-abs-blue/20">
                <span className="py-5 text-[clamp(24px,3.4vw,48px)] font-semibold tracking-[-0.04em] text-white/40">{a}</span>
                <span className="py-5 text-[clamp(24px,3.4vw,48px)] font-semibold tracking-[-0.04em] text-abs-ice">{b}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-zro section-y text-center">
        <Reveal>
          <p className="mx-auto max-w-4xl text-h1 text-white">
            Color como <span className="accent text-abs-ice">decisão</span>.
          </p>
          <Link
            href="/orcamento?tipo=finalizacao"
            className="mt-12 inline-flex h-12 items-center rounded-full border border-abs-ice/40 px-6 text-[15px] text-abs-ice transition-colors hover:bg-abs-ice hover:text-abs-deep"
          >
            Enviar um projeto para finalizar
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
