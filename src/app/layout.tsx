import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Inter } from "next/font/google";
import { Toaster } from "sonner";
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

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
  icons: {
    icon: "/icon.svg",
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
      className={`${inter.variable} ${instrument.variable} ${geistMono.variable}`}
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
