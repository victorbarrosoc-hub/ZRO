import { rotaTokenStream } from "@/lib/drive/rota-previa";

// Token de acesso curto para o service worker da prévia (/painel/stream/). docs/dev/drive.md §16.
export const dynamic = "force-dynamic";
export const GET = rotaTokenStream();
