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

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
