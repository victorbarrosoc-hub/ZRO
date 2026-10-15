import type { Metadata, Viewport } from "next";
import { PainelShell } from "@/components/painel/shell";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: { default: "Área interna", template: "%s · Área interna ZRO" },
  robots: { index: false, follow: false },
  // Atalho na Tela de Início do iPhone abre direto o painel (manifest público, sem login).
  manifest: "/interno.webmanifest",
  appleWebApp: { capable: true, title: "ZRO Interno", statusBarStyle: "black" },
};

/*
 * Sem zoom automático ao tocar num campo: o iPhone dá zoom em todo campo com letra
 * menor que 16 px (os do painel são 15 px) e a tela fica ampliada. maximumScale 1
 * só tira esse zoom automático; a pinça com dois dedos continua valendo no iPhone.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <PainelShell user={{ name: user.name, email: user.email, photoId: user.photoId }}>{children}</PainelShell>;
}
