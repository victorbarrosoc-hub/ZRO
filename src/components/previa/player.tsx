"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, Minimize, Music, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { ESPERA_MAX_MS, relogio } from "@/lib/drive/midia";
import { quadroControlado } from "@/lib/drive/navegador/stream";
import { cn } from "@/lib/utils";

/**
 * Player da ZRO para vídeo e áudio (docs/dev/drive.md §16): preto e branco, pílulas, barra de tempo arrastável,
 * play/pausa, volume e mudo, velocidade e tela cheia. Toca em streaming (Range): nada de baixar tudo antes.
 *
 * `quadro`: o <video> mora dentro de um <iframe> nesse endereço (painel: o service worker de /painel/stream/ só
 * cuida do que está no escopo dele). Os controles ficam aqui fora e mexem no elemento de lá (mesma origem).
 * Sem `quadro`: o <video> é desta página (área do cliente, direto do Google).
 *
 * Vigia (`vigiar`): em espera por mais de 4 s com o pedido de tocar, ou o tempo andando sem quadro novo
 * (requestVideoFrameCallback), o player pausa e chama `onLento` (vídeo pesado demais para a rede).
 */

export type FalhaPlayer = { codigo: number; semServiceWorker?: boolean };

const VELOCIDADES = [1, 1.5, 2, 0.5];

/**
 * O vídeo cabe inteiro no palco: largura total até a altura acabar (unidades do contêiner mais próximo com
 * `container-type: size`; sem ele, valem as da tela).
 */
function tamanhoDoVideo(proporcao: string | null | undefined): React.CSSProperties {
  const [w, h] = (proporcao ?? "16 / 9").split("/").map((n) => Number(n.trim()));
  const r = w > 0 && h > 0 ? w / h : 16 / 9;
  return { aspectRatio: `${r}`, width: "100%", maxWidth: `calc(100cqh * ${r.toFixed(4)})`, maxHeight: "100cqh" };
}
const rotuloVelocidade = (v: number) => `${String(v).replace(".", ",")}x`;

type VideoComQuadro = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (agora: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (h: number) => void;
  webkitEnterFullscreen?: () => void;
};

function Barra({
  tempo,
  duracao,
  carregado,
  onIr,
  onArrastar,
}: {
  tempo: number;
  duracao: number;
  carregado: number;
  onIr: (t: number) => void;
  onArrastar: (t: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<number | null>(null);
  const fracao = arrasto ?? (duracao ? tempo / duracao : 0);
  const em = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Posição"
      aria-valuemin={0}
      aria-valuemax={Math.round(duracao || 0)}
      aria-valuenow={Math.round(fracao * (duracao || 0))}
      aria-valuetext={`${relogio(fracao * (duracao || 0))} de ${relogio(duracao)}`}
      data-controle
      className="group/barra relative flex h-6 cursor-pointer touch-none items-center outline-none"
      onPointerDown={(e) => {
        if (!duracao) return;
        e.preventDefault();
        e.stopPropagation();
        ref.current?.setPointerCapture?.(e.pointerId);
        const f = em(e);
        setArrasto(f);
        onArrastar(f * duracao);
      }}
      onPointerMove={(e) => {
        if (arrasto == null) return;
        e.stopPropagation();
        const f = em(e);
        setArrasto(f);
        onArrastar(f * duracao);
      }}
      onPointerUp={(e) => {
        if (arrasto == null) return;
        e.stopPropagation();
        const f = em(e);
        setArrasto(null);
        onArrastar(null);
        onIr(f * duracao);
      }}
      onPointerCancel={() => {
        setArrasto(null);
        onArrastar(null);
      }}
      onKeyDown={(e) => {
        if (!duracao) return;
        const passo = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -10, ArrowUp: 10 }[e.key];
        if (passo == null && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        e.stopPropagation();
        onIr(e.key === "Home" ? 0 : e.key === "End" ? duracao - 0.5 : Math.max(0, Math.min(duracao, tempo + (passo ?? 0))));
      }}
    >
      <span className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/barra:h-1.5 group-focus-visible/barra:h-1.5">
        <span className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${duracao ? Math.min(100, (carregado / duracao) * 100) : 0}%` }} />
        <span className="absolute inset-y-0 left-0 bg-white" style={{ width: `${fracao * 100}%` }} />
      </span>
      <span
        className={cn(
          "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgb(0_0_0/0.35)] transition-transform",
          arrasto != null ? "scale-125" : "scale-0 group-hover/barra:scale-100 group-focus-visible/barra:scale-100",
        )}
        style={{ left: `${fracao * 100}%` }}
        aria-hidden
      />
    </div>
  );
}

const botao =
  "grid size-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 [&_svg]:size-[18px]";

export function Player({
  tipo,
  src,
  quadro,
  poster,
  titulo,
  proporcao,
  selo,
  vigiar = true,
  onFalha,
  onLento,
  className,
}: {
  tipo: "video" | "audio";
  src: string;
  quadro?: string;
  poster?: string | null;
  titulo: string;
  proporcao?: string | null;
  selo?: string | null;
  vigiar?: boolean;
  onFalha?: (f: FalhaPlayer) => void;
  onLento?: () => void;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const moldura = useRef<HTMLIFrameElement>(null);
  const [el, setEl] = useState<HTMLMediaElement | null>(null);
  // Mexer no elemento (volume, posição, velocidade) é pelo ref: o estado só avisa o React que ele existe.
  const elRef = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    elRef.current = el;
  }, [el]);
  const [s, setS] = useState({ tocando: false, tempo: 0, duracao: 0, carregado: 0, esperando: false, mudo: false, volume: 1, velocidade: 1, comecou: false });
  const [arrasto, setArrasto] = useState<number | null>(null);
  const [ui, setUi] = useState(true);
  const [cheia, setCheia] = useState(false);
  const esconder = useRef(0);
  const falhaRef = useRef(onFalha);
  const lentoRef = useRef(onLento);
  useEffect(() => {
    falhaRef.current = onFalha;
    lentoRef.current = onLento;
  });

  // Elemento no quadro do service worker (painel).
  useEffect(() => {
    if (!quadro) return;
    const f = moldura.current;
    if (!f) return;
    let tentou = false;
    let criado: HTMLMediaElement | null = null;
    const montar = () => {
      if (!quadroControlado(f)) {
        if (!tentou) {
          tentou = true;
          f.src = `${quadro}?r=${Date.now()}`;
          return;
        }
        falhaRef.current?.({ codigo: 0, semServiceWorker: true });
        return;
      }
      const doc = f.contentDocument!;
      doc.body.replaceChildren();
      const m = doc.createElement(tipo);
      m.setAttribute("playsinline", "");
      m.setAttribute("webkit-playsinline", "");
      m.setAttribute("aria-label", titulo);
      m.preload = "metadata";
      m.src = src;
      doc.body.appendChild(m);
      criado = m;
      setEl(m);
    };
    f.addEventListener("load", montar);
    return () => {
      f.removeEventListener("load", montar);
      if (criado) {
        criado.pause();
        criado.removeAttribute("src");
        criado.load();
      }
    };
  }, [quadro, src, tipo, titulo]);

  // Eventos do elemento (o de dentro do quadro ou o desta página).
  useEffect(() => {
    if (!el) return;
    const ler = () => {
      let buf = 0;
      for (let i = 0; i < el.buffered.length; i++) if (el.buffered.start(i) <= el.currentTime + 0.5) buf = Math.max(buf, el.buffered.end(i));
      setS((o) => ({ ...o, tempo: el.currentTime, duracao: Number.isFinite(el.duration) ? el.duration : 0, carregado: buf }));
    };
    const ev: [string, () => void][] = [
      ["loadedmetadata", ler],
      ["durationchange", ler],
      ["timeupdate", ler],
      ["progress", ler],
      ["play", () => setS((o) => ({ ...o, tocando: true, comecou: true }))],
      ["playing", () => setS((o) => ({ ...o, tocando: true, esperando: false, comecou: true }))],
      ["pause", () => setS((o) => ({ ...o, tocando: false }))],
      ["ended", () => setS((o) => ({ ...o, tocando: false }))],
      ["waiting", () => setS((o) => ({ ...o, esperando: true }))],
      ["canplay", () => setS((o) => ({ ...o, esperando: false }))],
      ["volumechange", () => setS((o) => ({ ...o, mudo: el.muted, volume: el.volume }))],
      ["ratechange", () => setS((o) => ({ ...o, velocidade: el.playbackRate || 1 }))],
      ["error", () => falhaRef.current?.({ codigo: el.error?.code ?? 0 })],
    ];
    for (const [n, f] of ev) el.addEventListener(n, f);
    ler();
    return () => {
      for (const [n, f] of ev) el.removeEventListener(n, f);
    };
  }, [el]);

  // Vigia: espera longa, ou o tempo andando sem quadro novo.
  useEffect(() => {
    if (!el || !vigiar || tipo !== "video") return;
    const v = el as VideoComQuadro;
    let esperaDesde: number | null = null;
    let quadroEm = performance.now();
    let quadroTempo = v.currentTime;
    let h = 0;
    const porQuadro = typeof v.requestVideoFrameCallback === "function";
    const aoQuadro = (_: number, meta: { mediaTime: number }) => {
      quadroEm = performance.now();
      quadroTempo = meta.mediaTime;
      h = v.requestVideoFrameCallback!(aoQuadro);
    };
    if (porQuadro) h = v.requestVideoFrameCallback!(aoQuadro);
    const aoBuscar = () => {
      quadroEm = performance.now();
      quadroTempo = v.currentTime;
      esperaDesde = null;
    };
    v.addEventListener("seeking", aoBuscar);
    v.addEventListener("play", aoBuscar);
    const t = window.setInterval(() => {
      const agora = performance.now();
      if (v.paused || v.ended) {
        esperaDesde = null;
        return;
      }
      if (v.readyState < 3) {
        esperaDesde ??= agora;
        if (agora - esperaDesde > ESPERA_MAX_MS) {
          v.pause();
          esperaDesde = null;
          lentoRef.current?.();
        }
        return;
      }
      esperaDesde = null;
      if (porQuadro && agora - quadroEm > ESPERA_MAX_MS && v.currentTime - quadroTempo > ESPERA_MAX_MS / 1000) {
        v.pause();
        aoBuscar();
        lentoRef.current?.();
      }
    }, 500);
    return () => {
      window.clearInterval(t);
      v.removeEventListener("seeking", aoBuscar);
      v.removeEventListener("play", aoBuscar);
      if (porQuadro) v.cancelVideoFrameCallback?.(h);
    };
  }, [el, vigiar, tipo]);

  useEffect(() => {
    const aoMudar = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudar);
      window.clearTimeout(esconder.current);
    };
  }, []);

  const mostrarUi = useCallback(() => {
    setUi(true);
    window.clearTimeout(esconder.current);
    if (tipo === "video") esconder.current = window.setTimeout(() => !el?.paused && setUi(false), 2800);
  }, [el, tipo]);

  const alternar = useCallback(() => {
    if (!el) return;
    if (el.paused || el.ended) el.play()?.catch(() => {});
    else el.pause();
    mostrarUi();
  }, [el, mostrarUi]);

  const ir = (t: number) => {
    const m = elRef.current;
    if (!m) return;
    m.currentTime = Math.max(0, Math.min(t, (m.duration || t) - 0.05));
    setS((o) => ({ ...o, tempo: m.currentTime }));
    mostrarUi();
  };
  const mudo = () => {
    const m = elRef.current;
    if (m) m.muted = !m.muted;
  };
  const volume = (v: number) => {
    const m = elRef.current;
    if (!m) return;
    m.volume = v;
    m.muted = v === 0;
  };
  const velocidade = () => {
    const m = elRef.current;
    if (m) m.playbackRate = VELOCIDADES[(VELOCIDADES.indexOf(m.playbackRate) + 1) % VELOCIDADES.length];
  };

  const telaCheia = () => {
    const v = el as VideoComQuadro | null;
    try {
      if (document.fullscreenElement) return void document.exitFullscreen();
      if (caixa.current?.requestFullscreen && document.fullscreenEnabled) return void caixa.current.requestFullscreen();
      v?.webkitEnterFullscreen?.(); // iPhone: só o <video> vai para tela cheia
    } catch {
      // sem tela cheia aqui
    }
  };

  const tempo = arrasto ?? s.tempo;
  const video = tipo === "video";

  return (
    <div
      ref={caixa}
      className={cn(
        "group/player relative isolate w-full overflow-hidden bg-black text-white select-none",
        video ? "" : "rounded-[22px] border border-line",
        cheia && "rounded-none",
        className,
      )}
      style={video ? tamanhoDoVideo(proporcao) : undefined}
      tabIndex={-1}
      onPointerMove={() => video && mostrarUi()}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("[role=slider], input")) return;
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          e.stopPropagation();
          alternar();
        } else if (e.key === "m") mudo();
        else if (e.key === "f" && video) telaCheia();
      }}
    >
      {video ? (
        quadro ? (
          <iframe ref={moldura} src={quadro} title={titulo} className="pointer-events-none absolute inset-0 size-full border-0" />
        ) : (
          <video
            ref={(m) => setEl((atual) => (m && m !== atual ? m : atual))}
            src={src}
            preload="metadata"
            playsInline
            aria-label={titulo}
            className="pointer-events-none absolute inset-0 size-full bg-black object-contain"
          />
        )
      ) : (
        <div className="relative grid h-[min(46vh,320px)] place-items-center">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-40 blur-sm" draggable={false} />
          ) : null}
          <span className="relative grid size-24 place-items-center rounded-full border border-white/15 bg-white/[0.04]">
            <Music className="size-9 text-white/80" strokeWidth={1.3} aria-hidden />
          </span>
          {quadro ? (
            <iframe ref={moldura} src={quadro} title={titulo} className="pointer-events-none absolute size-px opacity-0" />
          ) : (
            <audio ref={(m) => setEl((atual) => (m && m !== atual ? m : atual))} src={src} preload="metadata" aria-label={titulo} />
          )}
        </div>
      )}

      {video && poster && !s.comecou ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="pointer-events-none absolute inset-0 size-full object-contain" draggable={false} />
      ) : null}

      {/* Toque no palco: começa, mostra ou esconde os controles. */}
      {video ? (
        <button
          type="button"
          aria-label={s.tocando ? "Pausar" : "Reproduzir"}
          className="absolute inset-0 z-10 cursor-default focus:outline-none"
          onClick={() => {
            if (!s.comecou || !s.tocando) alternar();
            else if (ui) setUi(false);
            else mostrarUi();
          }}
          data-palco-player
        />
      ) : null}

      {selo ? <span className="label absolute top-3 left-3 z-20 rounded-full bg-white px-2.5 py-1 text-void">{selo}</span> : null}

      {!s.tocando || (s.esperando && s.tocando) ? (
        <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden>
          {s.esperando && s.tocando ? (
            <span className="size-12 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          ) : video ? (
            <span className="grid size-16 place-items-center rounded-full bg-white text-void shadow-[0_8px_40px_-8px_rgb(0_0_0/0.8)] sm:size-[72px]">
              <Play className="ml-1 size-7 fill-current" />
            </span>
          ) : null}
        </span>
      ) : null}

      <div
        data-controle
        className={cn(
          // O degradê não pega toque (o palco por baixo continua tocável); só a barra e os botões.
          "pointer-events-none z-30 px-3 pb-2 transition-opacity duration-300 sm:px-4 [&>*]:pointer-events-auto",
          video ? "absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.85),rgb(0_0_0/0))] pt-8" : "relative pt-2",
          ui || !s.tocando || !video ? "opacity-100" : "opacity-0 [&>*]:!pointer-events-none",
        )}
      >
        <Barra tempo={s.tempo} duracao={s.duracao} carregado={s.carregado} onIr={ir} onArrastar={setArrasto} />
        <div className="flex items-center gap-1">
          <button type="button" className={botao} onClick={alternar} aria-label={s.tocando ? "Pausar" : "Reproduzir"}>
            {s.tocando ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </button>
          <span className="font-mono text-[12px] text-white/85 tabular-nums">
            {relogio(tempo)} <span className="text-white/45">/ {s.duracao ? relogio(s.duracao) : "--:--"}</span>
          </span>
          <span className="flex-1" />
          <span className="group/vol flex items-center">
            <button
              type="button"
              className={botao}
              onClick={mudo}
              aria-label={s.mudo ? "Ligar o som" : "Sem som"}
              aria-pressed={s.mudo}
            >
              {s.mudo || s.volume === 0 ? <VolumeX /> : <Volume2 />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.mudo ? 0 : s.volume}
              onChange={(e) => volume(Number(e.currentTarget.value))}
              aria-label="Volume"
              className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
            />
          </span>
          <button
            type="button"
            className="h-8 min-w-12 rounded-full border border-white/20 px-2.5 font-mono text-[12px] text-white/90 transition-colors hover:border-white/50"
            onClick={velocidade}
            aria-label={`Velocidade ${rotuloVelocidade(s.velocidade)}`}
          >
            {rotuloVelocidade(s.velocidade)}
          </button>
          {video ? (
            <button type="button" className={botao} onClick={telaCheia} aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}>
              {cheia ? <Minimize /> : <Expand />}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
