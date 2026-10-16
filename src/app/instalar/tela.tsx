import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SITE_URL } from "@/lib/site-url";
import { GuiaInstalar } from "./guia";

/** A tela de "pôr na Tela de Início", igual para o site e para a área interna. */
export function TelaInstalar({ nome, rotulo, titulo, texto, destino, caminho }: {
  nome: string;
  rotulo: string;
  titulo: string;
  texto: string;
  destino: string;
  caminho: string;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-14">
      <div className="zro-grain" aria-hidden />
      <div
        className="pointer-events-none absolute top-[28%] left-1/2 size-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.07),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-9 flex flex-col items-center text-center">
          {/* o próprio ícone que vai para a Tela de Início */}
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone fixo do app */}
          <img src="/icons/icon-192.png" alt="" width={84} height={84} className="mb-4 size-[84px] rounded-[22.5%] shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)]" />
          <p className="mb-7 text-[13px] font-medium text-ash">{nome}</p>
          <p className="label mb-3 text-mute">{rotulo}</p>
          <h1 className="text-[30px] leading-[1.08] font-semibold tracking-[-0.04em] text-balance text-white">{titulo}</h1>
          <p className="mt-3 max-w-[340px] text-[14px] leading-relaxed text-mute">{texto}</p>
        </div>

        <GuiaInstalar nome={nome} destino={destino} endereco={`${SITE_URL}${caminho}`} />

        <div className="mt-10 flex items-center justify-between text-[13px] text-mute">
          <Link href={destino} className="transition-colors hover:text-light">
            Continuar sem instalar →
          </Link>
          <Logo className="h-3.5 text-mute" />
        </div>
      </div>
    </main>
  );
}
