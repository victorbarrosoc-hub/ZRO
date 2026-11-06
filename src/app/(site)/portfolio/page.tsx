import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FilmPlayer, PlayGlyph } from "@/components/site/film-player";
import type { FilmSummary } from "@/components/site/film-card";
import { LitLines, Reveal } from "@/components/site/reveal";
import { CATEGORIES, categoryLabel } from "@/lib/domain";
import { toFilmSummary } from "@/lib/queries/film-summary";
import { getPublishedFilms } from "@/lib/queries/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Portfólio de vídeos",
  description: "Os vídeos da ZRO para assistir: filmes de marca, campanhas, conteúdo e documentários.",
};

export const revalidate = 300;

function Meta({ film }: { film: FilmSummary }) {
  return [film.client ?? "ZRO", film.year, film.duration].filter(Boolean).join(" · ");
}

/** Capa de um vídeo: o pôster (ou uma cartela com o título) e o play por cima. */
function Cover({ film, priority, className }: { film: FilmSummary; priority?: boolean; className: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-card border border-line bg-ink transition-[border-color] duration-500 group-hover:border-white/25", className)}>
      {film.posterUrl ? (
        <Image
          src={film.posterUrl}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_70%_35%,rgb(255_255_255/0.06),transparent_70%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      <div className="absolute inset-0 grid place-items-center">
        <PlayGlyph size="md" />
      </div>
    </div>
  );
}

export default async function PortfolioPage() {
  const films = (await getPublishedFilms()).map(toFilmSummary).filter((f) => f.videoUrl);
  const lead = films.find((f) => f.slug !== "manifesto") ?? films[0] ?? null;
  const groups = CATEGORIES.map((c) => ({ ...c, films: films.filter((f) => f.category === c.key && f.slug !== lead?.slug) })).filter(
    (g) => g.films.length > 0,
  );

  return (
    <div className="container-zro pt-36 pb-32 sm:pt-44">
      <header className="mb-14 grid gap-8 sm:mb-20 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="label mb-6 text-mute">Portfólio de vídeos</p>
          <h1 className="text-display text-white">
            <LitLines lines={["Assista."]} delay={0.1} />
          </h1>
        </div>
        <Reveal delay={0.3}>
          <p className="max-w-sm text-body-lg text-ash">Os vídeos da ZRO num lugar só. Toque em qualquer um para ver em tela cheia, sem sair daqui.</p>
        </Reveal>
      </header>

      {lead ? (
        <Reveal>
          <FilmPlayer film={lead} className="block w-full">
            <Cover film={lead} priority className="aspect-[4/5] sm:aspect-[21/10]" />
            <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <p className="label mb-2 text-mute">Em destaque · {categoryLabel(lead.category)}</p>
                <h2 className="text-h2 text-white">{lead.title}</h2>
              </div>
              <p className="label text-mute">
                <Meta film={lead} />
              </p>
            </div>
          </FilmPlayer>
        </Reveal>
      ) : (
        <p className="py-16 text-center text-mute">Os vídeos entram aqui assim que forem publicados.</p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="mt-20 sm:mt-28" aria-labelledby={`cat-${g.key}`}>
          <Reveal className="mb-8 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-line pb-5">
            <h2 id={`cat-${g.key}`} className="text-h3 text-white">
              {g.label}
            </h2>
            <p className="label text-mute">
              {g.films.length} {g.films.length === 1 ? "vídeo" : "vídeos"}
            </p>
          </Reveal>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {g.films.map((film, i) => (
              <Reveal as="li" key={film.id} delay={(i % 3) * 0.06}>
                <FilmPlayer film={film} className="block w-full">
                  <Cover film={film} className={film.format === "9:16" ? "aspect-[4/5]" : "aspect-[16/10]"} />
                  <p className="mt-4 text-ui font-medium text-white">{film.title}</p>
                  <p className="label mt-1.5 text-mute">
                    <Meta film={film} />
                  </p>
                </FilmPlayer>
              </Reveal>
            ))}
          </ul>
        </section>
      ))}

      <Reveal className="mt-28 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-10 sm:mt-40">
        <p className="max-w-md text-h3 font-light text-light">Gostou do que viu? Vamos começar o seu do zero.</p>
        <Link
          href="/orcamento"
          className="group inline-flex h-12 items-center gap-4 rounded-full bg-white pr-1.5 pl-6 text-sm font-medium text-void transition-colors hover:bg-light"
        >
          Começar um projeto
          <span className="grid size-9 place-items-center rounded-full bg-void text-white transition-transform duration-500 ease-out-expo group-hover:rotate-45">
            <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </Link>
      </Reveal>
    </div>
  );
}
