/* eslint-disable @next/next/no-img-element -- imagem da área interna, servida pela rota logada, sem otimizador */
import { Building2, UserRound } from "lucide-react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Endereço da foto/logo guardada no banco (só abre para quem está logado). */
export function imageUrl(id: string | null | undefined) {
  return id ? `/painel/imagem/${id}` : null;
}

const SIZES = {
  xs: "size-6 text-[9px] [&_svg]:size-3",
  sm: "size-8 text-[11px] [&_svg]:size-3.5",
  md: "size-10 text-[12px] [&_svg]:size-4",
  lg: "size-12 text-[14px] [&_svg]:size-5",
  xl: "size-16 text-[18px] [&_svg]:size-6",
} as const;

/**
 * Foto do freela (redonda) ou logo do cliente (quadrada, cantos suaves).
 * Sem imagem, mostra as iniciais.
 */
export function Avatar({
  name,
  imageId,
  src,
  logo,
  size = "md",
  className,
}: {
  name: string;
  imageId?: string | null;
  /** Prévia local (data URL) antes de salvar. */
  src?: string | null;
  logo?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const url = src ?? imageUrl(imageId);
  const letters = initials(name);
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden border border-line-strong bg-white/[0.04] font-medium text-light",
        logo ? "rounded-[28%]" : "rounded-full",
        SIZES[size],
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : letters ? (
        letters
      ) : logo ? (
        <Building2 className="text-mute" aria-hidden />
      ) : (
        <UserRound className="text-mute" aria-hidden />
      )}
    </span>
  );
}
