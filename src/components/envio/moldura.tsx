import { Logo, Symbol } from "@/components/brand/logo";
import { LightPoint } from "@/components/brand/light-point";
import { cn } from "@/lib/utils";

/**
 * Moldura das páginas públicas de envio (/enviar/<código> e /cliente/<código>), sem o layout do site:
 * o vazio com grão e um brilho, o símbolo com o ponto de luz no topo e a assinatura no rodapé
 * (docs/dev/drive.md §8.1). Componente de servidor: as telas de dentro trazem o próprio movimento.
 */
export function Moldura({ children, estreita = false }: { children: React.ReactNode; estreita?: boolean }) {
  return (
    <main className="relative min-h-dvh">
      <div className="zro-grain" aria-hidden />
      <div
        className="pointer-events-none fixed top-0 left-1/2 h-[560px] w-[1100px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(255_255_255/0.06),transparent)]"
        aria-hidden
      />
      <div className="container-zro relative">
        <div className={cn("mx-auto flex min-h-dvh w-full flex-col", estreita ? "max-w-[380px]" : "max-w-3xl")}>
          <header className="flex h-20 items-center justify-between sm:h-24">
            <span className="relative grid size-9 place-items-center">
              <Symbol className="absolute inset-0 size-9 text-white/90" />
              <LightPoint size={3} />
            </span>
            <Logo className="h-3 text-mute" title="ZRO Filmes" />
          </header>
          <div className="flex-1 pt-8 pb-20 motion-safe:animate-[sheet-in_600ms_cubic-bezier(0.16,1,0.3,1)_backwards] sm:pt-14">
            {children}
          </div>
          <footer className="flex flex-col gap-2 border-t border-line py-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-ash">Onde tudo começa e o comum termina.</p>
            <p className="label text-mute">ZRO Filmes · Natal/RN</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

/** Topo de cada tela pública: rótulo em mono, título grande e uma linha de apoio. */
export function Cabecalho({ rotulo, titulo, subtitulo }: { rotulo: string; titulo: React.ReactNode; subtitulo?: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-5 text-mute">{rotulo}</p>
      <h1 className="text-h2 break-words text-white">{titulo}</h1>
      {subtitulo ? <p className="mt-4 max-w-xl text-body-lg text-ash">{subtitulo}</p> : null}
    </div>
  );
}
