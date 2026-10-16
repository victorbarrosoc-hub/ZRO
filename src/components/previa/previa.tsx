"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { bytesBR } from "@/lib/drive/bytes";
import { duracaoBR, extensao, tipoDeMidia, type InfoMidia, type TipoMidia } from "@/lib/drive/midia";
import { cn } from "@/lib/utils";
import { IconeDoTipo } from "./miniatura";

/**
 * Prévia de um arquivo do Drive (docs/dev/drive.md §16): janela grande no computador, tela cheia no celular.
 * Arrastar para baixo fecha; para o lado (ou as setas) passa de arquivo; Esc fecha. O palco (vídeo, foto,
 * aviso) e as ações vêm de quem usa: o painel (service worker) e a área do cliente (link público).
 */

export type ArquivoPrevia = {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number | null;
  modificadoEm: string | null;
  midia: InfoMidia;
  verUrl: string;
  baixarUrl: string | null;
};

const dataBR = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" });

export function semMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Celular: tela estreita ou ponteiro grosso (a mesma regra da taxa máxima do vídeo). */
export function ehCelular(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || window.matchMedia?.("(pointer: coarse)").matches === true;
}

/* ------------------------------ peças do palco ------------------------------ */

/** Sem prévia: a miniatura grande (ou o ícone) e o motivo, com ações opcionais. */
export function SemPrevia({
  poster,
  nome,
  tipo,
  titulo,
  texto,
  children,
}: {
  poster?: string | null;
  nome: string;
  tipo: TipoMidia;
  titulo: string;
  texto?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative grid size-full place-items-center overflow-hidden">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 size-full object-contain opacity-35" draggable={false} />
      ) : null}
      <div className="relative mx-5 flex max-w-md flex-col items-center gap-4 rounded-[24px] border border-line-strong bg-void/80 px-6 py-7 text-center backdrop-blur-md">
        {!poster ? <IconeDoTipo tipo={tipo} nome={nome} grande /> : null}
        <p className="text-[17px] font-medium tracking-[-0.01em] text-white">{titulo}</p>
        {texto ? <p className="-mt-2 text-[14px] text-ash">{texto}</p> : null}
        {children ? <div className="flex flex-wrap justify-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid size-full place-items-center" role="status" aria-label="Carregando">
      <span className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

/** Foto grande com zoom: pinça, toque duplo, duplo clique e roda do mouse. A versão baixa aparece antes. */
export function FotoZoom({ src, baixa, alt, onZoom, onErro }: { src: string; baixa?: string | null; alt: string; onZoom?: (z: boolean) => void; onErro?: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLDivElement>(null);
  const z = useRef({ s: 1, x: 0, y: 0 });
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ pinca?: boolean; d0?: number; s0?: number; arrasto?: boolean; x0?: number; y0?: number } | null>(null);
  const ultimoToque = useRef(0);
  const [pronta, setPronta] = useState(false);

  const aplicar = (anim: boolean) => {
    const el = img.current;
    if (!el) return;
    const { s, x, y } = z.current;
    el.style.transition = anim && !semMovimento() ? "transform 0.25s cubic-bezier(0.16,1,0.3,1)" : "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    onZoom?.(s > 1.01);
  };
  const limitar = () => {
    const r = caixa.current!.getBoundingClientRect();
    const mx = ((z.current.s - 1) * r.width) / 2;
    const my = ((z.current.s - 1) * r.height) / 2;
    z.current.x = Math.max(-mx, Math.min(mx, z.current.x));
    z.current.y = Math.max(-my, Math.min(my, z.current.y));
  };
  const zoomEm = (s: number, cx: number, cy: number) => {
    const r = caixa.current!.getBoundingClientRect();
    const ox = cx - (r.left + r.width / 2);
    const oy = cy - (r.top + r.height / 2);
    const k = s / z.current.s;
    z.current.x = ox - (ox - z.current.x) * k;
    z.current.y = oy - (oy - z.current.y) * k;
    z.current.s = s;
    limitar();
  };
  const alternarZoom = (cx: number, cy: number) => {
    if (z.current.s > 1.01) z.current = { s: 1, x: 0, y: 0 };
    else zoomEm(2.5, cx, cy);
    aplicar(true);
  };

  return (
    <div
      ref={caixa}
      className="relative size-full touch-none overflow-hidden"
      onPointerDown={(e) => {
        dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (dedos.current.size === 2) {
          const [a, b] = [...dedos.current.values()];
          gesto.current = { pinca: true, d0: Math.hypot(a.x - b.x, a.y - b.y), s0: z.current.s };
          e.stopPropagation();
        } else if (dedos.current.size === 1 && z.current.s > 1.01) {
          gesto.current = { arrasto: true, x0: e.clientX - z.current.x, y0: e.clientY - z.current.y };
          e.stopPropagation();
        }
      }}
      onPointerMove={(e) => {
        if (!dedos.current.has(e.pointerId)) return;
        dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesto.current;
        if (!g) return;
        e.stopPropagation();
        if (g.pinca && dedos.current.size >= 2) {
          const [a, b] = [...dedos.current.values()];
          const s = Math.max(1, Math.min(5, (g.s0! * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, g.d0!)));
          zoomEm(s, (a.x + b.x) / 2, (a.y + b.y) / 2);
          aplicar(false);
        } else if (g.arrasto) {
          z.current.x = e.clientX - g.x0!;
          z.current.y = e.clientY - g.y0!;
          limitar();
          aplicar(false);
        }
      }}
      onPointerUp={(e) => {
        if (!dedos.current.delete(e.pointerId)) return;
        if (gesto.current) e.stopPropagation();
        if (dedos.current.size === 0) {
          const agora = performance.now();
          if (e.pointerType !== "mouse" && !gesto.current?.pinca && agora - ultimoToque.current < 280) {
            alternarZoom(e.clientX, e.clientY);
            ultimoToque.current = 0;
            e.stopPropagation();
          } else ultimoToque.current = agora;
          if (z.current.s < 1.02) {
            z.current = { s: 1, x: 0, y: 0 };
            aplicar(true);
          }
          gesto.current = null;
        }
      }}
      onPointerCancel={(e) => {
        dedos.current.delete(e.pointerId);
        gesto.current = null;
      }}
      onDoubleClick={(e) => alternarZoom(e.clientX, e.clientY)}
      onWheel={(e) => {
        if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return;
        const s = Math.max(1, Math.min(5, z.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        zoomEm(s, e.clientX, e.clientY);
        aplicar(false);
      }}
    >
      <div ref={img} className="absolute inset-0 origin-center will-change-transform" data-zoom>
        {baixa && !pronta ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={baixa} alt="" className="absolute inset-0 size-full object-contain blur-[2px]" draggable={false} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={() => setPronta(true)}
          onError={onErro}
          className={cn("absolute inset-0 size-full object-contain transition-opacity duration-300", pronta ? "opacity-100" : "opacity-0")}
        />
      </div>
    </div>
  );
}

/** Tamanho, duração, resolução, tipo e data. */
export function InfoArquivo({ a }: { a: ArquivoPrevia }) {
  const partes = [
    a.tamanho != null ? bytesBR(a.tamanho) : null,
    duracaoBR(a.midia.duracaoMs),
    a.midia.largura && a.midia.altura ? `${a.midia.largura} × ${a.midia.altura}` : null,
    extensao(a.nome).toUpperCase() || null,
    a.modificadoEm ? dataBR.format(new Date(a.modificadoEm)) : null,
  ].filter(Boolean);
  return <p className="font-mono text-[12px] text-mute tabular-nums">{partes.join("  ·  ")}</p>;
}

/* ------------------------------ a janela ------------------------------ */

export function Previa({
  arquivos,
  indice,
  onIndice,
  onFechar,
  palco,
  acoes,
  marca,
  sobreposicao,
}: {
  arquivos: ArquivoPrevia[];
  indice: number;
  onIndice: (i: number) => void;
  onFechar: () => void;
  palco: (a: ArquivoPrevia, ctl: { setZoom: (z: boolean) => void }) => React.ReactNode;
  acoes: (a: ArquivoPrevia) => React.ReactNode;
  /** O símbolo da ZRO no topo (área do cliente). */
  marca?: React.ReactNode;
  /** Por cima de tudo, dentro da janela (ex.: a confirmação do download grande). */
  sobreposicao?: React.ReactNode;
}) {
  const a = arquivos[indice];
  const [zoom, setZoom] = useState(false);
  const [direcao, setDirecao] = useState(0);
  const janela = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ x0: number; y0: number; t0: number; eixo: "x" | "y" | "nada" | null; dx: number; dy: number; id: number } | null>(null);

  const ir = (d: number) => {
    const i = indice + d;
    if (i < 0 || i >= arquivos.length) return;
    setDirecao(d);
    setZoom(false);
    onIndice(i);
  };
  const irRef = useRef(ir);
  useEffect(() => {
    irRef.current = ir;
  });

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.("[role=slider], input, textarea")) return;
      if (e.key === "ArrowRight") irRef.current(1);
      else if (e.key === "ArrowLeft") irRef.current(-1);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  if (!a) return null;
  const tipo = tipoDeMidia(a);

  const baixo = (e: React.PointerEvent) => {
    if (zoom || !e.isPrimary || (e.target as HTMLElement).closest("[data-controle], a, input, [role=slider]")) return;
    gesto.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), eixo: null, dx: 0, dy: 0, id: e.pointerId };
  };
  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    g.dx = e.clientX - g.x0;
    g.dy = e.clientY - g.y0;
    if (!g.eixo) {
      if (Math.hypot(g.dx, g.dy) < 10) return;
      g.eixo = Math.abs(g.dx) > Math.abs(g.dy) ? "x" : g.dy > 0 ? "y" : "nada";
      if (g.eixo !== "nada") (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (g.eixo === "x" && trilho.current) {
      const borda = (g.dx > 0 && indice === 0) || (g.dx < 0 && indice === arquivos.length - 1);
      trilho.current.style.transition = "none";
      trilho.current.style.transform = `translate3d(${borda ? g.dx / 3 : g.dx}px,0,0)`;
    } else if (g.eixo === "y" && janela.current) {
      const dy = Math.max(0, g.dy);
      janela.current.style.transition = "none";
      janela.current.style.transform = `translate3d(0,${dy}px,0)`;
      janela.current.style.opacity = String(Math.max(0.4, 1 - dy / 600));
    }
  };
  const soltar = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    const dt = Math.max(1, performance.now() - g.t0);
    const anim = semMovimento() ? "none" : "transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s";
    if (g.eixo === "x" && trilho.current) {
      trilho.current.style.transition = anim;
      trilho.current.style.transform = "";
      if (Math.abs(g.dx) > 70 || (Math.abs(g.dx) > 30 && Math.abs(g.dx) / dt > 0.5)) ir(g.dx < 0 ? 1 : -1);
    } else if (g.eixo === "y" && janela.current) {
      janela.current.style.transition = anim;
      if (g.dy > 120 || (g.dy > 40 && g.dy / dt > 0.6)) onFechar();
      else {
        janela.current.style.transform = "";
        janela.current.style.opacity = "";
      }
    }
  };

  return (
    <D.Root open onOpenChange={(o) => !o && onFechar()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md data-[state=open]:animate-[fade-in_200ms]" />
        <D.Content
          ref={janela}
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-[91] flex flex-col overflow-clip bg-void text-light focus:outline-none data-[state=open]:animate-[sheet-in_320ms_cubic-bezier(0.16,1,0.3,1)]",
            "sm:inset-4 sm:rounded-[28px] sm:border sm:border-line-strong sm:shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] lg:inset-8",
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            janela.current?.focus({ preventScroll: true });
          }}
        >
          {/* Grão num recorte próprio (overflow-clip): o grão vaza 50% para os lados e não pode virar rolagem. */}
          <div className="pointer-events-none absolute inset-0 overflow-clip" aria-hidden>
            <div className="zro-grain zro-grain--soft" style={{ position: "absolute", zIndex: 0 }} />
          </div>
          <header className="relative z-10 flex min-h-16 items-center gap-2 border-b border-line px-2 py-2 sm:gap-3 sm:px-4">
            <D.Close
              className="grid size-11 shrink-0 place-items-center rounded-full text-ash transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Fechar"
            >
              <ChevronDown className="size-5 sm:hidden" />
              <X className="hidden size-5 sm:block" />
            </D.Close>
            {marca ? <span className="hidden shrink-0 sm:block">{marca}</span> : null}
            <div className="min-w-0 flex-1">
              <D.Title className="truncate text-[15px] font-medium tracking-[-0.01em] text-white" title={a.nome}>
                {a.nome}
              </D.Title>
              <p className="font-mono text-[11px] text-mute tabular-nums">
                {arquivos.length > 1 ? `${indice + 1} de ${arquivos.length}` : a.tamanho != null ? bytesBR(a.tamanho) : ""}
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex" data-controle>
              {acoes(a)}
            </div>
          </header>

          <div
            className="relative z-10 min-h-0 flex-1 touch-none overflow-clip"
            onPointerDown={baixo}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            <div ref={trilho} className="absolute inset-0">
              <div
                key={a.id}
                className={cn(
                  "absolute inset-0 grid place-items-center sm:p-6",
                  !semMovimento() && direcao > 0 && "animate-[previa-direita_320ms_cubic-bezier(0.16,1,0.3,1)]",
                  !semMovimento() && direcao < 0 && "animate-[previa-esquerda_320ms_cubic-bezier(0.16,1,0.3,1)]",
                )}
                data-tipo={tipo}
                style={{ containerType: "size" }}
              >
                {palco(a, { setZoom })}
              </div>
            </div>
            {arquivos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => ir(-1)}
                  disabled={indice === 0}
                  aria-label="Arquivo anterior"
                  data-controle
                  className="absolute top-1/2 left-3 z-40 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-void/70 text-white backdrop-blur transition-opacity hover:bg-void disabled:opacity-0 sm:grid"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => ir(1)}
                  disabled={indice === arquivos.length - 1}
                  aria-label="Próximo arquivo"
                  data-controle
                  className="absolute top-1/2 right-3 z-40 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-void/70 text-white backdrop-blur transition-opacity hover:bg-void disabled:opacity-0 sm:grid"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          <footer className="relative z-10 grid gap-3 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
            <InfoArquivo a={a} />
            <div className="flex flex-wrap items-center gap-2 sm:hidden" data-controle>
              {acoes(a)}
            </div>
            {arquivos.length > 1 ? <p className="text-[12px] text-mute sm:hidden">Deslize para o lado para ver o próximo.</p> : null}
          </footer>
          {sobreposicao}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
