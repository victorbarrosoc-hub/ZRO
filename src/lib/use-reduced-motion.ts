"use client";

import { useEffect, useState } from "react";

/**
 * Preferência "menos movimento" do sistema. Começa em false no servidor e
 * na primeira renderização do navegador (evita diferença na hidratação) e
 * atualiza logo depois de montar.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
