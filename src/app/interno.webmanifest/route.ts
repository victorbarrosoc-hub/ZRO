import type { MetadataRoute } from "next";
import siteManifest from "../manifest";

/**
 * Manifest da área interna: o atalho na Tela de Início abre direto o painel.
 * Fica fora de /painel de propósito: o proxy e o robots não o alcançam, e o iPhone
 * precisa ler este arquivo sem login. Não tem nada privado aqui.
 * Usado pelo metadata de src/app/(painel)/painel/layout.tsx e src/app/entrar/page.tsx.
 */
export const dynamic = "force-static";

export function GET() {
  const manifest: MetadataRoute.Manifest = {
    ...siteManifest(),
    id: "/painel",
    name: "ZRO Interno",
    short_name: "ZRO",
    description: "Área interna da ZRO Filmes.",
    start_url: "/painel",
    scope: "/",
  };
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
