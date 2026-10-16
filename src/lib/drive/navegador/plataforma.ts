/**
 * O aparelho e o navegador (só leitura de navigator; no servidor tudo responde "não").
 * WebKit = Safari do Mac e qualquer navegador do iPhone (todos usam o motor da Apple).
 */

const MiB = 1024 * 1024;

function ua(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
}

export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(ua())) return true;
  // iPad com "site para computador": diz que é Mac, mas tem toque.
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
}

export function ehWebKit(): boolean {
  if (ehIOS()) return true;
  const u = ua();
  return /AppleWebKit/.test(u) && /Safari/.test(u) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(u);
}

/** Aberto pelo ícone da tela de início (sem a barra do navegador). */
export function ehAppDaTela(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/** Pedaço por PUT: 32 MiB no computador; 8 MiB no WebKit (memória e os bugs do Safari com corpo grande). */
export function pedacoPadrao(): number {
  return (ehWebKit() ? 8 : 32) * MiB;
}

/** Arquivos ao mesmo tempo: 2 no computador, 1 no iPhone. Partes de um arquivo nunca em paralelo. */
export function paralelosPadrao(): number {
  return ehIOS() ? 1 : 2;
}

/** "Chrome · macOS" (para o diagnóstico; nunca o user agent inteiro). */
export function navegadorResumido(): string {
  const u = ua();
  const nav = /Edg\//.test(u)
    ? "Edge"
    : /OPR\//.test(u)
      ? "Opera"
      : /Firefox|FxiOS/.test(u)
        ? "Firefox"
        : /CriOS/.test(u)
          ? "Chrome"
          : /Chrome|Chromium/.test(u)
            ? "Chrome"
            : /Safari/.test(u)
              ? "Safari"
              : "Navegador";
  const so = ehIOS()
    ? /iPad/.test(u) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel")
      ? "iPad"
      : "iPhone"
    : /Android/.test(u)
      ? "Android"
      : /Mac OS X|Macintosh/.test(u)
        ? "macOS"
        : /Windows/.test(u)
          ? "Windows"
          : /Linux/.test(u)
            ? "Linux"
            : "outro";
  return `${nav}${ehAppDaTela() ? " (app)" : ""} · ${so}`;
}
