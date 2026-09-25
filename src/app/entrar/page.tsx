import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, Symbol } from "@/components/brand/logo";
import { LightPoint } from "@/components/brand/light-point";
import { getSessionUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Área interna",
  robots: { index: false, follow: false },
};

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  // Só pula o login com sessão realmente válida (senão, cookie velho vira loop com o /painel).
  if (await getSessionUser()) redirect("/painel");
  const { next } = await searchParams;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-16">
      <div className="zro-grain" aria-hidden />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.06),transparent)]"
        aria-hidden
      />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-8 grid size-16 place-items-center">
            <Symbol className="absolute inset-0 size-16 text-white/90" />
            <LightPoint size={4} />
          </div>
          <p className="label mb-3 text-mute">Área interna</p>
          <h1 className="text-[32px] leading-none font-semibold tracking-[-0.04em] text-white">Entrar</h1>
          <p className="mt-3 text-[14px] text-mute">Acesso restrito aos sócios da ZRO.</p>
        </div>

        <LoginForm next={typeof next === "string" ? next : undefined} />

        <div className="mt-12 flex items-center justify-between text-[13px] text-mute">
          <Link href="/" className="transition-colors hover:text-light">
            ← Voltar ao site
          </Link>
          <Logo className="h-3.5 text-mute" />
        </div>
      </div>
    </main>
  );
}
