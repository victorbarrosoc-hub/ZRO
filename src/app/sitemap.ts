import type { MetadataRoute } from "next";
import { getPublishedFilms } from "@/lib/queries/site";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

const PAGES = [
  { path: "", priority: 1 },
  { path: "/filmes", priority: 0.9 },
  { path: "/sobre", priority: 0.8 },
  { path: "/absolute", priority: 0.7 },
  { path: "/orcamento", priority: 0.8 },
  { path: "/privacidade", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const films = await getPublishedFilms();
  return [
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p.path}`, priority: p.priority })),
    ...films.map((f) => ({ url: `${SITE_URL}/filmes/${f.slug}`, lastModified: f.updatedAt, priority: 0.6 })),
  ];
}
