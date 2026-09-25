import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { categoryLabel } from "@/lib/domain";
import { getFilmAdmin } from "@/lib/queries/admin-content";
import { getImagePolicy } from "../../_lib/image-policy.server";
import { FilmForm } from "../../film-form";
import { DeleteFilmButton } from "../../site-dialogs";

export async function generateMetadata({ params }: PageProps<"/painel/site/filmes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const film = await getFilmAdmin(id);
  return { title: film ? `${film.title} · Filmes` : "Filme" };
}

export default async function EditFilmPage({ params }: PageProps<"/painel/site/filmes/[id]">) {
  await requireUser();
  const { id } = await params;
  const film = await getFilmAdmin(id);
  if (!film) notFound();

  return (
    <div className="grid gap-8">
      <Link href="/painel/site" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Filmes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="label mb-3 text-mute">
            {film.client ?? "ZRO"} · {categoryLabel(film.category)}
          </p>
          <h1 className="text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
            {film.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {film.published ? (
              <Badge tone="ok" dot>
                Publicado
              </Badge>
            ) : (
              <Badge>Rascunho</Badge>
            )}
            {film.featured ? <Badge tone="light">Destaque</Badge> : null}
            {!film.videoUrl ? <Badge tone="warn">Sem vídeo</Badge> : null}
          </div>
        </div>
        <DeleteFilmButton id={film.id} title={film.title} slug={film.slug} fromEditor />
      </header>

      <FilmForm
        policy={getImagePolicy()}
        savedSlug={film.slug}
        savedPublished={film.published}
        initial={{
          id: film.id,
          title: film.title,
          slug: film.slug,
          client: film.client ?? "",
          category: film.category,
          year: film.year ? String(film.year) : "",
          duration: film.duration ?? "",
          format: film.format,
          videoUrl: film.videoUrl ?? "",
          posterUrl: film.posterUrl ?? "",
          previewUrl: film.previewUrl ?? "",
          summary: film.summary ?? "",
          intention: film.intention ?? "",
          credits: film.credits ?? [],
          stills: film.stills ?? [],
          featured: film.featured,
          published: film.published,
        }}
      />
    </div>
  );
}
