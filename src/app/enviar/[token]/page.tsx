import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EstadoLink } from "@/components/envio/estado-link";
import { Cabecalho, Moldura } from "@/components/envio/moldura";
import { abrirLinkPublico } from "@/lib/services/drive-publico";
import { EnvioFreela } from "./envio-freela";

/**
 * Link de envio da diária (docs/dev/drive.md §8.2): o freela escolhe quem é, a câmera e o cartão; cada
 * cartão vira um rolo numerado pelo servidor. Os arquivos vão do navegador direto para o Google Drive.
 * Fora da busca (robots, noindex e X-Robots-Tag) e com cabeçalhos próprios (next.config.ts).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Envio de material",
  description: "Do cartão para a ZRO.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { title: "Envio de material · ZRO Filmes", description: "Do cartão para a ZRO." },
};

export default async function EnviarPage({ params }: PageProps<"/enviar/[token]">) {
  const { token } = await params;
  const link = await abrirLinkPublico(token, "freela-diaria");
  if (!link || link.estado === "senha") notFound();

  if (link.estado === "expirado") {
    return (
      <EstadoLink
        rotulo="Link expirado"
        titulo="Este link expirou."
        texto="Peça um novo para a produção da ZRO."
        whatsapp={link.whatsapp}
        mensagem="Olá. O link de envio de material expirou."
      />
    );
  }
  if (link.estado === "desativado") {
    return (
      <EstadoLink
        rotulo="Link desativado"
        titulo="Este link não está mais ativo."
        texto="Peça um novo para a produção da ZRO."
        whatsapp={link.whatsapp}
        mensagem="Olá. O link de envio de material não está mais ativo."
      />
    );
  }
  if (link.estado !== "ok") {
    return (
      <EstadoLink
        rotulo="Envio de material"
        titulo="Não dá para receber o material agora."
        texto="Avise a produção da ZRO."
        whatsapp={link.whatsapp}
        mensagem="Olá. O link de envio de material não está recebendo arquivos."
      />
    );
  }
  if (link.tipo !== "freela-diaria") notFound();

  const { diaria } = link;
  return (
    <Moldura>
      <Cabecalho
        rotulo="Envio de material"
        titulo="Do cartão para a ZRO."
        subtitulo={`${diaria.projeto} · ${diaria.diaria.nome} · ${diaria.diaria.dataLonga}`}
      />
      <EnvioFreela token={token} linkId={link.linkId} diaria={diaria} />
    </Moldura>
  );
}
