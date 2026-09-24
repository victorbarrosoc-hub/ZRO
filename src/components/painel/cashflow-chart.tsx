"use client";

import { useEffect, useRef, useState } from "react";
import { brl, brlCompact, monthLong, monthShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FlowMonth = {
  key: string;
  entradasRealizado: number;
  entradasPrevisto: number;
  saidasRealizado: number;
  saidasPrevisto: number;
  saldo: number;
};

/*
 * Regras da skill dataviz aplicadas aqui:
 * - Colunas de no máximo 24px, ponta arredondada de 4px, reta na linha de base.
 * - 2px de respiro (cor da superfície) entre realizado e previsto.
 * - Entradas acima da linha, saídas abaixo: a posição carrega a polaridade.
 * - Cores validadas contra a superfície: recebido 17:1, pago 7:1, previsto 3,8:1.
 * - Grade em linha fina sólida; legenda sempre visível; rótulo direto só no mês atual.
 * - Dica ao passar o mouse ou focar pelo teclado; a tabela mostra tudo sem depender dela.
 */
const COLORS = {
  surface: "#101010",
  recebido: "#f2f2f2",
  pago: "#a3a3a3",
  previsto: "#6f6f6f",
  grid: "#232323",
  baseline: "#3a3a3a",
};

const HEIGHT = 300;
const PAD = { top: 28, right: 12, bottom: 34, left: 70 };

function niceMax(v: number) {
  if (v <= 0) return 100000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Retângulo com os cantos arredondados só na ponta do dado. */
function barPath(x: number, y0: number, y1: number, w: number, roundEnd: "top" | "bottom" | "none") {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const r = Math.min(4, h, w / 2);
  if (roundEnd === "top") {
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${bottom} Z`;
  }
  if (roundEnd === "bottom") {
    return `M${x},${top} V${bottom - r} Q${x},${bottom} ${x + r},${bottom} H${x + w - r} Q${x + w},${bottom} ${x + w},${bottom - r} V${top} Z`;
  }
  return `M${x},${top} H${x + w} V${bottom} H${x} Z`;
}

export function CashflowChart({ months, current }: { months: FlowMonth[]; current: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxUp = Math.max(...months.map((m) => m.entradasRealizado + m.entradasPrevisto), 0);
  const maxDown = Math.max(...months.map((m) => m.saidasRealizado + m.saidasPrevisto), 0);
  const scaleMax = niceMax(Math.max(maxUp, maxDown));
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH / 2;
  const y = (v: number) => (v / scaleMax) * (plotH / 2);
  const band = plotW / months.length;
  const barW = Math.min(24, band * 0.34);
  const GAP = 2;
  const BASE_GAP = 2; // respiro de superfície dos dois lados da linha de base

  const ticks = [scaleMax, scaleMax / 2, 0, -scaleMax / 2, -scaleMax];
  const hovered = hover != null ? months[hover] : null;
  const currentIndex = months.findIndex((m) => m.key === current);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ash" aria-label="Legenda">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: COLORS.recebido }} aria-hidden /> Recebido
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: COLORS.pago }} aria-hidden /> Pago
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: COLORS.previsto }} aria-hidden /> A receber / a pagar
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="h-8 rounded-full border border-line-strong px-3 text-[12px] text-ash transition-colors hover:border-white/30 hover:text-light"
          aria-pressed={showTable}
        >
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-mute">
                <th className="px-4 py-3 font-normal">Mês</th>
                <th className="px-4 py-3 text-right font-normal">Recebido</th>
                <th className="px-4 py-3 text-right font-normal">A receber</th>
                <th className="px-4 py-3 text-right font-normal">Pago</th>
                <th className="px-4 py-3 text-right font-normal">A pagar</th>
                <th className="px-4 py-3 text-right font-normal">Saldo</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {months.map((m) => (
                <tr key={m.key} className={cn("border-b border-line last:border-b-0", m.key === current && "bg-white/[0.03]")}>
                  <td className="px-4 py-3 text-light capitalize">{monthLong(m.key)}</td>
                  <td className="px-4 py-3 text-right text-light">{brl(m.entradasRealizado)}</td>
                  <td className="px-4 py-3 text-right text-ash">{brl(m.entradasPrevisto)}</td>
                  <td className="px-4 py-3 text-right text-light">{brl(m.saidasRealizado)}</td>
                  <td className="px-4 py-3 text-right text-ash">{brl(m.saidasPrevisto)}</td>
                  <td className="px-4 py-3 text-right text-white">{brl(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative">
          <svg width={width} height={HEIGHT} className="block" role="img" aria-label="Fluxo de caixa por mês: entradas acima da linha, saídas abaixo">
            {/* grade */}
            {ticks.map((t) => {
              const ty = baseY - y(t);
              return (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={ty} y2={ty} stroke={t === 0 ? COLORS.baseline : COLORS.grid} strokeWidth={1} />
                  <text x={PAD.left - 10} y={ty + 4} textAnchor="end" className="fill-mute text-[11px] tabular-nums">
                    {t === 0 ? "0" : `${t < 0 ? "−" : ""}${brlCompact(Math.abs(t))}`}
                  </text>
                </g>
              );
            })}

            {months.map((m, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x = cx - barW / 2;
              const inReal = y(m.entradasRealizado);
              const inPrev = y(m.entradasPrevisto);
              const outReal = y(m.saidasRealizado);
              const outPrev = y(m.saidasPrevisto);
              const isCurrent = m.key === current;
              const isHover = hover === i;
              return (
                <g key={m.key}>
                  {isCurrent || isHover ? (
                    <rect x={PAD.left + band * i + 4} y={PAD.top - 8} width={band - 8} height={plotH + 16} rx={12} fill={isHover ? "rgb(255 255 255 / 0.05)" : "rgb(255 255 255 / 0.025)"} />
                  ) : null}
                  {/* entradas */}
                  <path d={barPath(x, baseY - BASE_GAP, baseY - BASE_GAP - inReal, barW, inPrev > 0.5 ? "none" : "top")} fill={COLORS.recebido} />
                  {inPrev > 0.5 ? (
                    <path
                      d={barPath(
                        x,
                        baseY - BASE_GAP - inReal - (inReal > 0.5 ? GAP : 0),
                        baseY - BASE_GAP - inReal - (inReal > 0.5 ? GAP : 0) - inPrev,
                        barW,
                        "top",
                      )}
                      fill={COLORS.previsto}
                    />
                  ) : null}
                  {/* saídas */}
                  <path d={barPath(x, baseY + BASE_GAP, baseY + BASE_GAP + outReal, barW, outPrev > 0.5 ? "none" : "bottom")} fill={COLORS.pago} />
                  {outPrev > 0.5 ? (
                    <path
                      d={barPath(
                        x,
                        baseY + BASE_GAP + outReal + (outReal > 0.5 ? GAP : 0),
                        baseY + BASE_GAP + outReal + (outReal > 0.5 ? GAP : 0) + outPrev,
                        barW,
                        "bottom",
                      )}
                      fill={COLORS.previsto}
                    />
                  ) : null}
                  {/* mês */}
                  <text
                    x={cx}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className={cn("text-[12px]", isCurrent ? "fill-white font-medium" : "fill-mute")}
                  >
                    {monthShort(m.key)}
                  </text>
                  {/* rótulo direto: só o saldo do mês atual */}
                  {isCurrent ? (
                    <text x={cx} y={PAD.top - 12} textAnchor="middle" className="fill-light text-[11px] font-medium tabular-nums">
                      {brlCompact(m.saldo)}
                    </text>
                  ) : null}
                  {/* área de toque maior que a marca */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top - 8}
                    width={band}
                    height={plotH + 16}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${monthLong(m.key)}: recebido ${brl(m.entradasRealizado)}, a receber ${brl(m.entradasPrevisto)}, pago ${brl(m.saidasRealizado)}, a pagar ${brl(m.saidasPrevisto)}, saldo ${brl(m.saldo)}`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="cursor-default outline-none"
                  />
                </g>
              );
            })}
          </svg>

          {hovered && hover != null ? (
            <div
              className="pointer-events-none absolute top-2 z-10 w-56 rounded-2xl border border-line-strong bg-graphite/95 p-4 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl"
              style={{
                left: Math.min(
                  Math.max(8, PAD.left + band * hover + band / 2 + (hover >= months.length / 2 ? -240 : 16)),
                  width - 232,
                ),
              }}
              role="status"
            >
              <p className="label mb-3 text-mute">{monthLong(hovered.key)}</p>
              <TooltipRow color={COLORS.recebido} label="Recebido" value={hovered.entradasRealizado} />
              <TooltipRow color={COLORS.previsto} label="A receber" value={hovered.entradasPrevisto} />
              <TooltipRow color={COLORS.pago} label="Pago" value={hovered.saidasRealizado} />
              <TooltipRow color={COLORS.previsto} label="A pagar" value={hovered.saidasPrevisto} />
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
                <span className="text-[12px] text-mute">Saldo previsto</span>
                <span className="text-[14px] font-semibold text-white tabular-nums">{brl(hovered.saldo)}</span>
              </div>
            </div>
          ) : null}
          {currentIndex < 0 ? null : <span className="sr-only">Mês atual: {monthLong(current)}</span>}
        </div>
      )}
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex items-center gap-2 text-[12px] text-mute">
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </span>
      <span className="text-[13px] font-medium text-light tabular-nums">{brl(value)}</span>
    </div>
  );
}
