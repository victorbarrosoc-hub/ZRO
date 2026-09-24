import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

export type PdfFonts = { sans: string; mono: string };

/** Fontes padrão do PDF, sem arquivo: usadas se as da marca falharem. */
export const FALLBACK_FONTS: PdfFonts = { sans: "Helvetica", mono: "Courier" };

const SANS = "ZRO Inter";
const MONO = "ZRO Mono";

// Caminhos literais a partir da raiz do projeto, para o rastreamento de arquivos do Next achar as fontes.
const fontFile = {
  inter400: () => readFileSync(join(process.cwd(), "src/lib/pdf/fonts/Inter-Regular.ttf")),
  inter500: () => readFileSync(join(process.cwd(), "src/lib/pdf/fonts/Inter-Medium.ttf")),
  inter600: () => readFileSync(join(process.cwd(), "src/lib/pdf/fonts/Inter-SemiBold.ttf")),
  mono400: () => readFileSync(join(process.cwd(), "src/lib/pdf/fonts/GeistMono-Regular.ttf")),
  mono500: () => readFileSync(join(process.cwd(), "src/lib/pdf/fonts/GeistMono-Medium.ttf")),
};

const dataUrl = (buf: Buffer) => `data:font/ttf;base64,${buf.toString("base64")}`;

let registered: PdfFonts | null = null;

/**
 * Registra Inter e Geist Mono (as fontes da marca) uma vez por processo.
 * Sem os arquivos, cai para Helvetica/Courier e o PDF sai do mesmo jeito.
 */
export function registerPdfFonts(): PdfFonts {
  if (registered) return registered;

  // Português não segue a hifenização em inglês do react-pdf: quebra só entre palavras.
  Font.registerHyphenationCallback((word) => [word]);

  if (Font.getRegisteredFontFamilies().includes(SANS)) {
    registered = { sans: SANS, mono: MONO };
    return registered;
  }
  try {
    Font.register({
      family: SANS,
      fonts: [
        { src: dataUrl(fontFile.inter400()), fontWeight: 400 },
        { src: dataUrl(fontFile.inter500()), fontWeight: 500 },
        { src: dataUrl(fontFile.inter600()), fontWeight: 600 },
      ],
    });
    Font.register({
      family: MONO,
      fonts: [
        { src: dataUrl(fontFile.mono400()), fontWeight: 400 },
        { src: dataUrl(fontFile.mono500()), fontWeight: 500 },
      ],
    });
    registered = { sans: SANS, mono: MONO };
  } catch (e) {
    console.error("[pdf] Não foi possível carregar as fontes da marca; usando Helvetica.", e);
    registered = FALLBACK_FONTS;
  }
  return registered;
}
