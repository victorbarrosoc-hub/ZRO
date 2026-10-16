import { rotaEnvioPainel } from "@/lib/drive/rota";

// Envio para o Drive pelo painel (Arquivos e o teste de Ajustes). Protocolo em docs/dev/drive.md §5.
export const dynamic = "force-dynamic";
export const POST = rotaEnvioPainel();
