"use client";

import { Files, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ehIOS } from "@/lib/drive/navegador/plataforma";
import { deInput, deSoltura, podeEscolherPasta, type Selecao } from "@/lib/drive/navegador/selecao";
import { cn } from "@/lib/utils";

/**
 * Escolha do material nas páginas públicas: botões (pasta inteira ou arquivos soltos) e a área de
 * soltar. A pasta mantém a estrutura; com `tirarRaiz` (o cartão do freela) a pasta de topo vira o nome
 * do cartão e o conteúdo vai direto para o rolo. Arquivos de sistema ficam de fora (docs/dev/drive.md §6).
 */

const semAssinatura = () => () => {};
let pastaCache: boolean | null = null;
function pastaNoAparelho(): boolean {
  if (pastaCache === null) pastaCache = podeEscolherPasta();
  return pastaCache;
}

/** O aparelho escolhe pastas inteiras? Falso no servidor e no iPhone. */
export function usePodeEscolherPasta(): boolean {
  return useSyncExternalStore(semAssinatura, pastaNoAparelho, () => false);
}

/** iPhone ou iPad (o envio para em segundo plano). Falso no servidor. */
export function useEhIOS(): boolean {
  return useSyncExternalStore(semAssinatura, ehIOS, () => false);
}

/**
 * Arquivo solto fora da área de soltar não abre no navegador: abrir trocaria de página e derrubaria
 * o envio em andamento.
 */
export function useSemSolturaFora(): void {
  useEffect(() => {
    const bloquear = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
      e.preventDefault();
      if (e.type === "dragover") e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => {
      window.removeEventListener("dragover", bloquear);
      window.removeEventListener("drop", bloquear);
    };
  }, []);
}

// Atributos de pasta do <input type="file"> (fora dos tipos do React).
const atributosDePasta = { webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>;

const botaoPrincipal =
  "inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white px-7 text-base font-medium text-void transition-colors hover:bg-light disabled:pointer-events-none disabled:opacity-40";
const botaoSecundario =
  "inline-flex h-14 items-center justify-center gap-3 rounded-full border border-line-strong px-7 text-base text-light transition-colors hover:border-white/40 hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40";

export function Seletor({
  principal,
  rotuloPasta,
  rotuloArquivos,
  textoSoltar,
  notaCelular,
  tirarRaiz = false,
  desativado = false,
  onEscolher,
}: {
  /** O que vem primeiro quando o aparelho escolhe pastas. */
  principal: "pasta" | "arquivos";
  rotuloPasta: string;
  rotuloArquivos: string;
  textoSoltar: string;
  /** Aparelho sem escolha de pasta (iPhone). */
  notaCelular?: string;
  tirarRaiz?: boolean;
  desativado?: boolean;
  onEscolher: (s: Selecao) => void;
}) {
  const pastaRef = useRef<HTMLInputElement>(null);
  const arquivosRef = useRef<HTMLInputElement>(null);
  const podePasta = usePodeEscolherPasta();
  const [sobre, setSobre] = useState(false);
  const [lendo, setLendo] = useState(false);

  function receber(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Limpa para que o mesmo cartão possa ser escolhido de novo (é assim que um envio continua).
    e.target.value = "";
    if (files.length) onEscolher(deInput(files, { tirarRaiz }));
  }

  function soltar(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setSobre(false);
    if (desativado || lendo) return;
    // deSoltura lê os itens antes do primeiro await: tem que ser chamada aqui, sem esperar nada antes.
    const leitura = deSoltura(e.dataTransfer, { tirarRaiz });
    setLendo(true);
    leitura
      .then((s) => {
        if (s.arquivos.length || s.ignorados.length) onEscolher(s);
      })
      .catch(() => {})
      .finally(() => setLendo(false));
  }

  const pasta = (
    <button
      key="pasta"
      type="button"
      disabled={desativado || lendo}
      onClick={() => pastaRef.current?.click()}
      className={principal === "pasta" ? botaoPrincipal : botaoSecundario}
    >
      <FolderOpen className="size-5" aria-hidden />
      {rotuloPasta}
    </button>
  );
  const arquivos = (
    <button
      key="arquivos"
      type="button"
      disabled={desativado || lendo}
      onClick={() => arquivosRef.current?.click()}
      className={principal === "arquivos" || !podePasta ? botaoPrincipal : botaoSecundario}
    >
      <Files className="size-5" aria-hidden />
      {rotuloArquivos}
    </button>
  );
  const botoes = !podePasta ? [arquivos] : principal === "pasta" ? [pasta, arquivos] : [arquivos, pasta];

  return (
    <div
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = desativado ? "none" : "copy";
        if (!sobre && !desativado) setSobre(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={soltar}
      className={cn(
        "rounded-media border border-dashed p-5 transition-[border-color,background-color] duration-200 sm:p-8",
        sobre ? "border-white/70 bg-white/[0.06]" : "border-line-strong bg-white/[0.015]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{botoes}</div>
      <p className="mt-5 text-caption text-mute" aria-live="polite">
        {lendo ? "Lendo os arquivos…" : sobre ? "Solte para escolher." : podePasta ? textoSoltar : (notaCelular ?? "")}
      </p>
      <input ref={pastaRef} type="file" multiple hidden tabIndex={-1} onChange={receber} {...atributosDePasta} />
      <input ref={arquivosRef} type="file" multiple hidden tabIndex={-1} onChange={receber} />
    </div>
  );
}
