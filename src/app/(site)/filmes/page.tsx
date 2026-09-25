import type { Metadata } from "next";
import { FilmGrid } from "@/components/site/film-grid";
import { LitLines, Reveal } from "@/components/site/reveal";
import { CATEGORY_KEYS } from "@/lib/domain";
import { toFilmSummary } from "@/lib/queries/film-summary";
import { getPublishedFilms } from "@/lib/queries/site";

export const metadata: Metadata = {
  title: "Filmes",
  description: "Filmes de marca, campanhas, conteúdo e documentários dirigidos pela ZRO.",
};

export const revalidate = 300;

export default async function FilmesPage({ searchParams }: PageProps<"/filmes">) {
  const { categoria } = await searchParams;
  const films = (await getPublishedFilms()).map(toFilmSummary);
  const initial =
    typeof categoria === "string" && (CATEGORY_KEYS as string[]).includes(categoria) ? categoria : "todos";

  return (
    <div className="container-zro pt-36 pb-32 sm:pt-44">
      <header className="mb-16 grid gap-8 sm:mb-24 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="label mb-6 text-mute">Portfólio</p>
          <h1 className="text-display text-white">
            <LitLines lines={["Filmes"]} delay={0.1} />
          </h1>
        </div>
        <Reveal delay={0.3}>
          <p className="max-w-sm text-body-lg text-ash">
            Filmes de marca, campanhas, conteúdo e documentários. Cada um começa do zero.
          </p>
        </Reveal>
      </header>
      <FilmGrid films={films} initialCategory={initial} />
    </div>
  );
}
