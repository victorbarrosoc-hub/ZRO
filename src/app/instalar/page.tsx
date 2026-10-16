import type { Metadata } from "next";
import { TelaInstalar } from "./tela";

export const metadata: Metadata = {
  title: "Instalar no celular",
  description: "Coloque a ZRO na Tela de Início do seu celular.",
  robots: { index: false, follow: true },
};

/** Link para mandar a quem quer o site como app: zrofilmes.vercel.app/instalar */
export default function InstalarPage() {
  return (
    <TelaInstalar
      nome="ZRO"
      rotulo="No seu celular"
      titulo="A ZRO na sua Tela de Início."
      texto="Três toques e o site abre como app, em tela cheia, direto do ícone."
      destino="/"
      caminho="/instalar"
    />
  );
}
