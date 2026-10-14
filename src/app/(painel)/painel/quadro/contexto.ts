"use client";

import { createContext, useContext, type CSSProperties } from "react";
import { COL, type ColKey, type Config, type Filtro, type Metodo } from "./metodo";
import type { QuadroStore } from "./store";

export type AbaFicha = "conteudo" | "peca" | "detalhes";
/** Onde o card vai cair: entre dois cards de uma coluna, ou no fim de uma coluna (faixa ou coluna recolhida). */
export type Alvo = { col: ColKey; antes: string | null } | { fim: ColKey; faixa: boolean };

/** Estado da tela (o que não vai para o banco). */
export type UI = {
  vista: "colunas" | "prazo";
  filtro: Filtro;
  colMovel: ColKey;
  verMais: Record<string, number>;
  recolhidas: string[];
  ficha: string | null;
  abaFicha: AbaFicha;
  baseAr: boolean;
  add: ColKey | null;
  addN: number;
  troca: string | null;
  apagando: boolean;
  lixeira: boolean;
  menu: { id: string; left: number; top: number; bottom: number } | null;
  arraste: string | null;
  alvo: Alvo | null;
  pede: string | null;
};

export type Q = {
  store: QuadroStore;
  cfg: Config;
  m: Metodo;
  ui: UI;
  mobile: boolean;
  up: (p: Partial<UI> | ((u: UI) => Partial<UI>)) => void;
  abrirFicha: (id: string, campoFoco?: string) => void;
  fecharFicha: () => void;
  executar: (id: string, acao: string, bt: HTMLElement) => void;
};

export const QCtx = createContext<Q | null>(null);

export function useQ() {
  const q = useContext(QCtx);
  if (!q) throw new Error("Quadro fora do contexto");
  return q;
}

/** A cor da coluna, como variável de CSS (coluna desconhecida cai na cor da Pauta). */
export const cc = (k: string) => ({ "--cc": `var(--col-${k in COL ? k : "pauta"})` }) as CSSProperties;

export const FILTRO_VAZIO: Filtro = { pessoa: "todos", cliente: "todos", data: "todos" };
