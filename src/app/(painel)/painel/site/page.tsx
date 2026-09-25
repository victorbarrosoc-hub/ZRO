import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { categoryLabel } from "@/lib/domain";
import { listFilmsAdmin } from "@/lib/queries/admin-content";
import { parseVideo } from "@/lib/video";
import { MediaThumb } from "./_components/media-thumb";
import { FilmRowActions } from "./site-dialogs";
import { SiteTabs } from "./site-tabs";

export const metadata: Metadata = { title: "Filmes do site" };

const VIDEO_KIND = { vimeo: "Vimeo", youtube: "YouTube", file: "Arquivo" } as const;

export default async function SiteFilmesPage() {
  await requireUser();
  const films = await listFilmsAdmin();
  const published = films.filter((f) => f.published);
  const publishedNoVideo = published.filter((f) => !f.videoUrl);
  // O que a página inicial usa: o primeiro publicado com vídeo abre o site ("Último filme")
  // e o primeiro em destaque com vídeo (fora o Manifesto) ganha a seção grande.
  const openerId = published.find((f) => f.videoUrl)?.id;
  const heroId = published.find((f) => f.featured && f.slug !== "manifesto" && f.videoUrl)?.id;

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Site"
        title="Filmes"
        description={`${films.length} filme${films.length === 1 ? "" : "s"} · ${published.length} publicado${published.length === 1 ? "" : "s"}${
          publishedNoVideo.length ? ` · ${publishedNoVideo.length} sem vídeo` : ""
        }`}
        actions={
          <>
            <ButtonLink href="/filmes" target="_blank" variant="secondary">
              Ver no site <ArrowUpRight />
            </ButtonLink>
            <ButtonLink href="/painel/site/filmes/novo" variant="primary">
              <Plus /> Novo filme
            </ButtonLink>
          </>
        }
      />

      <SiteTabs active="filmes" />

      {publishedNoVideo.length ? (
        <Card className="flex items-start gap-3 border-warn/30 p-5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <div className="text-[14px]">
            <p className="text-light">
              {publishedNoVideo.length === 1
                ? "1 filme publicado ainda está sem vídeo."
                : `${publishedNoVideo.length} filmes publicados ainda estão sem vídeo.`}
            </p>
            <p className="mt-1 text-mute">
              No site eles aparecem com “Vídeo em breve”. Cole o link do Vimeo ou do YouTube em cada um.
            </p>
          </div>
        </Card>
      ) : null}

      {films.length ? (
        <Card>
          <ol className="divide-y divide-line">
            {films.map((f, i) => {
              const video = parseVideo(f.videoUrl);
              return (
                <li
                  key={f.id}
                  className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:px-6 xl:grid-cols-[24px_132px_minmax(0,1fr)_auto]"
                >
                  <span className="hidden font-mono text-[12px] text-mute tabular-nums xl:block">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link href={`/painel/site/filmes/${f.id}`} className="block" tabIndex={-1} aria-hidden>
                    <MediaThumb src={f.posterUrl} title={f.title} className={f.published ? undefined : "opacity-60"} />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/painel/site/filmes/${f.id}`}
                      className="block truncate text-[15px] font-medium text-white hover:underline hover:decoration-white/30 hover:underline-offset-4"
                    >
                      {f.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[13px] text-mute">
                      {[f.client ?? "ZRO", categoryLabel(f.category), f.year].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.featured ? <Badge tone="light">Destaque</Badge> : null}
                      {video ? (
                        <Badge>{VIDEO_KIND[video.kind]}</Badge>
                      ) : (
                        <Badge tone="warn">Sem vídeo</Badge>
                      )}
                      {f.id === openerId ? <Badge>Abre o site</Badge> : null}
                      {f.id === heroId ? <Badge>Seção de destaque</Badge> : null}
                    </div>
                  </div>
                  <div className="col-span-2 -ml-1 xl:col-span-1 xl:ml-0">
                    <FilmRowActions
                      film={{ id: f.id, title: f.title, slug: f.slug, published: f.published, featured: f.featured }}
                      first={i === 0}
                      last={i === films.length - 1}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Nenhum filme ainda"
            description="Cadastre o primeiro filme do portfólio. Ele só aparece no site quando você publicar."
            action={
              <ButtonLink href="/painel/site/filmes/novo" variant="primary">
                <Plus /> Novo filme
              </ButtonLink>
            }
          />
        </Card>
      )}

      <p className="max-w-3xl text-[13px] leading-relaxed text-mute">
        A ordem daqui é a ordem do site. O primeiro filme publicado com vídeo abre a página inicial como “Último filme”;
        o primeiro em destaque com vídeo (fora o Manifesto) ganha a seção grande. Imagens e vídeos entram por link:
        ainda não há envio de arquivos.
      </p>
    </div>
  );
}
