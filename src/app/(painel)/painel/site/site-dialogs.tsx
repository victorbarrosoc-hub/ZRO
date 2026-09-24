"use client";

import Link from "next/link";
import { Pencil, Star, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { deleteFilm, moveFilm, toggleFilmFeatured, toggleFilmPublished } from "./actions";
import { IconButton, OrderButtons, ToggleSwitch, useQuickAction } from "./_components/list-controls";

type RowFilm = { id: string; title: string; slug: string; published: boolean; featured: boolean };

/** Ações de cada linha da lista de filmes. */
export function FilmRowActions({ film, first, last }: { film: RowFilm; first: boolean; last: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      <ToggleSwitch
        action={toggleFilmPublished}
        fields={{ id: film.id }}
        checked={film.published}
        label={`Mostrar “${film.title}” no site`}
        onLabel="No site"
        offLabel="Rascunho"
      />
      <FeaturedToggle id={film.id} title={film.title} featured={film.featured} />
      <OrderButtons action={moveFilm} id={film.id} first={first} last={last} name="filme" />
      <Tip content="Editar">
        <Link
          href={`/painel/site/filmes/${film.id}`}
          aria-label={`Editar ${film.title}`}
          className="grid size-10 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light sm:size-9"
        >
          <Pencil className="size-4" />
        </Link>
      </Tip>
      <DeleteFilmButton id={film.id} title={film.title} slug={film.slug} compact />
    </div>
  );
}

function FeaturedToggle({ id, title, featured }: { id: string; title: string; featured: boolean }) {
  const { pending, run } = useQuickAction(toggleFilmFeatured);
  return (
    <IconButton
      label={featured ? "Tirar do destaque" : "Marcar como destaque"}
      aria-label={featured ? `Tirar “${title}” do destaque` : `Marcar “${title}” como destaque`}
      aria-pressed={featured}
      disabled={pending}
      onClick={() => run({ id })}
      className={cn(featured && "text-white")}
    >
      <Star className={cn(featured && "fill-current")} />
    </IconButton>
  );
}

export function DeleteFilmButton({
  id,
  title,
  slug,
  compact,
  fromEditor,
}: {
  id: string;
  title: string;
  slug: string;
  compact?: boolean;
  fromEditor?: boolean;
}) {
  const manifesto = slug === "manifesto";
  return (
    <ConfirmAction
      title={`Excluir “${title}”?`}
      description={
        manifesto
          ? "Este é o filme do manifesto: a seção do manifesto na página inicial fica sem vídeo. Não dá para desfazer."
          : "O filme sai do site na hora e a página dele deixa de existir. Não dá para desfazer."
      }
      confirmLabel="Excluir filme"
      action={deleteFilm}
      fields={fromEditor ? { id, from: "editor" } : { id }}
      trigger={
        compact ? (
          <IconButton label={`Excluir ${title}`} tip={false} className="hover:bg-danger/10 hover:text-danger">
            <Trash2 />
          </IconButton>
        ) : (
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger">
            <Trash2 /> Excluir
          </Button>
        )
      }
    />
  );
}
