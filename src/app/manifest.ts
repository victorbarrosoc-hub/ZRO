import type { MetadataRoute } from "next";

/**
 * Manifest do site público: "Adicionar à Tela de Início" no iPhone (e instalar no Android)
 * abre o site como app, sem a barra do navegador.
 * A área interna tem o próprio manifest (src/app/interno.webmanifest/route.ts), que parte deste.
 * Cores = token --color-void (src/app/globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ZRO Filmes",
    short_name: "ZRO",
    description: "Onde tudo começa e o comum termina.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
