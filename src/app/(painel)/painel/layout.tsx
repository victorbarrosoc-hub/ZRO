import type { Metadata } from "next";
import { PainelShell } from "@/components/painel/shell";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: { default: "Área interna", template: "%s · Área interna ZRO" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <PainelShell user={{ name: user.name, email: user.email }}>{children}</PainelShell>;
}
