/** Qual versão do código está no ar (para conferir um deploy de fora). */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local", ambiente: process.env.VERCEL_ENV ?? "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
