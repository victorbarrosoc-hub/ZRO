"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type RowCol<K extends string> = {
  key: K;
  label: string;
  placeholder?: string;
  type?: "text" | "time" | "tel";
  /** Largura da coluna no desktop (trilha do CSS grid). */
  track: string;
  /** No celular: ocupa a linha inteira (padrão) ou meia linha. */
  half?: boolean;
};

type Row = { _k: string };

/**
 * Lista de linhas editáveis (cronograma, equipe, contatos): tabela no desktop,
 * cartões no celular. Enter numa célula cria a linha seguinte.
 */
export function RowsEditor<R extends Row, K extends Exclude<keyof R, "_k"> & string>({
  id,
  rows,
  cols,
  onChange,
  makeRow,
  addLabel,
  empty,
}: {
  id: string;
  rows: R[];
  cols: RowCol<K>[];
  onChange: (rows: R[]) => void;
  makeRow: (previous?: R) => R;
  addLabel: string;
  empty: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const template = `${cols.map((c) => c.track).join(" ")} 124px`;

  function focusRow(index: number) {
    requestAnimationFrame(() => {
      const li = listRef.current?.children[index];
      li?.querySelector<HTMLInputElement>("input")?.focus();
    });
  }
  function update(i: number, key: K, value: string) {
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }
  function insertAfter(i: number) {
    const next = [...rows];
    next.splice(i + 1, 0, makeRow(rows[i]));
    onChange(next);
    focusRow(i + 1);
  }
  function remove(i: number) {
    onChange(rows.filter((_, j) => j !== i));
  }
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {rows.length ? (
        <>
          <div className="hidden gap-2 px-1 text-[12px] text-mute md:grid" style={{ gridTemplateColumns: template }} aria-hidden>
            {cols.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
            <span />
          </div>
          <ul ref={listRef} className="grid gap-2">
            {rows.map((row, i) => (
              <li
                key={row._k}
                className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white/[0.015] p-3 md:[grid-template-columns:var(--row-cols)] md:items-center md:rounded-none md:border-0 md:bg-transparent md:p-0"
                style={{ "--row-cols": template } as React.CSSProperties}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName === "INPUT") {
                    e.preventDefault();
                    insertAfter(i);
                  }
                }}
              >
                {cols.map((c) => {
                  const inputId = `${id}-${i}-${c.key}`;
                  return (
                    <div key={c.key} className={cn("grid min-w-0 gap-1", !c.half && "col-span-2 md:col-span-1")}>
                      <label htmlFor={inputId} className="text-[12px] text-mute md:sr-only">
                        {c.label}
                      </label>
                      <Input
                        id={inputId}
                        type={c.type ?? "text"}
                        inputMode={c.type === "tel" ? "tel" : undefined}
                        value={(row[c.key] as string) ?? ""}
                        placeholder={c.placeholder}
                        onChange={(e) => update(i, c.key, e.target.value)}
                        className="h-10 text-[14px]"
                      />
                    </div>
                  );
                })}
                <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
                  <RowButton label="Subir linha" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp />
                  </RowButton>
                  <RowButton label="Descer linha" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                    <ArrowDown />
                  </RowButton>
                  <RowButton label="Remover linha" onClick={() => remove(i)} danger>
                    <X />
                  </RowButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-4 text-[14px] text-mute">{empty}</p>
      )}
      <div>
        <Button
          variant="subtle"
          size="sm"
          className="h-10"
          onClick={() => {
            onChange([...rows, makeRow(rows.at(-1))]);
            focusRow(rows.length);
          }}
        >
          <Plus /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

function RowButton({
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
