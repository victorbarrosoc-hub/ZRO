import { redirect } from "next/navigation";

/** A tela agora se chama Pauta. Endereço antigo (favoritos, atalhos) leva para lá. */
export default function QuadroAntigo() {
  redirect("/painel/pauta");
}
