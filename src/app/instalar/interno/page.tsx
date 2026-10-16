import type { Metadata } from "next";
import { TelaInstalar } from "../tela";

export const metadata: Metadata = {
  title: "Instalar a área interna",
  robots: { index: false, follow: false },
  // o atalho criado aqui abre o painel (mesmo manifest do login e do painel)
  manifest: "/interno.webmanifest",
  appleWebApp: { capable: true, title: "ZRO Interno", statusBarStyle: "black" },
};

/** Link para mandar ao Edu (ou a quem tiver acesso): zrofilmes.vercel.app/instalar/interno */
export default function InstalarInternoPage() {
  return (
    <TelaInstalar
      nome="ZRO Interno"
      rotulo="Área interna"
      titulo="O painel da ZRO na sua Tela de Início."
      texto="Pauta, agenda, CRM e financeiro a um toque. O atalho abre direto na área interna."
      destino="/painel"
      caminho="/instalar/interno"
    />
  );
}
