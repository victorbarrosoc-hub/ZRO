import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AbsoluteEclipse, AbsoluteLens, AbsoluteLogo, AbsoluteSymbol } from "@/components/brand/absolute-logo";
import { Logo } from "@/components/brand/logo";
import { CompareSlider } from "@/components/site/compare-slider";
import { Reveal } from "@/components/site/reveal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Absolute ZRO",
  description: "Do bruto ao absoluto. Color grading, finalização de imagem e construção de look.",
};

/*
 * A página segue o board da Absolute (brand/absolute-zro/referencia-board.png): painéis pretos
 * separados por um fio, rótulos em caixa alta bem espaçados, Montserrat, o azul só na luz.
 * Só a arte da marca (eclipse e paisagem). Sem mockups de estúdio, porta, roupa ou perfil:
 * a página não mostra nada que a ZRO não tenha de verdade.
 */

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

/* Os três símbolos como o caminho da imagem: do bruto ao estado final. */
const STEPS = [
  { name: "Eclipse", sub: "Mistério / origem", step: "O bruto", Icon: AbsoluteEclipse },
  { name: "Lente", sub: "Precisão / controle", step: "O grading", Icon: AbsoluteLens },
  { name: "Absolute ring", sub: "Estado final", step: "A entrega", Icon: AbsoluteSymbol },
];

/** Rótulo do board: caixa alta, Montserrat, bem espaçado. */
function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-absolute text-[11px] tracking-[0.42em] text-abs-ice uppercase", className)}>{children}</p>;
}

/** Painel preto do board. */
function Panel({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("relative overflow-hidden bg-black", className)}>{children}</div>;
}

function Photo({ src, w, h, alt, className, sizes }: { src: string; w: number; h: number; alt: string; className?: string; sizes: string }) {
  return <Image src={src} width={w} height={h} alt={alt} sizes={sizes} className={cn("h-full w-full object-cover", className)} />;
}

export default function AbsolutePage() {
  return (
    <div className="relative isolate bg-black pt-20 font-absolute">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        {/* Board: fios de 1px entre os painéis */}
        <div className="grid gap-px border border-white/10 bg-white/10">
          {/* Linha 1: logo · eclipse · o que nos move */}
          <div className="grid gap-px bg-white/10 lg:grid-cols-[minmax(0,60fr)_minmax(0,20fr)_minmax(0,20fr)]">
            <Panel className="grid min-h-[420px] place-content-center justify-items-center gap-7 px-6 py-20 text-center lg:min-h-[520px]">
              <Reveal>
                {/* O logo exatamente como o Victor enviou (brand/absolute-zro/logo-original.png). */}
                <h1>
                  <Image
                    src="/media/absolute/logo.png"
                    width={1520}
                    height={310}
                    priority
                    alt="Absolute ZRO · Color grading & finishing"
                    sizes="(min-width: 1024px) 760px, 92vw"
                    className="h-auto w-[min(760px,92vw)] mix-blend-screen"
                  />
                </h1>
              </Reveal>
              <Reveal delay={0.3} className="mt-12 sm:mt-16">
                <Tag className="text-[10px] tracking-[0.55em] sm:text-[12px]">Do bruto ao absoluto.</Tag>
              </Reveal>
            </Panel>
            <div className="grid grid-cols-2 gap-px bg-white/10 lg:contents">
              <Panel className="min-h-[300px]">
                <Photo
                  src="/media/absolute/eclipse.jpg"
                  w={514}
                  h={728}
                  alt="Eclipse: o disco escuro com a borda acesa em azul"
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  className="absolute inset-0"
                />
              </Panel>
              <Panel className="grid content-center px-6 py-10 sm:px-9">
                <Tag className="leading-[2.3]">
                  Precisão
                  <br />
                  Controle
                  <br />
                  Profundidade
                  <br />
                  Cor
                  <br />é o que
                  <br />
                  nos move.
                </Tag>
                <span className="my-7 block h-px w-9 bg-abs-blue" aria-hidden />
                <p className="text-[13px] leading-[1.8] font-light text-abs-ice/85">
                  A Absolute ZRO é o braço especializado em color grading e finalização da ZRO. Aqui, cada frame é tratado com
                  precisão, controle e intenção, para que a imagem atinja seu estado mais absoluto.
                </p>
                <p className="mt-6 text-[12px] tracking-[0.08em] text-abs-ice">Do bruto ao absoluto.</p>
              </Panel>
            </div>
          </div>

          {/* Linha 2: o caminho (os três símbolos) */}
          <Panel className="px-6 py-10 sm:px-9">
            <Tag>Do bruto ao absoluto</Tag>
            <ol className="mt-8 grid gap-px bg-white/10 sm:grid-cols-3">
              {STEPS.map(({ name, sub, step, Icon }, i) => (
                <Reveal as="li" key={name} delay={i * 0.08} className="grid justify-items-center gap-4 bg-black px-4 py-10 text-center">
                  <Icon className="size-28 sm:size-36" />
                  <p className="text-[11px] tracking-[0.42em] text-abs-ice uppercase">{name}</p>
                  <p className="text-[10px] tracking-[0.35em] text-abs-ice/55 uppercase">{sub}</p>
                  <p className="mt-2 text-[13px] font-light text-abs-ice/80">
                    <span className="mr-2 font-mono text-[11px] text-abs-blue">0{i + 1}</span>
                    {step}
                  </p>
                </Reveal>
              ))}
            </ol>
          </Panel>

          {/* Linha 4: bruto × absoluto (arraste) */}
          <Panel className="grid gap-8 px-6 py-10 sm:px-9 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center">
            <div>
              <Tag>Bruto × absoluto</Tag>
              <p className="mt-6 max-w-sm text-[clamp(24px,2.6vw,36px)] leading-[1.15] font-light text-abs-ice">
                A mesma imagem, antes e depois da <span className="text-abs-blue">cor</span>.
              </p>
              <Tag className="mt-8 text-[10px] text-abs-ice/55">Arraste para comparar</Tag>
            </div>
            <div className="mx-auto w-full max-w-[760px]">
              <CompareSlider src="/media/feixe-de-luz.jpg" />
            </div>
          </Panel>

          {/* Linha 5: o que fazemos · ZRO × Absolute */}
          <div className="grid gap-px bg-white/10 lg:grid-cols-2">
            <Panel className="px-6 py-10 sm:px-9">
              <Tag>O que fazemos</Tag>
              <ul className="mt-6">
                {SERVICES.map((s, i) => (
                  <Reveal as="li" key={s.title} delay={i * 0.05} className="grid gap-1 border-b border-white/10 py-5 last:border-b-0 sm:grid-cols-[48px_1fr]">
                    <span className="font-mono text-[11px] text-abs-blue">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block text-[15px] tracking-[0.02em] text-abs-ice">{s.title}</span>
                      <span className="mt-1 block text-[13px] font-light text-abs-ice/60">{s.text}</span>
                    </span>
                  </Reveal>
                ))}
              </ul>
            </Panel>
            <Panel className="px-6 py-10 sm:px-9">
              <Tag>Dois lados da mesma imagem</Tag>
              <div className="mt-6 grid grid-cols-2 border-t border-white/10">
                <p className="flex h-14 items-center border-b border-white/10">
                  <Logo className="h-[18px] text-white/45" />
                </p>
                <p className="flex h-14 items-center border-b border-white/10">
                  <AbsoluteLogo className="h-auto w-full max-w-[210px] text-abs-ice" glow={false} />
                </p>
                {VERBS.map(([a, b], i) => (
                  <Reveal key={a} delay={i * 0.05} className="col-span-2 grid grid-cols-2 border-b border-white/10">
                    <span className="py-4 text-[22px] font-light text-white/35 sm:text-[26px]">{a}</span>
                    <span className="py-4 text-[22px] font-light text-abs-ice sm:text-[26px]">{b}</span>
                  </Reveal>
                ))}
              </div>
            </Panel>
          </div>

          {/* Fecho: a paisagem do board · o convite */}
          <div className="grid gap-px bg-white/10 lg:grid-cols-2">
            <Panel className="aspect-[564/510]">
              <Photo
                src="/media/absolute/paisagem.jpg"
                w={564}
                h={510}
                alt="Paisagem noturna com um feixe de luz: do bruto ao absoluto"
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="absolute inset-0"
              />
            </Panel>
            <Panel className="grid content-center justify-items-start gap-8 px-6 py-16 sm:px-12">
              <AbsoluteSymbol className="size-20" />
              <p className="max-w-md text-[clamp(28px,3.4vw,48px)] leading-[1.1] font-light tracking-[-0.01em] text-abs-ice">
                Color como <span className="text-abs-blue">decisão</span>.
              </p>
              <Link
                href="/orcamento?tipo=finalizacao"
                className="group inline-flex h-12 items-center gap-4 rounded-full bg-abs-ice pr-1.5 pl-6 text-[14px] font-medium text-abs-deep transition-colors hover:bg-white"
              >
                Enviar um projeto para finalizar
                <span className="grid size-9 place-items-center rounded-full bg-abs-deep text-abs-ice transition-transform duration-500 ease-out-expo group-hover:rotate-45">
                  <ArrowUpRight className="size-4" aria-hidden />
                </span>
              </Link>
            </Panel>
          </div>
        </div>
      </div>
      <div className="h-24" aria-hidden />
    </div>
  );
}
