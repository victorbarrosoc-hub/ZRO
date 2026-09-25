"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";
import { useUnsavedGuard } from "../_tabs/documentos-client";

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

/**
 * Salva sozinho: depois de uma pausa na digitação, ao sair do campo
 * (chame `saveNow`) e com Ctrl/Cmd + S. Um salvamento por vez; o que
 * mudar enquanto salva entra no próximo.
 */
export function useAutosave(payload: string, save: (payload: string) => Promise<ActionResult>, delay = 1500) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [, startTransition] = useTransition();
  const latest = useRef(payload);
  const lastSaved = useRef(payload);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const saveNow = useCallback(() => {
    if (latest.current === lastSaved.current) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    startTransition(async () => {
      // Salva em sequência até alcançar a última versão pedida.
      for (;;) {
        const current = latest.current;
        queued.current = false;
        let res: ActionResult;
        try {
          res = await saveRef.current(current);
        } catch {
          res = { ok: false, error: "Sem conexão. O texto continua aqui; tente salvar de novo." };
        }
        if (!res.ok) {
          inFlight.current = false;
          setStatus("error");
          toast.error(res.error);
          return;
        }
        lastSaved.current = current;
        setSavedAt(new Date());
        if (!queued.current || latest.current === lastSaved.current) break;
      }
      inFlight.current = false;
      setStatus(latest.current === lastSaved.current ? "saved" : "dirty");
    });
  }, []);

  // Mudou: marca como pendente e agenda o salvamento.
  useEffect(() => {
    latest.current = payload;
    if (payload === lastSaved.current) return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    const t = setTimeout(saveNow, delay);
    return () => clearTimeout(t);
  }, [payload, delay, saveNow]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNow]);

  // Aviso ao sair com algo sem salvar.
  useUnsavedGuard(status !== "saved", "Ainda tem alteração sendo salva. Sair mesmo assim?");

  return { status, savedAt, saveNow };
}

export function statusLabel(status: SaveStatus, savedAt: Date | null) {
  if (status === "saving") return "Salvando…";
  if (status === "dirty") return "Alterações não salvas";
  if (status === "error") return "Não foi salvo";
  if (!savedAt) return "Tudo salvo";
  const t = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(savedAt);
  return `Salvo às ${t}`;
}
