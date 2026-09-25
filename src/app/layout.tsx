import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Inter, Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-inter",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

// Absolute ZRO (tipografia do board: Light + Medium). Sem preload: só baixa onde a Absolute aparece.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-montserrat",
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ZRO Filmes · Onde tudo começa e o comum termina.",
    template: "%s · ZRO Filmes",
  },
  description:
    "Produtora audiovisual e criativa de Natal/RN. Filmes de marca, campanhas, conteúdo e documentários com direção, narrativa e linguagem cinematográfica.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ZRO Filmes",
    title: "ZRO Filmes",
    description: "Onde tudo começa e o comum termina.",
  },
  twitter: {
    card: "summary_large_image",
  },
  // Ícones: pelos arquivos em src/app (icon.svg e apple-icon.png). Não declarar `icons` aqui:
  // se declarar, o Next ignora os arquivos e o iPhone fica sem o ícone da Tela de Início.
  // Manifest: src/app/manifest.ts (a área interna troca pelo /interno.webmanifest).
  appleWebApp: {
    capable: true,
    title: "ZRO",
    statusBarStyle: "black",
  },
  other: {
    // O Next 16 só gera "mobile-web-app-capable"; iPhones anteriores ao iOS 16.4 ainda leem esta.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${instrument.variable} ${geistMono.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#121212",
              border: "1px solid rgb(255 255 255 / 0.12)",
              color: "#e6e6e6",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}
