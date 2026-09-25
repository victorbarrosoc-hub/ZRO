"use client";

import { useEffect } from "react";

/**
 * No celular a barra de abas rola para o lado: traz a aba ativa para a vista
 * (ao abrir "?aba=financeiro" direto, ela ficaria escondida à direita).
 */
export function KeepActiveTabVisible({ active }: { active: string }) {
  useEffect(() => {
    const tab = document.querySelector<HTMLElement>('nav[aria-label="Seções"] [aria-current="page"]');
    const nav = tab?.closest("nav");
    if (!tab || !nav || nav.scrollWidth <= nav.clientWidth) return;
    const offset = tab.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollLeft += offset - (nav.clientWidth - tab.clientWidth) / 2;
  }, [active]);
  return null;
}
