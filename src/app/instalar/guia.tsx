"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Ellipsis, Plus, Share, SquarePlus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

type Aparelho = "carregando" | "iphone" | "android" | "computador";
type Pedido = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * O passo a passo para pôr o atalho na Tela de Início. A Apple não deixa um site
 * criar o atalho sozinho: no iPhone a página mostra onde tocar no Safari (e abre o
 * Safari, se o link veio de dentro do WhatsApp ou do Instagram). No Android, o
 * Chrome deixa instalar com um toque. Aberto pelo atalho, vai direto para o destino.
 */
export function GuiaInstalar({ nome, destino, endereco }: { nome: string; destino: string; endereco: string }) {
  const [aparelho, setAparelho] = useState<Aparelho>("carregando");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    // já está na Tela de Início: este atalho abre o site (ou o painel) direto
    if (nav.standalone || matchMedia("(display-mode: standalone)").matches) {
      location.replace(destino);
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o aparelho só é conhecido no navegador
    setAparelho(ios ? "iphone" : /Android/i.test(ua) ? "android" : "computador");
    const aoPedir = (e: Event) => {
      e.preventDefault();
      setPedido(e as unknown as Pedido);
    };
    addEventListener("beforeinstallprompt", aoPedir);
    return () => removeEventListener("beforeinstallprompt", aoPedir);
  }, [destino]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão: o endereço continua na tela */
    }
  }

  const passos =
    aparelho === "android"
      ? [
          { icone: <Ellipsis />, texto: "Toque nos três pontinhos do Chrome, no canto de cima." },
          { icone: <SquarePlus />, texto: "Toque em “Adicionar à tela inicial” (ou “Instalar app”)." },
          { icone: <Plus />, texto: `Confirme. O ícone da ${nome} aparece junto com os seus apps.` },
        ]
      : [
          { icone: <Share />, texto: "No Safari, toque em Compartilhar: o quadrado com a seta. No iOS 26, ele fica no botão ••• da barra." },
          { icone: <SquarePlus />, texto: "Role a lista e toque em “Adicionar à Tela de Início”." },
          { icone: <Plus />, texto: `Toque em “Adicionar”. O ícone da ${nome} aparece junto com os seus apps.` },
        ];

  return (
    <div className="grid gap-6">
      {aparelho === "android" && pedido ? (
        <button
          type="button"
          className={buttonClasses({ variant: "primary", size: "lg", className: "w-full" })}
          onClick={async () => {
            await pedido.prompt();
            await pedido.userChoice.catch(() => null);
            setPedido(null);
          }}
        >
          <SquarePlus /> Instalar na tela inicial
        </button>
      ) : null}

      {aparelho === "computador" ? (
        <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-4 text-[14px] leading-relaxed text-ash">
          Abra este endereço no celular, no Safari (iPhone) ou no Chrome (Android), e siga os passos.
        </p>
      ) : null}

      <ol className="grid gap-3">
        {passos.map((p, i) => (
          <li key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-white/[0.02] px-4 py-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white [&_svg]:size-5">{p.icone}</span>
            <span className="grid gap-0.5 pt-0.5">
              <span className="font-mono text-[11px] tracking-[0.18em] text-mute">0{i + 1}</span>
              <span className="text-[15px] leading-snug text-light">{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>

      {aparelho === "iphone" ? (
        <div className="grid gap-2 text-center">
          <p className="text-[13px] text-mute">Abriu dentro do WhatsApp ou do Instagram e não achou a opção?</p>
          <a
            href={endereco.replace(/^https:\/\//, "x-safari-https://")}
            className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full" })}
          >
            Abrir no Safari
          </a>
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-full border border-line bg-white/[0.02] py-1.5 pr-1.5 pl-4">
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ash">{endereco.replace(/^https?:\/\//, "")}</span>
        <button type="button" onClick={copiar} className={buttonClasses({ variant: "subtle", size: "sm" })}>
          {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
