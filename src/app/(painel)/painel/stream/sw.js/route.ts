import { CODIGO_SW } from "@/lib/drive/stream-sw";

// Service worker da prévia, escopo /painel/stream/ (docs/dev/drive.md §16). Sem cache: atualização na hora.
export const dynamic = "force-static";

export function GET() {
  return new Response(CODIGO_SW, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy": "default-src 'self'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
