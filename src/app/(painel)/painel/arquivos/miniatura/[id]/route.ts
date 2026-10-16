import { rotaMiniaturaPainel } from "@/lib/drive/rota-previa";

// Miniatura de um arquivo do Drive (o thumbnailLink do Google pede sessão). docs/dev/drive.md §16.
export const dynamic = "force-dynamic";
export const GET = rotaMiniaturaPainel();
