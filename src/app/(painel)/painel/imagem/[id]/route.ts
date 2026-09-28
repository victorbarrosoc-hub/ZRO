import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";

/**
 * Foto de freela e logo de cliente, só para quem está logado.
 * Cada troca de imagem gera um id novo, então o navegador pode guardar esta por um ano.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/painel/imagem/[id]">) {
  if (!(await getSessionUser())) return new Response("Não autorizado.", { status: 401 });
  const { id } = await ctx.params;
  const image = await db.query.images.findFirst({ where: eq(schema.images.id, id) });
  if (!image) return new Response("Imagem não encontrada.", { status: 404 });

  const body = Buffer.from(image.data, "base64");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
