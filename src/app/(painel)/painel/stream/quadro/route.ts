import { HTML_QUADRO } from "@/lib/drive/stream-sw";

// Quadro da prévia: a página do painel põe o <video> aqui dentro, onde o service worker de /painel/stream/
// cuida dos pedidos. Sem script próprio. docs/dev/drive.md §16.
export const dynamic = "force-static";

export function GET() {
  return new Response(HTML_QUADRO, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "Content-Security-Policy": "default-src 'none'; media-src 'self' blob:; img-src 'self' blob: data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
