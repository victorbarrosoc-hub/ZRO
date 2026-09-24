"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { saveScript } from "./actions";
import { wordCount, type Shot } from "./script-kinds";
import { statusLabel, useAutosave, type SaveStatus } from "./use-autosave";

function SaveState({ status, savedAt, onSave }: { status: SaveStatus; savedAt: Date | null; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <p
        className={cn("flex items-center gap-2 text-[13px]", status === "error" ? "text-danger" : status === "saved" ? "text-mute" : "text-warn")}
        aria-live="polite"
      >
        {status === "saved" ? <Check className="size-3.5" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}
        {statusLabel(status, savedAt)}
      </p>
      <Button variant={status === "saved" ? "secondary" : "primary"} size="sm" onClick={onSave} disabled={status === "saving"}>
        Salvar
      </Button>
    </div>
  );
}

function useScriptSaver(scriptId: string, projectId: string) {
  return useCallback(
    (payload: string) => {
      const data = JSON.parse(payload) as { title: string; content?: string; shots?: unknown[] };
      const fd = new FormData();
      fd.set("id", scriptId);
      fd.set("projectId", projectId);
      fd.set("title", data.title);
      if (data.content !== undefined) fd.set("content", data.content);
      if (data.shots) fd.set("shots", JSON.stringify(data.shots));
      return saveScript(null, fd);
    },
    [scriptId, projectId],
  );
}

/* ============================== Roteiro (texto) ============================== */

export function ScriptTextEditor({
  scriptId,
  projectId,
  title: initialTitle,
  content: initialContent,
}: {
  scriptId: string;
  projectId: string;
  title: string;
  content: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const payload = useMemo(() => JSON.stringify({ title, content }), [title, content]);
  const save = useScriptSaver(scriptId, projectId);
  const { status, savedAt, saveNow } = useAutosave(payload, save, 2000);

  const words = wordCount(content);
  // Locução em ritmo natural: ~150 palavras por minuto.
  const seconds = Math.round((words / 150) * 60);
  const reading = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-mute">
          {words} {words === 1 ? "palavra" : "palavras"}
          {words ? ` · cerca de ${reading} de locução` : ""}
        </p>
        <SaveState status={status} savedAt={savedAt} onSave={saveNow} />
      </div>
      <Card className="px-4 py-6 sm:px-10 sm:py-10">
        <div className="mx-auto grid w-full max-w-[80ch] gap-6">
          <label htmlFor="sc-title" className="sr-only">
            Título
          </label>
          <input
            id="sc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveNow}
            placeholder="Título do roteiro"
            className="w-full border-b border-line bg-transparent pb-3 text-[24px] font-semibold tracking-[-0.02em] text-white placeholder:text-mute focus:border-white/40 focus:outline-none sm:text-[28px]"
          />
          <label htmlFor="sc-content" className="sr-only">
            Texto do roteiro
          </label>
          <Textarea
            id="sc-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={saveNow}
            spellCheck
            placeholder={"CENA 1 · EXT. PRAIA DE PIPA · FIM DE TARDE\n\nO sol baixo desenha a linha do mar.\n\nLOCUÇÃO (off)\nAlguns lugares não se explicam. Se sentem."}
            className="min-h-[60vh] resize-y border-0 bg-transparent px-0 py-0 font-mono text-[14.5px] leading-[1.85] text-light hover:border-0 focus:bg-transparent focus:ring-0 [field-sizing:content] sm:text-[15px]"
          />
        </div>
      </Card>
      <p className="text-[12px] text-mute">Salva sozinho enquanto você escreve. Ctrl + S (ou ⌘ + S) salva na hora.</p>
    </div>
  );
}

/* ============================== Decupagem e shot list ============================== */

type ShotRow = Shot & { _k: string };

let keySeq = 0;
const nextKey = () => `s${++keySeq}`;
const emptyShot = (scene = ""): ShotRow => ({ _k: nextKey(), scene, shot: "", description: "", lens: "", movement: "", done: false });

const COLS = "md:grid-cols-[40px_76px_minmax(0,0.9fr)_minmax(0,2fr)_minmax(0,0.75fr)_minmax(0,1fr)_112px_124px]";

export function ShotListEditor({
  scriptId,
  projectId,
  title: initialTitle,
  shots: initialShots,
}: {
  scriptId: string;
  projectId: string;
  title: string;
  shots: Shot[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [rows, setRows] = useState<ShotRow[]>(() =>
    initialShots.length ? initialShots.map((s) => ({ ...s, lens: s.lens ?? "", movement: s.movement ?? "", done: !!s.done, _k: nextKey() })) : [emptyShot("1")],
  );
  const listRef = useRef<HTMLOListElement>(null);

  const payload = useMemo(
    () =>
      JSON.stringify({
        title,
        shots: rows.map((r) => ({
          scene: r.scene,
          shot: r.shot,
          description: r.description,
          lens: r.lens,
          movement: r.movement,
          done: r.done,
        })),
      }),
    [title, rows],
  );
  const save = useScriptSaver(scriptId, projectId);
  const { status, savedAt, saveNow } = useAutosave(payload, save, 1200);

  const filled = rows.filter((r) => r.scene || r.shot || r.description || r.lens || r.movement);
  const done = filled.filter((r) => r.done).length;

  function focusRow(index: number) {
    requestAnimationFrame(() => listRef.current?.children[index]?.querySelector<HTMLInputElement>("input")?.focus());
  }
  function update(i: number, patch: Partial<ShotRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function insertAfter(i: number) {
    setRows((rs) => {
      const next = [...rs];
      next.splice(i + 1, 0, emptyShot(rs[i]?.scene ?? ""));
      return next;
    });
    focusRow(i + 1);
  }
  function move(i: number, delta: number) {
    setRows((rs) => {
      const j = i + delta;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="sh-title" className="sr-only">
            Título
          </label>
          <Input id="sh-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveNow} placeholder="Título da lista" />
        </div>
        <SaveState status={status} savedAt={savedAt} onSave={saveNow} />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-[28px] leading-none font-semibold tracking-[-0.03em] text-white">
            {done} <span className="text-mute">de {filled.length}</span>{" "}
            <span className="text-[15px] font-normal tracking-normal text-ash">{filled.length === 1 ? "plano feito" : "planos feitos"}</span>
          </p>
          <p className="text-[13px] text-mute">Enter numa célula cria o próximo plano na mesma cena.</p>
        </div>
        {filled.length ? (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={`${done} de ${filled.length} planos feitos`}>
            <div className="h-full bg-white transition-[width] duration-500 ease-out-expo" style={{ width: `${(done / filled.length) * 100}%` }} />
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className={cn("hidden gap-2 border-b border-line px-6 py-3 text-[12px] text-mute md:grid", COLS)} aria-hidden>
          <span>#</span>
          <span>Cena</span>
          <span>Plano</span>
          <span>Descrição</span>
          <span>Lente</span>
          <span>Movimento</span>
          <span>Status</span>
          <span />
        </div>
        <ol ref={listRef} className="grid grid-cols-1">
          {rows.map((r, i) => (
            <li
              key={r._k}
              className={cn(
                "grid grid-cols-2 gap-2 border-b border-line px-5 py-4 last:border-b-0 md:items-center md:px-6 md:py-2.5",
                COLS,
                r.done && "bg-white/[0.02]",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName === "INPUT") {
                  e.preventDefault();
                  insertAfter(i);
                }
              }}
            >
              <span className="col-span-2 font-mono text-[12px] text-mute tabular-nums md:col-span-1">
                <span className="md:hidden">Plano </span>
                {String(i + 1).padStart(2, "0")}
              </span>
              <ShotInput label="Cena" id={`sh-${i}-scene`} value={r.scene} onChange={(v) => update(i, { scene: v })} onBlur={saveNow} placeholder="1" done={r.done} />
              <ShotInput label="Plano" id={`sh-${i}-shot`} value={r.shot} onChange={(v) => update(i, { shot: v })} onBlur={saveNow} placeholder="Geral" done={r.done} />
              <ShotInput
                label="Descrição"
                id={`sh-${i}-description`}
                value={r.description}
                onChange={(v) => update(i, { description: v })}
                onBlur={saveNow}
                placeholder="O que o plano mostra"
                done={r.done}
                wide
              />
              <ShotInput label="Lente" id={`sh-${i}-lens`} value={r.lens ?? ""} onChange={(v) => update(i, { lens: v })} onBlur={saveNow} placeholder="35mm" done={r.done} />
              <ShotInput
                label="Movimento"
                id={`sh-${i}-movement`}
                value={r.movement ?? ""}
                onChange={(v) => update(i, { movement: v })}
                onBlur={saveNow}
                placeholder="Gimbal"
                done={r.done}
              />
              <button
                type="button"
                role="switch"
                aria-checked={!!r.done}
                aria-label={`Plano ${i + 1} feito`}
                onClick={() => update(i, { done: !r.done })}
                className={cn(
                  "inline-flex h-12 items-center justify-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-[background-color,border-color,color] duration-200 active:scale-[0.97] md:h-10",
                  r.done ? "border-ok/45 bg-ok/[0.12] text-ok" : "border-line-strong bg-white/[0.02] text-ash hover:border-white/30 hover:text-light",
                )}
              >
                <span
                  className={cn("grid size-5 place-items-center rounded-full border", r.done ? "border-ok bg-ok text-void" : "border-current opacity-60")}
                  aria-hidden
                >
                  {r.done ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                {r.done ? "Feito" : "A fazer"}
              </button>
              <div className="flex items-center justify-end gap-1">
                <IconButton label="Subir plano" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp />
                </IconButton>
                <IconButton label="Descer plano" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                  <ArrowDown />
                </IconButton>
                <IconButton label="Remover plano" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} danger>
                  <X />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
        <div className="border-t border-line px-5 py-4 md:px-6">
          <Button
            variant="subtle"
            size="sm"
            className="h-10"
            onClick={() => {
              setRows((rs) => [...rs, emptyShot(rs.at(-1)?.scene ?? "")]);
              focusRow(rows.length);
            }}
          >
            <Plus /> Adicionar plano
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ShotInput({
  label,
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  done,
  wide,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  done?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1", wide && "col-span-2 md:col-span-1")}>
      <label htmlFor={id} className="text-[12px] text-mute md:sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn("h-10 text-[14px]", done && "text-ash")}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.08] hover:text-light disabled:pointer-events-none disabled:opacity-25 [&_svg]:size-4",
        danger && "hover:bg-danger/10 hover:text-danger",
      )}
    >
      {children}
    </button>
  );
}
