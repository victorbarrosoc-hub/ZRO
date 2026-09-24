import { redirect } from "next/navigation";

/** A lista de filmes mora em /painel/site. */
export default function FilmesIndexPage() {
  redirect("/painel/site");
}
