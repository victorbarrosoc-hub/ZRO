import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { QuoteStatusBadge } from "@/components/painel/bits";
import { buttonClasses } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { todayISO } from "@/lib/format";
import { getQuoteDocument } from "@/lib/queries/quotes";
import { effectiveQuoteStatus, quoteCode } from "@/lib/services/quotes";
import { Letterhead } from "./letterhead";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: PageProps<"/painel/orcamentos/[id]/timbrado">): Promise<Metadata> {
  const { id } = await params;
  const doc = await getQuoteDocument(id);
  return { title: doc ? `Timbrado ${quoteCode(doc.number, doc.version)}` : "Timbrado" };
}

export default async function TimbradoPage({ params }: PageProps<"/painel/orcamentos/[id]/timbrado">) {
  await requireUser();
  const { id } = await params;
  const doc = await getQuoteDocument(id);
  if (!doc) notFound();
  const status = effectiveQuoteStatus(doc, todayISO());

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/painel/orcamentos/${id}`} className="label inline-flex w-fit items-center gap-2 text-mute hover:text-white">
          <ArrowLeft className="size-3.5" /> Orçamento {quoteCode(doc.number, doc.version)}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <a href={`/painel/orcamentos/${id}/pdf`} download className={buttonClasses({ variant: "primary", size: "sm" })}>
            <Download /> Baixar PDF
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px] text-mute">
        <QuoteStatusBadge status={status} />
        <span>Prévia do que o cliente recebe, sem custos nem margem. O PDF sai com o mesmo desenho.</span>
      </div>

      <Letterhead doc={doc} />
    </div>
  );
}
