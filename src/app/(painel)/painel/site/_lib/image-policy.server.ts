import "server-only";
import nextConfig from "../../../../../../next.config";
import type { ImagePolicy } from "./image-policy";

/**
 * Lê a configuração de imagens do next.config, do mesmo jeito que o Next
 * normaliza (URL ou objeto em remotePatterns). Assim o painel acompanha
 * sozinho quando um domínio for liberado.
 */
export function getImagePolicy(): ImagePolicy {
  const images = nextConfig.images ?? {};
  const remotePatterns: ImagePolicy["remotePatterns"] = (images.remotePatterns ?? []).map((p) => {
    const protocol = p.protocol?.replace(/:$/, "");
    return {
      protocol: protocol === "http" ? "http" : protocol === "https" ? "https" : undefined,
      hostname: p.hostname,
      port: p.port,
      pathname: p.pathname,
      search: p.search,
    };
  });
  return {
    unoptimized: Boolean(images.unoptimized),
    domains: [...(images.domains ?? [])],
    remotePatterns,
  };
}
