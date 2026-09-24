/**
 * Quais endereços de imagem o site consegue mostrar.
 *
 * O site usa `next/image` para pôsteres, stills e fotos da equipe. Arquivo
 * local (/media/...) funciona sempre; link externo só funciona se o domínio
 * estiver liberado em `images.remotePatterns` no next.config (sem isso, o
 * Next quebra a página em desenvolvimento e mostra imagem vazia em produção).
 * Por isso o painel confere o link antes de salvar.
 *
 * Serve para o servidor (validação) e para o navegador (aviso e prévia).
 */
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";

export type ImagePolicy = {
  unoptimized: boolean;
  domains: string[];
  remotePatterns: {
    protocol?: "http" | "https";
    hostname: string;
    port?: string;
    pathname?: string;
    search?: string;
  }[];
};

/** Link de compartilhamento do Google Drive → endereço direto da imagem. */
export function normalizeImageUrl(value: string) {
  const v = value.trim();
  const drive =
    v.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) ??
    v.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]{10,})/);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}`;
  return v;
}

export function isLocalPath(src: string) {
  return src.startsWith("/") && !src.startsWith("//");
}

/**
 * Problema com o endereço de uma imagem do site, em português, ou null se o
 * site consegue mostrar. Recebe o endereço já normalizado.
 */
export function imageSrcProblem(src: string, policy: ImagePolicy): string | null {
  const value = src.trim();
  if (!value) return null;
  if (value.startsWith("//")) return "Use o endereço completo, começando com https://.";
  if (value.startsWith("/")) {
    if (/\s/.test(value)) return "O caminho do arquivo não pode ter espaços.";
    if (/[?#]/.test(value)) return "Tire o trecho com ? ou # do fim do caminho.";
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Endereço inválido. Use um arquivo do site (/media/nome.jpg) ou um link https://.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Use um link https://.";
  if (policy.unoptimized) return null;
  try {
    if (hasRemoteMatch(policy.domains, policy.remotePatterns, url)) return null;
  } catch {
    // padrão mal escrito no next.config: trata como não liberado
  }
  return `O site ainda não mostra imagens de ${url.hostname}. Use um arquivo em /media ou libere esse domínio no next.config.`;
}

/** Domínios liberados, para mostrar na tela ("nenhum ainda"). */
export function allowedImageHosts(policy: ImagePolicy) {
  if (policy.unoptimized) return ["qualquer domínio"];
  return [...new Set([...policy.domains, ...policy.remotePatterns.map((p) => p.hostname)])];
}
