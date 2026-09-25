import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";

const { films, teamMembers, showcaseClients, faqs } = schema;

export type Film = typeof films.$inferSelect;

export const getPublishedFilms = cache(async () =>
  db.select().from(films).where(eq(films.published, true)).orderBy(asc(films.sortOrder), desc(films.year)),
);

export const getFilmBySlug = cache(async (slug: string) =>
  db.query.films.findFirst({ where: and(eq(films.slug, slug), eq(films.published, true)) }),
);

export const getTeam = cache(async () =>
  db.select().from(teamMembers).where(eq(teamMembers.published, true)).orderBy(asc(teamMembers.sortOrder)),
);

export const getShowcaseClients = cache(async () =>
  db
    .select()
    .from(showcaseClients)
    .where(eq(showcaseClients.published, true))
    .orderBy(asc(showcaseClients.sortOrder)),
);

export const getFaqs = cache(async () =>
  db.select().from(faqs).where(eq(faqs.published, true)).orderBy(asc(faqs.sortOrder)),
);
