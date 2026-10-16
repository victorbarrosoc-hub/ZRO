"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { envioDaDiaria, type EnvioDaDiaria } from "@/app/(painel)/painel/projetos/drive-actions";
import { CopiarBotao, WhatsAppTexto } from "@/app/(painel)/painel/projetos/[id]/_components/drive-dialogs";
import { copyText } from "@/app/(painel)/painel/projetos/[id]/_tabs/documentos-client";

/**
 * Link de envio de material na janela da diária (docs/dev/drive.md §7.3). Um link por diária: o freela
 * abre, toca no nome dele e escolhe o cartão. Daqui sai o link copiado ou já no WhatsApp de cada
 * pessoa escalada.
 */
export function DiariaEnvio({ eventId }: { eventId: string }) {
  const [dados, setDados] = useState<EnvioDaDiaria | null>(null);
  const [carregando, iniciarCarga] = useTransition();
  const [gerando, iniciarGeracao] = useTransition();

  useEffect(() => {
    let vivo = true;
    iniciarCarga(async () => {
      try {
        const r = await envioDaDiaria(eventId, false);
        if (vivo) setDados(r);
      } catch {
        if (vivo) setDados({ ok: false, mensagem: "Não deu para ver o link agora." });
      }
    });
    return () => {
      vivo = false;
    };
  }, [eventId]);

  function gerar() {
    iniciarGeracao(async () => {
      let r: EnvioDaDiaria;
      try {
        r = await envioDaDiaria(eventId, true);
      } catch {
        toast.error("Não deu para gerar o link agora. Tente de novo.");
        return;
      }
      setDados(r);
      if (!r.ok) {
        toast.error(r.mensagem);
        return;
      }
      const url = r.link?.estado === "ativo" ? r.link.url : null;
      if (url && (await copyText(url))) toast.success("Link copiado.");
      else toast.success("Link gerado.");
    });
  }

  if (!dados) return <span className="text-mute">{carregando ? "Carregando…" : "—"}</span>;
  if (!dados.ok) return <span className="text-mute">{dados.mensagem}</span>;

  const link = dados.link;
  const ativo = link?.estado === "ativo" ? link : null;
  const rolos = dados.rolos;
  const rolosTexto = rolos ? (
    <Link
      href={`/painel/projetos/${dados.projectId}?aba=drive`}
      className="text-[13px] text-ash underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
    >
      {rolos === 1 ? "1 rolo recebido" : `${rolos} rolos recebidos`}
    </Link>
  ) : null;

  if (!ativo) {
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {link ? <Badge tone={link.estado === "expirado" ? "warn" : "neutral"}>{link.estado === "expirado" ? "Expirado" : "Desativado"}</Badge> : null}
          <Button variant="subtle" size="sm" className="-my-1 h-10 sm:h-8" onClick={gerar} disabled={gerando}>
            <Link2 aria-hidden /> {gerando ? "Gerando…" : link ? "Gerar link novo" : "Gerar link de envio"}
          </Button>
        </div>
        {rolosTexto}
      </div>
    );
  }

  const comTelefone = dados.equipe.filter((p) => p.whatsapp);
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {ativo.url ? <CopiarBotao texto={ativo.url} /> : <span className="text-[13px] text-mute">Troque o link na aba Drive do projeto.</span>}
        {dados.texto ? <WhatsAppTexto texto={dados.texto} /> : null}
      </div>
      {comTelefone.length ? (
        <div className="grid gap-1.5">
          <p className="text-[12px] text-mute">Mandar para quem está escalado</p>
          <ul className="flex flex-wrap gap-1.5">
            {comTelefone.map((p) => (
              <li key={p.id}>
                <a
                  href={p.whatsapp!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-light transition-colors hover:border-white/30 hover:bg-white/[0.06] sm:h-8 [&_svg]:size-3.5"
                >
                  <Send aria-hidden /> {p.nome}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {rolosTexto}
    </div>
  );
}
