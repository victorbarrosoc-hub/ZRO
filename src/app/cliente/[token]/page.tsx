import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EstadoLink } from "@/components/envio/estado-link";
import { Cabecalho, Moldura } from "@/components/envio/moldura";
import { buscarLinkPorToken } from "@/lib/services/drive-links";
import { abrirLinkPublico } from "@/lib/services/drive-publico";
import { AreaCliente } from "./area-cliente";
import { Entregas } from "./entregas";
import { SenhaForm } from "./senha-form";

/**
 * Área do cliente (docs/dev/drive.md §8.3): os projetos do cliente do link, só a pasta 06 Entregas de
 * cada um (depois de "Liberar entregas") e o envio de arquivos da empresa para a ZRO. Senha opcional.
 * Fora da busca (robots, noindex e X-Robots-Tag) e com cabeçalhos próprios (next.config.ts).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Área do cliente",
  description: "Seus projetos com a ZRO.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { title: "Área do cliente · ZRO Filmes", description: "Seus projetos com a ZRO." },
};

export default async function ClientePage({ params }: PageProps<"/cliente/[token]">) {
  const { token } = await params;
  const link = await abrirLinkPublico(token, "cliente-area");
  if (!link) notFound();

  if (link.estado === "senha") {
    return (
      <Moldura estreita>
        <div className="py-6 sm:py-12">
          <p className="label mb-4 text-mute">Área protegida</p>
          <h1 className="mb-10 text-[32px] leading-none font-semibold tracking-[-0.04em] text-white">Digite a senha.</h1>
          <SenhaForm token={token} modo="pagina" />
        </div>
      </Moldura>
    );
  }
  if (link.estado === "expirado" || link.estado === "desativado") {
    return (
      <EstadoLink
        rotulo="Área do cliente"
        titulo="Esta área não está mais ativa."
        texto="Fale com a ZRO."
        whatsapp={link.whatsapp}
        mensagem="Olá. A minha área na ZRO não está mais ativa."
      />
    );
  }
  if (link.estado !== "ok") {
    return (
      <EstadoLink
        rotulo="Área do cliente"
        titulo="Não dá para abrir esta área agora."
        texto="Fale com a ZRO."
        whatsapp={link.whatsapp}
        mensagem="Olá. A minha área na ZRO não abre."
      />
    );
  }
  if (link.tipo !== "cliente-area") notFound();

  const { area } = link;
  const temSenha = Boolean((await buscarLinkPorToken(token, "cliente-area"))?.senhaHash);
  return (
    <Moldura>
      <Cabecalho rotulo="Área do cliente" titulo={area.cliente} subtitulo="Seus projetos com a ZRO." />
      <div className="mt-16 grid gap-24 sm:mt-20">
        <Entregas projetos={area.projetos} googleOk={area.googleOk} />
        <AreaCliente
          token={token}
          linkId={link.linkId}
          projetos={area.projetos.map((p) => ({ id: p.id, titulo: p.titulo, mes: p.mes }))}
          googleOk={area.googleOk}
          temSenha={temSenha}
          limiteDiario={area.limiteDiario}
          enviadoHoje={area.enviadoHoje}
          envios={area.envios}
        />
      </div>
    </Moldura>
  );
}
