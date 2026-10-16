import { rotaStreamReserva } from "@/lib/drive/rota-previa";

// Com o service worker ativo, este endereço nunca chega aqui (o SW lê do Google). Sem ele: o próprio Google.
export const dynamic = "force-dynamic";
export const GET = rotaStreamReserva();
