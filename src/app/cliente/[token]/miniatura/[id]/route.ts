import { rotaMiniaturaCliente } from "@/lib/drive/rota-previa";

// Miniatura de uma entrega: link ativo, senha, entregas liberadas e o arquivo em 06 Entregas do cliente.
export const dynamic = "force-dynamic";
export const GET = rotaMiniaturaCliente();
