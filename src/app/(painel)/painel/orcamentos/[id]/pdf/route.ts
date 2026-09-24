import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { readSession } from "@/lib/auth/session";
import { renderQuotePdf } from "@/lib/pdf/quote-document";
import { getQuoteDocument } from "@/lib/queries/quotes";
import { quoteFileName } from "@/lib/services/quotes";

/** PDF do orçamento com o timbrado da ZRO, para baixar e mandar ao cliente. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/painel/orcamentos/[id]/pdf">) {
  // O proxy já barra quem não entrou; aqui é a checagem definitiva.
  if (!(await readSession())) return new Response("Não autorizado.", { status: 401 });
  await requireUser();

  const { id } = await ctx.params;
  const doc = await getQuoteDocument(id);
  if (!doc) return new Response("Orçamento não encontrado.", { status: 404 });

  const pdf = await renderQuotePdf(doc);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quoteFileName(doc.number, doc.version)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
