"use client";

import { useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { EQUIPMENT_CATEGORIES, cleanEquipmentName, equipmentKey, guessEquipmentCategory, optionLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type EquipmentOption = { id: string; name: string; category: string };
type Picked = { key: string; name: string; category: string; value: string };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const fromCatalog = (e: EquipmentOption): Picked => ({ key: e.id, name: e.name, category: e.category, value: `id:${e.id}` });

/**
 * Equipamento do freela: busca no banco de equipamentos, navega por categoria
 * e toca para adicionar. O que não existe no banco entra nele ao salvar.
 */
export function EquipmentPicker({ catalog, defaults = [] }: { catalog: EquipmentOption[]; defaults?: EquipmentOption[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>(() => defaults.map(fromCatalog));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const pickedKeys = new Set(picked.map((p) => p.key));
  const pickedNames = new Set(picked.map((p) => equipmentKey(p.name)));
  const compact = equipmentKey(query);
  const words = norm(query).split(/\s+/).filter(Boolean);
  const browsing = words.length > 0 || category !== null;

  const matches = (() => {
    if (!browsing) return [];
    const list = catalog.filter((e) => {
      if (category && e.category !== category) return false;
      const n = norm(e.name);
      // "a7iv" também acha "Sony A7 IV".
      return words.every((w) => n.includes(w)) || (compact.length > 1 && equipmentKey(e.name).includes(compact));
    });
    const first = words[0];
    if (first) list.sort((a, b) => Number(!norm(a.name).startsWith(first)) - Number(!norm(b.name).startsWith(first)));
    return list;
  })();

  const available = matches.filter((e) => !pickedKeys.has(e.id)).slice(0, words.length ? 12 : 100);
  const typed = cleanEquipmentName(query);
  const exists = typed ? catalog.some((e) => equipmentKey(e.name) === equipmentKey(typed)) || pickedNames.has(equipmentKey(typed)) : true;
  // Categoria do novo: a escolhida no seletor; senão a que o nome indica; senão a do filtro aberto.
  const fromName = typed ? guessEquipmentCategory(typed) : "outro";
  const guessed = newCategory ?? (fromName !== "outro" ? fromName : (category ?? "outro"));

  function add(item: Picked) {
    setPicked((prev) => (prev.some((p) => p.key === item.key || equipmentKey(p.name) === equipmentKey(item.name)) ? prev : [...prev, item]));
    setQuery("");
    setNewCategory(null);
    inputRef.current?.focus();
  }

  function addTyped() {
    if (!typed || exists) return;
    add({ key: `novo:${norm(typed)}`, name: typed, category: guessed, value: `novo:${guessed}|${typed}` });
  }

  const groups = EQUIPMENT_CATEGORIES.map((c) => ({ ...c, items: picked.filter((p) => p.category === c.key) })).filter(
    (g) => g.items.length,
  );

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-[13px] font-medium text-ash">
        <span>Equipamento próprio</span>
        {picked.length ? <span className="label text-mute">{picked.length} {picked.length === 1 ? "item" : "itens"}</span> : null}
      </legend>

      {groups.length ? (
        <div className="grid gap-3 rounded-[18px] border border-line bg-white/[0.02] p-3.5">
          {groups.map((g) => (
            <div key={g.key} className="grid gap-2">
              <p className="label text-mute">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((p) => (
                  <span
                    key={p.key}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-white/70 bg-white py-0.5 pr-1 pl-3.5 text-[13px] font-medium text-void"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.key !== p.key))}
                      className="grid size-7 place-items-center rounded-full text-void/60 transition-colors hover:bg-void/10 hover:text-void"
                      aria-label={`Tirar ${p.name}`}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mute" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNewCategory(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Enter aqui adiciona o equipamento, não envia o cadastro.
            e.preventDefault();
            if (available[0] && words.length) add(fromCatalog(available[0]));
            else addTyped();
          }}
          placeholder="Buscar no banco ou digitar um novo"
          aria-label="Buscar equipamento"
          autoComplete="off"
          className="h-11 w-full rounded-full border border-line-strong bg-white/[0.03] pr-4 pl-11 text-[15px] text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {EQUIPMENT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory((prev) => (prev === c.key ? null : c.key))}
            aria-pressed={category === c.key}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
              category === c.key ? "border-white bg-white text-void" : "border-line-strong text-ash hover:border-white/30 hover:text-light",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {browsing ? (
        <div className="grid gap-3 rounded-[18px] border border-dashed border-white/15 p-3.5">
          {available.length ? (
            <div className="flex flex-wrap gap-2">
              {available.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => add(fromCatalog(e))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] text-light transition-colors hover:border-white/60 hover:bg-white/[0.05]"
                >
                  <Plus className="size-3.5 text-mute" aria-hidden />
                  {e.name}
                  {!category ? <span className="text-[11px] text-mute">· {optionLabel(EQUIPMENT_CATEGORIES, e.category)}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-mute">
              {words.length ? "Nada no banco com esse nome." : "Tudo dessa categoria já está na lista."}
            </p>
          )}

          {typed && !exists ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={addTyped}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-void transition-opacity hover:opacity-90"
              >
                <Plus className="size-3.5" aria-hidden /> Adicionar “{typed}”
              </button>
              <label className="inline-flex items-center gap-2 text-[13px] text-mute">
                em
                <select
                  value={guessed}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-9 rounded-full border border-line-strong bg-transparent px-3 text-[13px] text-light focus:border-white/50 focus:outline-none"
                >
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key} className="bg-ink">
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {picked.map((p) => (
        <input key={p.key} type="hidden" name="equipment" value={p.value} />
      ))}
    </fieldset>
  );
}
