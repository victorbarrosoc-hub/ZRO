import { MessageCircle } from "lucide-react";
import { whatsappDigits } from "@/lib/format";
import { Cabecalho, Moldura } from "./moldura";

/**
 * Link que não serve mais (expirado, desativado ou indisponível): diz o que aconteceu e o que fazer,
 * com "Falar no WhatsApp" quando a ZRO tem número cadastrado (docs/dev/drive.md §8.2 e §8.3).
 */
export function EstadoLink({
  rotulo,
  titulo,
  texto,
  whatsapp,
  mensagem,
}: {
  rotulo: string;
  titulo: string;
  texto: string;
  /** Número cadastrado em Ajustes (qualquer formato). */
  whatsapp: string | null;
  /** Texto que já vai escrito na conversa. */
  mensagem?: string;
}) {
  const numero = whatsappDigits(whatsapp);
  const href = numero ? `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}` : null;
  return (
    <Moldura>
      <div className="py-6 sm:py-12">
        <Cabecalho rotulo={rotulo} titulo={titulo} subtitulo={texto} />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-white px-7 text-base font-medium text-void transition-colors hover:bg-light"
          >
            <MessageCircle className="size-5" aria-hidden />
            Falar no WhatsApp
          </a>
        ) : null}
      </div>
    </Moldura>
  );
}
