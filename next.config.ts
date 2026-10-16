import type { NextConfig } from "next";

/** Cabeçalhos de segurança de todas as respostas. */
const securityHeaders = [
  // Ninguém coloca o site dentro de um iframe de outro domínio (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/**
 * Google para onde o navegador manda os pedaços do envio (docs/dev/drive.md §8.4). O Google falso dos
 * testes (ZRO_GOOGLE_API_BASE) só vale fora da Vercel, fora de produção e em endereço local, a mesma
 * regra de src/lib/google/config.ts.
 */
function googleApi(): string {
  const base = process.env.ZRO_GOOGLE_API_BASE;
  if (base && !process.env.VERCEL && process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(base);
      if ((u.protocol === "http:" || u.protocol === "https:") && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) {
        return u.origin;
      }
    } catch {
      // base inválida: fica o Google de verdade
    }
  }
  return "https://www.googleapis.com";
}

/**
 * Páginas públicas de envio (/enviar/<código> e /cliente/<código>): o navegador só fala com a ZRO e
 * com o Google; o código da URL não vai no Referer (nem para o Google ao clicar em Baixar); fora da busca.
 * Vêm DEPOIS da regra geral: na Next, a última regra que casa vence para a mesma chave. As outras
 * (X-Frame-Options, nosniff, Permissions-Policy) continuam as da regra geral.
 */
const envioHeaders = [
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors 'self'; connect-src 'self' ${googleApi()}${process.env.NODE_ENV === "production" ? "" : " ws: wss:"}; form-action 'self'; base-uri 'self'`,
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Postgres local (PGlite, WebAssembly): carregado do node_modules, sem passar pelo bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    // Capas do YouTube e do Vimeo e imagens compartilhadas do Google Drive.
    // O painel (Site) só aceita links destes domínios; arquivos em /media valem sempre.
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "i.vimeocdn.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // As fontes do PDF do orçamento são lidas do disco: na Vercel precisam ir junto com a função.
  outputFileTracingIncludes: {
    "/painel/orcamentos/\\[id\\]/pdf": ["./src/lib/pdf/fonts/*.ttf"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/enviar/:path*", headers: envioHeaders },
      { source: "/cliente/:path*", headers: envioHeaders },
    ];
  },
};

export default nextConfig;
