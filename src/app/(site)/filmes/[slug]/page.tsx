import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { FilmCard } from "@/components/site/film-card";
import { FilmPlayer, PlayGlyph } from "@/components/site/film-player";
import { LitLines, Reveal } from "@/components/site/reveal";
import { categoryLabel } from "@/lib/domain";
import { toFilmSummary } from "@/lib/queries/film-summary";
import { getFilmBySlug, getPublishedFilms } from "@/lib/queries/site";

export const revalidate = 300;

export async function generateStaticParams() {
  const films = await getPublishedFilms();
  return films.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/filmes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  if (!film) return { title: "Filme" };
  return {
    title: film.client ? `${film.title} · ${film.client}` : film.title,
    description: film.summary ?? undefined,
    openGraph: film.posterUrl ? { images: [{ url: film.posterUrl }] } : undefined,
  };
}

export default async function FilmPage({ params }: PageProps<"/filmes/[slug]">) {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  if (!film) notFound();

  const all = await getPublishedFilms();
  const index = all.findIndex((f) => f.id === film.id);
  const next = all.length > 1 ? all[(index + 1) % all.length] : null;

  const details = [
    { label: "Cliente", value: film.client },
    { label: "Categoria", value: categoryLabel(film.category, "label") },
    { label: "Ano", value: film.year ? String(film.year) : null },
    { label: "Duração", value: film.duration },
    { label: "Formato", value: film.format },
  ].filter((d) => d.value);

  return (
    <article className="pt-32 sm:pt-40">
      <div className="container-zro">
        <Link href="/filmes" className="label inline-flex items-center gap-2 text-mute transition-colors hover:text-white">
          <ArrowLeft className="size-3.5" aria-hidden /> Filmes
        </Link>
        <header className="mt-10 mb-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="label mb-5 text-mute">
              {film.client ?? "ZRO"} · {categoryLabel(film.category)}
            </p>
            <h1 className="text-h1 text-white">
              <LitLines lines={[film.title]} delay={0.1} />
            </h1>
          </div>
          {film.summary ? (
            <Reveal delay={0.3}>
              <p className="max-w-sm text-body-lg text-ash">{film.summary}</p>
            </Reveal>
          ) : null}
        </header>

        <Reveal>
          <FilmPlayer film={film} className="block w-full">
            <div className="relative aspect-video overflow-hidden rounded-[28px] border border-line bg-ink">
              {film.posterUrl ? (
                <Image src={film.posterUrl} alt="" fill priority sizes="(min-width: 1440px) 1344px, 100vw" className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgb(255_255_255/0.06),transparent)]" />
              )}
              <div className="absolute inset-0 grid place-items-center">
                {film.videoUrl ? (
                  <PlayGlyph size="lg" />
                ) : (
                  <span className="label rounded-full border border-white/20 bg-black/40 px-4 py-2 text-white/70 backdrop-blur">
                    Vídeo em breve
                  </span>
                )}
              </div>
            </div>
          </FilmPlayer>
        </Reveal>

        <div className="section-y grid gap-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <Reveal>
            <p className="label mb-6 text-mute">A intenção</p>
            <p className="text-[clamp(22px,2.4vw,34px)] leading-[1.25] font-medium tracking-[-0.025em] text-light">
              {film.intention ?? film.summary ?? "Em breve, a história por trás deste filme."}
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <dl className="border-t border-line">
              {details.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between gap-6 border-b border-line py-4">
                  <dt className="label text-mute">{d.label}</dt>
                  <dd className="text-right text-[15px] text-light">{d.value}</dd>
                </div>
              ))}
            </dl>
            {film.credits?.length ? (
              <div className="mt-12">
                <p className="label mb-4 text-mute">Ficha técnica</p>
                <dl className="grid gap-3">
                  {film.credits.map((c) => (
                    <div key={`${c.role}-${c.name}`} className="flex items-baseline justify-between gap-6">
                      <dt className="text-[14px] text-mute">{c.role}</dt>
                      <dd className="text-right text-[14px] text-light">{c.name}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </Reveal>
        </div>

        {film.stills?.length ? (
          <div className="grid gap-4 pb-24 sm:grid-cols-2">
            {film.stills.map((src, i) => (
              <Reveal key={src} delay={(i % 2) * 0.08} className={i % 3 === 0 ? "sm:col-span-2" : undefined}>
                <div className="relative aspect-video overflow-hidden rounded-[20px] bg-ink">
                  <Image src={src} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
                </div>
              </Reveal>
            ))}
          </div>
        ) : null}

        <div className="grid gap-12 border-t border-line py-20 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="label mb-5 text-mute">Próximo passo</p>
            <p className="text-h2 text-white">Tem uma história pra contar?</p>
            <Link
              href="/orcamento"
              className="group mt-8 inline-flex h-12 items-center gap-4 rounded-full bg-white pr-1.5 pl-6 text-[15px] font-medium text-void transition-colors hover:bg-light"
            >
              Começar um projeto
              <span className="grid size-9 place-items-center rounded-full bg-void text-white transition-transform duration-500 ease-out-expo group-hover:rotate-45">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          </Reveal>
          {next && next.id !== film.id ? (
            <Reveal delay={0.1}>
              <p className="label mb-4 text-mute">Próximo filme</p>
              <FilmCard film={toFilmSummary(next)} />
            </Reveal>
          ) : null}
        </div>
      </div>
    </article>
  );
}
