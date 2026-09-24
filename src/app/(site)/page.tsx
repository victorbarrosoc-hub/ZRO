import { Hero } from "@/components/site/home/hero";
import { Manifesto } from "@/components/site/home/manifesto";
import {
  ClientsSection,
  FaqSection,
  FeaturedFilm,
  PortfolioSection,
  ProcessSection,
  ServicesSection,
  StartSection,
  TeamSection,
} from "@/components/site/home/sections";
import { Marquee } from "@/components/site/marquee";
import { toFilmSummary } from "@/lib/queries/film-summary";
import { getFaqs, getPublishedFilms, getShowcaseClients, getTeam } from "@/lib/queries/site";

export const revalidate = 300;

export default async function HomePage() {
  const [filmRows, team, clients, faqs] = await Promise.all([
    getPublishedFilms(),
    getTeam(),
    getShowcaseClients(),
    getFaqs(),
  ]);
  const films = filmRows.map(toFilmSummary);
  const manifesto = films.find((f) => f.slug === "manifesto") ?? null;
  const withVideo = films.filter((f) => f.videoUrl);
  const latest = withVideo[0] ?? null;
  const featuredRow = filmRows.find((f) => f.featured && f.slug !== "manifesto" && f.videoUrl);
  const featured = featuredRow ? toFilmSummary(featuredRow) : null;

  return (
    <>
      <Hero latest={latest} />
      <Manifesto film={manifesto} />
      <Marquee items={["Filmes de marca", "Campanhas", "Conteúdo", "Documental", "Direção criativa"]} />
      {featured ? <FeaturedFilm film={featured} /> : null}
      <PortfolioSection films={films} />
      <ServicesSection />
      <ProcessSection />
      <ClientsSection clients={clients} />
      <TeamSection team={team} />
      <StartSection />
      <FaqSection faqs={faqs} />
    </>
  );
}
