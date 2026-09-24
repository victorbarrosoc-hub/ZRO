import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { todayISO } from "@/lib/format";
import { getImagePolicy } from "../../_lib/image-policy.server";
import { FilmForm } from "../../film-form";

export const metadata: Metadata = { title: "Novo filme" };

export default async function NewFilmPage() {
  await requireUser();
  return (
    <div className="grid gap-8">
      <Link href="/painel/site" className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
        <ArrowLeft className="size-3.5" /> Filmes
      </Link>
      <PageHeader
        label="Site · Portfólio"
        title="Novo filme"
        description="Entra como rascunho no fim da lista. Publique quando o vídeo e o texto estiverem prontos."
      />
      <FilmForm
        policy={getImagePolicy()}
        initial={{
          title: "",
          slug: "",
          client: "",
          category: "filme-de-marca",
          year: todayISO().slice(0, 4),
          duration: "",
          format: "16:9",
          videoUrl: "",
          posterUrl: "",
          previewUrl: "",
          summary: "",
          intention: "",
          credits: [],
          stills: [],
          featured: false,
          published: false,
        }}
      />
    </div>
  );
}
