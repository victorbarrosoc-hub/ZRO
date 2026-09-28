"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, PackagePlus, PencilLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, MoneyInput, Select } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { CATALOG_UNITS } from "@/lib/domain";
import { brl, centsToInput, parseBRL } from "@/lib/format";
import type { CatalogOption } from "@/lib/queries/quotes";
import { lineTotal, quantityLabel } from "@/lib/services/quotes";
import { cn } from "@/lib/utils";
import { CustomItemDialog, type CustomMode } from "./custom-item";
import { blankItem, groupCatalog, itemFromCatalog, parseQuantity, type DraftItem } from "./draft";

/* Colunas da linha no modo tabela (cartão com 860px ou mais). */
const ROW_GRID = "@min-[860px]:grid-cols-[20px_minmax(0,1fr)_60px_112px_120px_120px_108px_84px]";
const LABEL = "text-[12px] text-mute @min-[860px]:sr-only";

export function ItemsEditor({
  items,
  onChange,
  catalog,
  disabled,
  error,
}: {
  items: DraftItem[];
  onChange: (next: DraftItem[]) => void;
  catalog: CatalogOption[];
  disabled: boolean;
  error?: string;
}) {
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [custom, setCustom] = useState<{ open: boolean; mode: CustomMode }>({ open: false, mode: "item" });
  const groups = groupCatalog(catalog);
  const openCustom = (mode: CustomMode) => setCustom({ open: true, mode });

  const update = (key: string, patch: Partial<DraftItem>) => onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const add = (item: DraftItem, focus = false) => {
    onChange([...items, item]);
    if (focus) setFocusKey(item.key);
  };
  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const formatMoney = (key: string, field: "unitPrice" | "unitCost", value: string) => {
    const cents = parseBRL(value);
    update(key, { [field]: cents == null ? "" : centsToInput(cents) });
  };

  return (
    <div className="@container mt-5 grid gap-4">
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {items.length ? (
        <div>
          <div
            aria-hidden
            className={cn("label hidden gap-x-2 border-b border-line px-2 pb-2.5 text-mute @min-[860px]:grid", ROW_GRID)}
          >
            <span>#</span>
            <span>Descrição e detalhe</span>
            <span>Qtd</span>
            <span>Unidade</span>
            <span>Valor unit.</span>
            <span>Custo unit.</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ol className="grid gap-3 @min-[860px]:gap-0">
            {items.map((it, i) => {
              const n = String(i + 1).padStart(2, "0");
              const total = lineTotal({ quantity: parseQuantity(it.quantity), unitPrice: parseBRL(it.unitPrice) ?? 0 });
              const id = (f: string) => `it-${it.key}-${f}`;
              return (
                <li
                  key={it.key}
                  className={cn(
                    "grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white/[0.015] p-4",
                    "@min-[860px]:items-start @min-[860px]:gap-x-2 @min-[860px]:gap-y-0 @min-[860px]:rounded-none @min-[860px]:border-0 @min-[860px]:border-b @min-[860px]:bg-transparent @min-[860px]:px-2 @min-[860px]:py-3",
                    ROW_GRID,
                  )}
                >
                  <span className="self-center font-mono text-[11px] text-mute @min-[860px]:self-start @min-[860px]:pt-3">{n}</span>

                  <div className="flex justify-end gap-1 @min-[860px]:order-last @min-[860px]:pt-1">
                    <IconButton label={`Subir item ${n}`} onClick={() => move(i, -1)} disabled={disabled || i === 0}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label={`Descer item ${n}`} onClick={() => move(i, 1)} disabled={disabled || i === items.length - 1}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label={`Remover item ${n}`} onClick={() => remove(it.key)} disabled={disabled} danger>
                      <Trash2 />
                    </IconButton>
                  </div>

                  <div className="col-span-2 grid gap-1.5 @min-[860px]:col-span-1">
                    <label htmlFor={id("desc")} className={LABEL}>
                      Descrição (o cliente vê)
                    </label>
                    <Input
                      id={id("desc")}
                      value={it.description}
                      onChange={(e) => update(it.key, { description: e.target.value })}
                      placeholder="Ex.: Diária de captação"
                      disabled={disabled}
                      maxLength={200}
                      autoFocus={focusKey === it.key}
                      className="h-10 px-3 text-[14px]"
                    />
                    <label htmlFor={id("detail")} className={LABEL}>
                      Detalhe (opcional)
                    </label>
                    <Input
                      id={id("detail")}
                      value={it.detail}
                      onChange={(e) => update(it.key, { detail: e.target.value })}
                      placeholder="O que está incluso, em uma linha"
                      disabled={disabled}
                      maxLength={500}
                      className="h-9 px-3 text-[13px] text-ash"
                    />
                  </div>

                  <div className="grid content-start gap-1.5">
                    <label htmlFor={id("qty")} className={LABEL}>
                      Quantidade
                    </label>
                    <Input
                      id={id("qty")}
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => update(it.key, { quantity: e.target.value })}
                      onBlur={(e) => {
                        const q = parseQuantity(e.target.value);
                        update(it.key, { quantity: q > 0 ? quantityLabel(q) : e.target.value });
                      }}
                      disabled={disabled}
                      className="h-10 px-3 text-[14px] tabular-nums"
                    />
                  </div>

                  <div className="grid content-start gap-1.5">
                    <label htmlFor={id("unit")} className={LABEL}>
                      Unidade
                    </label>
                    <Select
                      id={id("unit")}
                      value={it.unit}
                      onChange={(e) => update(it.key, { unit: e.target.value })}
                      disabled={disabled}
                      className="h-10 pr-8 pl-3 text-[14px]"
                    >
                      <option value="">—</option>
                      {CATALOG_UNITS.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid content-start gap-1.5">
                    <label htmlFor={id("price")} className={LABEL}>
                      Valor unitário
                    </label>
                    <MoneyInput
                      id={id("price")}
                      value={it.unitPrice}
                      onChange={(e) => update(it.key, { unitPrice: e.target.value })}
                      onBlur={(e) => formatMoney(it.key, "unitPrice", e.target.value)}
                      placeholder="0,00"
                      disabled={disabled}
                      className="h-10 pr-3 pl-9 text-[14px]"
                    />
                  </div>

                  <div className="grid content-start gap-1.5">
                    <label htmlFor={id("cost")} className={LABEL}>
                      Custo unitário (interno)
                    </label>
                    <MoneyInput
                      id={id("cost")}
                      value={it.unitCost}
                      onChange={(e) => update(it.key, { unitCost: e.target.value })}
                      onBlur={(e) => formatMoney(it.key, "unitCost", e.target.value)}
                      placeholder="0,00"
                      disabled={disabled}
                      className="h-10 border-dashed pr-3 pl-9 text-[14px]"
                    />
                  </div>

                  <p className="col-span-2 flex items-baseline justify-between gap-3 border-t border-line pt-3 @min-[860px]:col-span-1 @min-[860px]:block @min-[860px]:border-0 @min-[860px]:pt-2.5 @min-[860px]:text-right">
                    <span className="text-[13px] text-mute @min-[860px]:sr-only">Total do item</span>
                    <span className="text-[15px] text-white tabular-nums @min-[860px]:text-[14px]">{brl(total)}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : disabled ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-5 py-6 text-center text-[14px] text-mute">Nenhum item.</p>
      ) : (
        <div className="grid gap-5 rounded-2xl border border-dashed border-white/15 p-5">
          <p className="text-[14px] text-ash">Nenhum item ainda. Crie sob medida ou traga do catálogo com um clique:</p>
          <div>
            <p className="label mb-2 text-mute">Sob medida</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openCustom("item")} className={CUSTOM_CHIP}>
                <PencilLine className="size-3.5 shrink-0" aria-hidden />
                Item avulso
              </button>
              <button type="button" onClick={() => openCustom("pacote")} className={CUSTOM_CHIP}>
                <PackagePlus className="size-3.5 shrink-0" aria-hidden />
                Pacote personalizado
              </button>
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.key}>
              <p className="label mb-2 text-mute">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((ci) => (
                  <button
                    key={ci.id}
                    type="button"
                    onClick={() => add(itemFromCatalog(ci))}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 py-2 text-left text-[13px] text-light transition-colors hover:border-white/40 hover:bg-white/[0.04]"
                  >
                    <Plus className="size-3.5 shrink-0 text-mute" aria-hidden />
                    <span>{ci.name}</span>
                    <span className="text-mute tabular-nums">{brl(ci.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          {items.length && groups.length ? (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Plus /> Do catálogo <ChevronDown className="text-mute" />
                </Button>
              </MenuTrigger>
              <MenuContent align="start" className="max-h-[min(60vh,420px)] w-[min(380px,calc(100vw-32px))] overflow-y-auto">
                {groups.map((g, gi) => (
                  <div key={g.key}>
                    {gi > 0 ? <MenuSeparator /> : null}
                    <MenuLabel>{g.label}</MenuLabel>
                    {g.items.map((ci) => (
                      <MenuItem key={ci.id} onSelect={() => add(itemFromCatalog(ci))}>
                        <span className="min-w-0 flex-1 truncate">{ci.name}</span>
                        <span className="shrink-0 text-[13px] text-mute tabular-nums">{brl(ci.price)}</span>
                      </MenuItem>
                    ))}
                  </div>
                ))}
              </MenuContent>
            </Menu>
          ) : null}
          {items.length ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => openCustom("item")}>
                <PencilLine /> Item avulso
              </Button>
              <Button variant="secondary" size="sm" onClick={() => openCustom("pacote")}>
                <PackagePlus /> Pacote personalizado
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => add(blankItem(), true)}>
            <Plus /> Item em branco
          </Button>
        </div>
      ) : null}

      {!disabled ? (
        <CustomItemDialog
          open={custom.open}
          mode={custom.mode}
          onOpenChange={(open) => setCustom((c) => ({ ...c, open }))}
          groups={groups}
          onAdd={(item, message) => {
            add(item);
            setCustom((c) => ({ ...c, open: false }));
            toast.success(message);
          }}
        />
      ) : null}
    </div>
  );
}

const CUSTOM_CHIP =
  "inline-flex min-h-10 items-center gap-2 rounded-full border border-white/35 bg-white/[0.05] px-3.5 py-2 text-left text-[13px] text-white transition-colors hover:border-white/60 hover:bg-white/[0.09]";

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
        "grid size-10 place-items-center rounded-full text-mute transition-colors disabled:pointer-events-none disabled:opacity-30 @min-[860px]:size-7 [&_svg]:size-4 @min-[860px]:[&_svg]:size-3.5",
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-white/[0.06] hover:text-light",
      )}
    >
      {children}
    </button>
  );
}
