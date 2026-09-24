import type { FilmSummary } from "@/components/site/film-card";
import type { Film } from "./site";

export function toFilmSummary(f: Film): FilmSummary {
  return {
    id: f.id,
    slug: f.slug,
    title: f.title,
    client: f.client,
    category: f.category,
    year: f.year,
    duration: f.duration,
    format: f.format,
    posterUrl: f.posterUrl,
    previewUrl: f.previewUrl,
    videoUrl: f.videoUrl,
    summary: f.summary,
  };
}
