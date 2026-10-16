"use client";

import { useState } from "react";
import { Captions, File, FileArchive, FileText, Film, Folder, Image as ImageIcon, Music } from "lucide-react";
import { extensao, type TipoMidia } from "@/lib/drive/midia";
import { cn } from "@/lib/utils";

/**
 * Miniatura de um arquivo do Drive (docs/dev/drive.md §16): a imagem vem por uma rota do servidor (o link do
 * Google pede sessão), carrega quando aparece na tela e, sem ela, fica o ícone do tipo com a extensão.
 */

const ICONES: Record<TipoMidia, typeof File> = {
  pasta: Folder,
  video: Film,
  audio: Music,
  imagem: ImageIcon,
  pdf: FileText,
  legenda: Captions,
  doc: FileText,
  compactado: FileArchive,
  outro: File,
};

export function IconeDoTipo({ tipo, nome, grande = false, className }: { tipo: TipoMidia; nome: string; grande?: boolean; className?: string }) {
  const Icone = ICONES[tipo];
  const ext = tipo === "pasta" ? "" : extensao(nome).toUpperCase().slice(0, 5);
  return (
    <span className={cn("flex flex-col items-center justify-center gap-2 text-ash", className)} aria-hidden>
      <Icone className={grande ? "size-12" : "size-7"} strokeWidth={1.3} />
      {ext ? <span className={cn("label text-mute", grande && "text-[12px]")}>{ext}</span> : null}
    </span>
  );
}

export function Miniatura({
  src,
  nome,
  tipo,
  duracao,
  className,
  ajuste = "cover",
}: {
  src: string | null;
  nome: string;
  tipo: TipoMidia;
  duracao?: string | null;
  className?: string;
  ajuste?: "cover" | "contain";
}) {
  const [falhou, setFalhou] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const mostrar = src && !falhou;
  return (
    <span className={cn("relative grid place-items-center overflow-hidden bg-graphite", className)}>
      {mostrar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setCarregou(true)}
          onError={() => setFalhou(true)}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-500",
            ajuste === "cover" ? "object-cover" : "object-contain",
            carregou ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {!mostrar || !carregou ? <IconeDoTipo tipo={tipo} nome={nome} /> : null}
      {duracao ? (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/75 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums backdrop-blur-sm">
          {duracao}
        </span>
      ) : null}
    </span>
  );
}
