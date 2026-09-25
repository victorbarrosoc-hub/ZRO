import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TeamSection } from "@/components/site/home/sections";
import { LitLines, Reveal } from "@/components/site/reveal";
import { RotatingBadge } from "@/components/site/rotating-badge";
import { CREATIVE_RULE } from "@/lib/domain";
import { getTeam } from "@/lib/queries/site";

export const metadata: Metadata = {
  title: "Sobre",
  description: "O zero não é ausência. É origem. Conheça o conceito, o processo e as pessoas da ZRO.",
};

export const revalidate = 300;

const CONTRAST = [
  { title: "Preto", items: ["vazio", "silêncio", "origem", "desconhecido", "possibilidade", "espaço antes da criação"] },
  { title: "Branco", items: ["luz", "descoberta", "existência", "revelação", "criação"] },
  { title: "Contraste", items: ["verdade", "definição", "conflito", "escolha", "forma", "direção"] },
];

const VALUES = [
  { title: "Intenção", text: "Nada deve existir apenas porque “fica bonito”. Toda escolha precisa ter uma razão." },
  { title: "Direção", text: "Ideias precisam de direção para ganhar forma." },
  { title: "Essência", text: "Encontrar aquilo que realmente importa na história." },
  { title: "Verdade", text: "A estética deve servir à narrativa." },
  { title: "Criatividade", text: "Buscar caminhos que não sejam óbvios." },
  { title: "Colaboração", text: "Grandes filmes são construídos por pessoas diferentes trabalhando em torno de uma mesma visão." },
  { title: "Excelência", text: "Cada etapa importa: pré-produção, produção, direção, fotografia, edição, cor e finalização." },
];

export default async function SobrePage() {
  const team = await getTeam();

  return (
    <>
      {/* O nome */}
      <section className="container-zro pt-36 pb-24 sm:pt-44">
        <p className="label mb-6 text-mute">Sobre a ZRO</p>
        <h1 className="max-w-5xl text-h1 text-white">
          <LitLines lines={["O zero não é ausência.", <span key="b" className="text-ash">É origem.</span>]} delay={0.1} />
        </h1>
        <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Reveal>
            <p className="label text-mute">O nome</p>
          </Reveal>
          <Reveal delay={0.1} className="grid gap-5 text-h3 leading-snug font-normal text-light">
            <p>“ZRO” é uma forma visual e contemporânea de representar ZERO.</p>
            <p className="text-ash">
              É o ponto anterior à forma. Anterior à cor. Anterior à direção. Anterior à imagem. É onde uma ideia ainda
              pode se tornar qualquer coisa.
            </p>
            <p>Por isso: tudo começa do zero.</p>
          </Reveal>
        </div>
      </section>

      {/* Símbolo */}
      <section className="relative overflow-hidden">
        <Reveal>
          <div className="relative mx-auto aspect-[4/5] max-h-[88vh] w-full sm:aspect-[21/9]">
            <Image src="/media/simbolo-luz.jpg" alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-void),transparent_20%,transparent_80%,var(--color-void))]" />
          </div>
        </Reveal>
      </section>

      {/* Preto e branco */}
      <section className="container-zro section-y">
        <Reveal className="max-w-3xl">
          <p className="label mb-5 text-mute">Preto e branco</p>
          <h2 className="text-h2 text-white">Do preto nasce a luz. Da luz nasce o contraste. Do contraste nasce a forma.</h2>
        </Reveal>
        <div className="mt-16 grid border-t border-line md:grid-cols-3">
          {CONTRAST.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08} className="border-b border-line py-10 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
              <h3 className="text-h3 text-white">{c.title}</h3>
              <ul className="mt-5 grid gap-1.5 text-base text-ash">
                {c.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* A luz revela */}
      <section className="relative isolate overflow-hidden">
        <Image src="/media/feixe-de-luz.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-70" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,var(--color-void),transparent_30%,transparent_70%,var(--color-void))]" />
        <div className="container-zro grid min-h-[90vh] place-items-center py-32 text-center">
          <Reveal>
            <p className="label mb-6 text-ash">A luz</p>
            <p className="text-display text-white">A luz revela.</p>
            <p className="mx-auto mt-8 max-w-xl text-body-lg text-light/80">
              Ela representa o instante em que algo começa a existir. Não deve parecer simplesmente bonita: ela tem
              função narrativa.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Direção */}
      <section className="container-zro section-y grid gap-16 lg:grid-cols-2">
        <Reveal>
          <p className="label mb-5 text-mute">Direção</p>
          <h2 className="text-h2 text-white">Intenção sem direção é possibilidade. Direção transforma possibilidade em linguagem.</h2>
        </Reveal>
        <Reveal delay={0.1} className="grid content-end gap-6 text-body-lg text-ash">
          <p>
            A ZRO não quer apenas executar roteiros. Quer interpretar, construir e dirigir histórias.
          </p>
          <p>
            O comum não é ruim: é o ponto de partida. Uma situação cotidiana pode se tornar cinematográfica. Uma ideia
            simples pode ganhar identidade.
          </p>
          <p className="text-white">A direção transforma o comum.</p>
        </Reveal>
      </section>

      {/* Regra criativa */}
      <section className="bg-paper text-paper-ink">
        <div className="container-zro section-y grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Reveal>
            <p className="label mb-5 text-paper-mute">Regra criativa</p>
            <h2 className="text-h2">Antes de qualquer projeto, a gente responde:</h2>
            <p className="mt-6 max-w-sm text-base text-paper-mute">
              Se não houver resposta clara, o projeto ainda não está pronto.
            </p>
          </Reveal>
          <ol className="border-t border-paper-line">
            {CREATIVE_RULE.map((q, i) => (
              <Reveal as="li" key={q.key} delay={i * 0.05} className="flex items-baseline gap-6 border-b border-paper-line py-6">
                <span className="font-mono text-caption text-paper-mute">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-h3">{q.question}</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Valores */}
      <section className="container-zro section-y">
        <div className="mb-16 flex flex-wrap items-end justify-between gap-10">
          <Reveal className="max-w-2xl">
            <p className="label mb-5 text-mute">Valores</p>
            <h2 className="text-h2 text-white">A estética deve servir à narrativa.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <RotatingBadge />
          </Reveal>
        </div>
        <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={(i % 4) * 0.05} className="bg-void p-7 sm:p-8">
              <p className="label mb-8 text-mute">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="text-h3 text-white">{v.title}</h3>
              <p className="mt-3 text-ui leading-relaxed text-ash">{v.text}</p>
            </Reveal>
          ))}
          <div className="hidden bg-void p-8 lg:flex lg:items-end">
            <Link href="/orcamento" className="group inline-flex items-center gap-2 text-ui text-light">
              Começar um projeto
              <ArrowUpRight className="size-4 transition-transform duration-500 ease-out-expo group-hover:rotate-45" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Parceria */}
      <section className="container-zro pb-12">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="label mb-6 text-mute">Como trabalhamos</p>
          <p className="text-h2 leading-[1.12] text-white">
            Não somos fornecedores. Somos parceiros criativos. Você traz o problema, o objetivo ou a ideia. Juntos
            encontramos conceito, narrativa, linguagem e direção.
          </p>
        </Reveal>
      </section>

      <TeamSection team={team} />
    </>
  );
}
