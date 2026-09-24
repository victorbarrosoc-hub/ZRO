import Link from "next/link";
import { Symbol } from "@/components/brand/logo";
import { LightPoint } from "@/components/brand/light-point";

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center">
      <div className="zro-grain" aria-hidden />
      <div className="relative">
        <div className="relative mx-auto mb-10 grid size-20 place-items-center">
          <Symbol className="absolute inset-0 size-20 text-white/85" />
          <LightPoint size={4} />
        </div>
        <p className="label mb-4 text-mute">Erro 404</p>
        <h1 className="text-h2 text-white">Aqui ainda é zero.</h1>
        <p className="mx-auto mt-4 max-w-sm text-[16px] text-ash">Esta página não existe, ou ainda não ganhou forma.</p>
        <Link
          href="/"
          className="mt-10 inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium text-void transition-colors hover:bg-light"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
