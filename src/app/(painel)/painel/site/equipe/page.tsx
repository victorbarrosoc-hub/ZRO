/* eslint-disable @next/next/no-img-element -- miniatura do painel, sem otimizador */
import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { initials } from "@/lib/format";
import { listTeamAdmin } from "@/lib/queries/admin-content";
import { getImagePolicy } from "../_lib/image-policy.server";
import { NewTeamMemberButton, TeamRowActions } from "../content-dialogs";
import { SiteTabs } from "../site-tabs";

export const metadata: Metadata = { title: "Equipe do site" };

export default async function SiteEquipePage() {
  await requireUser();
  const team = await listTeamAdmin();
  const policy = getImagePolicy();
  const published = team.filter((t) => t.published).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Site"
        title="Equipe"
        description={`${published} de ${team.length} no site. Aparece em “Quem dirige”, na página inicial e em Sobre.`}
        actions={<NewTeamMemberButton policy={policy} />}
      />
      <SiteTabs active="equipe" />

      {team.length ? (
        <Card>
          <ol className="divide-y divide-line">
            {team.map((m, i) => (
              <li
                key={m.id}
                className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[56px_minmax(0,1fr)_auto]"
              >
                <span className="relative grid size-14 place-items-center overflow-hidden rounded-full border border-line-strong bg-white/[0.04] text-[16px] font-medium text-light">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt="" className="absolute inset-0 size-full object-cover grayscale" />
                  ) : (
                    initials(m.name)
                  )}
                </span>
                <div className="min-w-0">
                  <p className={m.published ? "truncate text-[15px] font-medium text-white" : "truncate text-[15px] font-medium text-white/50"}>{m.name}</p>
                  <p className="truncate text-[13px] text-ash">{m.role}</p>
                  {m.quote ? <p className="mt-1 line-clamp-2 text-[13px] text-mute">“{m.quote}”</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!m.photoUrl ? <Badge>Sem foto</Badge> : null}
                  </div>
                </div>
                <div className="col-span-2 -ml-1 lg:col-span-1 lg:ml-0">
                  <TeamRowActions
                    policy={policy}
                    first={i === 0}
                    last={i === team.length - 1}
                    member={{
                      id: m.id,
                      name: m.name,
                      role: m.role,
                      quote: m.quote,
                      photoUrl: m.photoUrl,
                      instagram: m.instagram,
                      published: m.published,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Ninguém na equipe do site"
            description="Sem ninguém publicado, a seção “Quem dirige” some do site."
            action={<NewTeamMemberButton policy={policy} />}
          />
        </Card>
      )}

      <p className="text-[13px] text-mute">A ordem daqui é a ordem dos cartões no site.</p>
    </div>
  );
}
