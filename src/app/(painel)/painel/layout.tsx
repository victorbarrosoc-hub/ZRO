import type { Metadata } from "next";
import { PainelShell } from "@/components/painel/shell";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: { default: "Área interna", template: "%s · Área interna ZRO" },
  robots: { index: false, follow: false },
  // Atalho na Tela de Início do iPhone abre direto o painel (manifest público, sem login).
  manifest: "/interno.webmanifest",
  appleWebApp: { capable: true, title: "ZRO Interno", statusBarStyle: "black" },
};

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <PainelShell user={{ name: user.name, email: user.email, photoId: user.photoId }}>{children}</PainelShell>;
}
