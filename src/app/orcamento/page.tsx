import type { Metadata } from "next";
import { FUNNEL_PROJECT_TYPES } from "@/lib/domain";
import { Funnel } from "./funnel";

export const metadata: Metadata = {
  title: "Começar um projeto",
  description: "Conte a sua ideia em um minuto. A conversa continua no WhatsApp.",
};

export default async function OrcamentoPage({ searchParams }: PageProps<"/orcamento">) {
  const { tipo } = await searchParams;
  const initialType =
    typeof tipo === "string" && FUNNEL_PROJECT_TYPES.some((t) => t.key === tipo) ? tipo : undefined;

  return (
    <main className="relative min-h-dvh">
      <div className="zro-grain" aria-hidden />
      <div
        className="pointer-events-none fixed top-0 left-1/2 -z-0 h-[600px] w-[1200px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(255_255_255/0.05),transparent)]"
        aria-hidden
      />
      <Funnel initialType={initialType} />
    </main>
  );
}
