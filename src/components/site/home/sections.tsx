import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Symbol } from "@/components/brand/logo";
import { FilmGrid } from "@/components/site/film-grid";
import type { FilmSummary } from "@/components/site/film-card";
import { FilmPlayer, PlayGlyph } from "@/components/site/film-player";
import { FaqList } from "@/components/site/faq-list";
import { FramesMosaic } from "@/components/site/frames-mosaic";
import { Reveal } from "@/components/site/reveal";
import { RotatingBadge } from "@/components/site/rotating-badge";
import { CATEGORIES, FUNNEL_PROJECT_TYPES, STAGES, categoryLabel } from "@/lib/domain";
import { initials } from "@/lib/format";
import { FRAMES } from "@/lib/frames";
import { cn } from "@/lib/utils";

export function SectionHeading({
  label,
  title,
  aside,
  className,
}: {
  label: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-6 sm:mb-20", className)}>
      <Reveal className="max-w-3xl">
        <p className="label mb-5 text-mute">{label}</p>
        <h2 className="text-h2 text-white">{title}</h2>
      </Reveal>
      {aside ? <Reveal delay={0.1}>{aside}</Reveal> : null}
    </div>
  );
}

/* ---------------- Destaque ---------------- */

export function FeaturedFilm({ film }: { film: FilmSummary }) {
  return (
    <section className="section-y" aria-labelledby="destaque-titulo">
      <div className="container-zro">
        <Reveal>
          <FilmPlayer film={film} className="block w-full">
            <div className="relative aspect-[4/5] overflow-hidden rounded-media border border-line bg-ink sm:aspect-[21/10]">
              {film.posterUrl ? (
                <Image
                  src={film.posterUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1440px) 1344px, 100vw"
                  className="object-cover transition-transform duration-[1800ms] ease-out-expo group-hover:scale-[1.03]"
                />
              ) : null}
              <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,transparent,rgb(0_0_0/0.55))]" />
              <div className="absolute inset-0 grid place-items-center">
                <PlayGlyph size="lg" />
              </div>
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6 sm:p-8">
                <p className="label text-white/70">Em destaque</p>
                <p className="label text-white/50">{film.year}</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
                <div>
                  <h2 id="destaque-titulo" className="text-h1 text-white">
                    {film.title}
                  </h2>
                  {film.summary ? <p className="mt-3 text-ui text-ash">{film.summary}</p> : null}
                </div>
                <p className="label text-white/60">
                  {film.client ?? "ZRO"} · {categoryLabel(film.category)}
                  {film.duration ? ` · ${film.duration}` : ""}
                </p>
              </div>
            </div>
          </FilmPlayer>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Portfólio ---------------- */

export function PortfolioSection({ films }: { films: FilmSummary[] }) {
  return (
    <section className="section-y pt-0" aria-labelledby="filmes-titulo">
      <div className="container-zro">
        <SectionHeading
          label="Filmes"
          title={<span id="filmes-titulo">Histórias que ganharam direção.</span>}
          aside={
            <Link href="/filmes" className="group inline-flex items-center gap-2 text-ui text-ash transition-colors hover:text-white">
              Ver todos os filmes
              <ArrowUpRight className="size-4 transition-transform duration-500 ease-out-expo group-hover:rotate-45" aria-hidden />
            </Link>
          }
        />
        <FilmGrid films={films} limit={6} />
      </div>
    </section>
  );
}

/* ---------------- Frames ---------------- */

export function FramesSection() {
  return (
    <section className="section-y pt-0" aria-labelledby="frames-titulo">
      <div className="container-zro">
        <SectionHeading label="Frames" title={<span id="frames-titulo">Do contraste nasce a forma.</span>} />
        <FramesMosaic frames={FRAMES} />
      </div>
    </section>
  );
}

/* ---------------- O que fazemos ---------------- */

const FRONTS = CATEGORIES.filter((c) => c.key !== "experiencia");

export function ServicesSection() {
  return (
    <section className="section-y" aria-labelledby="fazemos-titulo">
      <div className="container-zro">
        <SectionHeading
          label="O que fazemos"
          title={
            <span id="fazemos-titulo">
              Conceito, direção, cinematografia, narrativa e <span className="accent">finalização</span>.
            </span>
          }
        />
        <div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-5">
          {FRONTS.map((front, i) => (
            <Reveal
              key={front.key}
              delay={i * 0.06}
              className={cn(
                "group border-b border-line py-8 sm:px-6 sm:first:pl-0 lg:border-b-0 lg:border-l lg:py-10 lg:first:border-l-0",
              )}
            >
              <p className="label mb-10 text-mute">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="text-h3 text-white">{front.label}</h3>
              <p className="mt-3 text-ui leading-relaxed text-ash">{front.description}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          {/* Cartão no desenho do board da Absolute: painel preto, logo, eclipse à direita. */}
          <Link
            href="/absolute"
            className="group relative grid overflow-hidden rounded-media border border-white/10 bg-black font-absolute transition-colors duration-500 hover:border-abs-blue/45 sm:grid-cols-[minmax(0,1fr)_280px]"
          >
            <div className="grid content-center justify-items-start gap-6 p-7 sm:p-10">
              <Image
                src="/media/absolute/logo.png"
                width={1520}
                height={310}
                alt="Absolute ZRO · Color grading & finishing"
                sizes="(min-width: 640px) 520px, 90vw"
                className="-ml-[3%] h-auto w-full max-w-[520px] mix-blend-screen"
              />
              <p className="mt-6 text-[clamp(22px,2.4vw,32px)] leading-tight font-light text-abs-ice">Do bruto ao absoluto.</p>
              <span className="inline-flex items-center gap-3 text-[13px] text-abs-ice/70 transition-colors group-hover:text-abs-ice">
                Conhecer a Absolute ZRO
                <ArrowUpRight className="size-4 transition-transform duration-500 ease-out-expo group-hover:rotate-45" aria-hidden />
              </span>
            </div>
            <div className="relative hidden min-h-[320px] sm:block">
              <Image
                src="/media/absolute/eclipse-alta.jpg"
                alt=""
                fill
                sizes="280px"
                className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-105"
              />
            </div>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Processo ---------------- */

export function ProcessSection() {
  return (
    <section className="section-y relative overflow-hidden" aria-labelledby="processo-titulo">
      <div className="container-zro grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="label mb-5 text-mute">Como pensamos</p>
            <h2 id="processo-titulo" className="text-h2 text-white">
              Toda história começa do zero.
            </h2>
            <p className="mt-5 max-w-md text-body-lg text-ash">Mas é a direção que decide onde ela vai chegar.</p>
          </Reveal>
          <Reveal delay={0.15} className="mt-12 hidden lg:block">
            <RotatingBadge />
          </Reveal>
        </div>
        <ol className="border-t border-line">
          {STAGES.map((stage, i) => (
            <Reveal as="li" key={stage.key} delay={i * 0.04} className="group border-b border-line">
              <div className="grid grid-cols-[56px_1fr] items-baseline gap-4 py-7 sm:grid-cols-[80px_200px_1fr] sm:py-8">
                <span className="font-mono text-caption text-mute transition-colors duration-500 group-hover:text-white">
                  {stage.n}
                </span>
                <span className="text-h3 font-semibold text-white">
                  {stage.label}
                </span>
                <span className="col-start-2 text-ui text-ash sm:col-start-3">{stage.hint}</span>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Quem confia ---------------- */

export function ClientsSection({ clients }: { clients: { id: string; name: string }[] }) {
  if (!clients.length) return null;
  return (
    <section className="section-y pt-0" aria-labelledby="clientes-titulo">
      <div className="container-zro">
        <Reveal>
          <p id="clientes-titulo" className="label mb-10 text-mute">
            Quem confia na ZRO
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ul className="flex flex-wrap items-center gap-x-10 gap-y-6 sm:gap-x-16">
            {clients.map((c, i) => (
              <li key={c.id} className="flex items-center gap-10 sm:gap-16">
                <span className="text-h1 text-white/35 transition-colors duration-500 hover:text-white">
                  {c.name}
                </span>
                {i < clients.length - 1 ? <Symbol className="size-4 text-white/15" /> : null}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Equipe ---------------- */

export function TeamSection({
  team,
}: {
  team: { id: string; name: string; role: string; quote: string | null; photoUrl: string | null }[];
}) {
  if (!team.length) return null;
  return (
    <section className="section-y pt-0" aria-labelledby="equipe-titulo">
      <div className="container-zro">
        <SectionHeading
          label="Quem dirige"
          title={
            <span id="equipe-titulo">
              Grandes filmes são construídos por pessoas diferentes trabalhando em torno de uma mesma visão.
            </span>
          }
        />
        <div className={cn("grid gap-6 sm:grid-cols-2", team.length >= 3 && "lg:grid-cols-3", team.length === 2 && "lg:max-w-4xl")}>
          {team.map((person, i) => (
            <Reveal key={person.id} delay={i * 0.08}>
              <article className="group relative overflow-hidden rounded-card border border-line bg-ink">
                <div className="relative aspect-[4/5] overflow-hidden">
                  {person.photoUrl ? (
                    <Image
                      src={person.photoUrl}
                      alt={person.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover grayscale transition-all duration-[1200ms] ease-out-expo group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(60%_50%_at_50%_45%,rgb(255_255_255/0.06),transparent)]">
                      <div className="grid size-40 place-items-center rounded-full border border-white/10">
                        <span className="text-[44px] font-semibold tracking-[-0.04em] text-white/30">
                          {initials(person.name)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-h3 font-semibold text-white">{person.name}</p>
                  <p className="mt-1 text-sm text-ash">{person.role}</p>
                  {person.quote ? <p className="mt-4 text-ui text-light">“{person.quote}”</p> : null}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Comece aqui (seção de luz) ---------------- */

export function StartSection() {
  return (
    <section className="relative bg-paper text-paper-ink" aria-labelledby="comece-titulo">
      <div className="container-zro section-y">
        <Reveal>
          <p className="label mb-5 text-paper-mute">Comece aqui</p>
          <h2 id="comece-titulo" className="max-w-4xl text-h1">
            Que história você quer <span className="accent">contar</span>?
          </h2>
          <p className="mt-6 max-w-xl text-body-lg text-paper-mute">
            Escolha o tipo de projeto. Em um minuto a gente entende o essencial e a conversa continua no WhatsApp.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <ul className="mt-12 flex flex-wrap gap-3">
            {FUNNEL_PROJECT_TYPES.map((t) => (
              <li key={t.key}>
                <Link
                  href={`/orcamento?tipo=${t.key}`}
                  className="group inline-flex h-14 items-center gap-3 rounded-full border border-paper-line bg-white/60 pr-2 pl-6 text-base font-medium transition-all duration-300 hover:border-paper-ink hover:bg-paper-ink hover:text-paper"
                >
                  {t.label}
                  <span className="grid size-10 place-items-center rounded-full bg-paper-ink text-paper transition-all duration-500 ease-out-expo group-hover:rotate-45 group-hover:bg-paper group-hover:text-paper-ink">
                    <ArrowUpRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Perguntas ---------------- */

export function FaqSection({ faqs }: { faqs: { id: string; question: string; answer: string }[] }) {
  if (!faqs.length) return null;
  return (
    <section className="section-y" aria-labelledby="faq-titulo">
      <div className="container-zro grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Reveal>
          <p className="label mb-5 text-mute">Perguntas frequentes</p>
          <h2 id="faq-titulo" className="text-h2 text-white">
            Antes da primeira conversa.
          </h2>
          <p className="mt-5 max-w-sm text-ui text-ash">
            Não achou o que procurava?{" "}
            <Link href="/orcamento" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
              Fale direto com a gente
            </Link>
            .
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <FaqList items={faqs} />
        </Reveal>
      </div>
    </section>
  );
}
