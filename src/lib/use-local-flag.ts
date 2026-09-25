"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "zro-local-flag";

/** Liga/desliga guardado no navegador (ex.: sidebar recolhida). Falso no servidor. */
export function useLocalFlag(key: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const handler = (e: Event) => {
        if (e instanceof StorageEvent && e.key !== key) return;
        cb();
      };
      window.addEventListener("storage", handler);
      window.addEventListener(EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(EVENT, handler);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* sem armazenamento local */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
