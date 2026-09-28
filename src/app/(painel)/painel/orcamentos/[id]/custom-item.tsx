"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, MoneyInput, Select } from "@/components/ui/field";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Modal,
  ModalClose,
  ModalContent,
} from "@/components/ui/overlay";
import { CATALOG_GROUPS, CATALOG_UNITS, optionLabel } from "@/lib/domain";
import { brl, centsToInput, parseBRL } from "@/lib/format";
import type { CatalogOption } from "@/lib/queries/quotes";
import { MARGIN_MIN, lineCost, lineTotal, percentLabel, quantityLabel, unitWithQuantity } from "@/lib/services/quotes";
import { cn } from "@/lib/utils";
import { saveCustomToCatalog } from "../actions";
import { newKey, parseQuantity, type CatalogGroup, type DraftItem } from "./draft";

export type CustomMode = "item" | "pacote";

const MODES: [CustomMode, string][] = [
  ["item", "Item avulso"],
  ["pacote", "Pacote personalizado"],
];

/** Uma parte do pacote: entra no detalhe que o cliente vê, com valor e custo só para a conta. */
type Part = { key: string; description: string; quantity: string; unitPrice: string; unitCost: string };

function blankPart(): Part {
  return { key: newKey(), description: "", quantity: "1", unitPrice: "", unitCost: "" };
}

function partFromCatalog(ci: CatalogOption): Part {
  return {
    key: newKey(),
    description: ci.name,
    quantity: "1",
    unitPrice: centsToInput(ci.price),
    unitCost: ci.cost ? centsToInput(ci.cost) : "",
  };
}

function partNumbers(p: Part) {
  return { quantity: parseQuantity(p.quantity), unitPrice: parseBRL(p.unitPrice) ?? 0, unitCost: parseBRL(p.unitCost) ?? 0 };
}

/** "2× Diária de captação" (quantidade 1 não aparece). */
function partText(p: Part) {
  const q = parseQuantity(p.quantity);
  const text = p.description.trim();
  return q > 0 && q !== 1 ? `${quantityLabel(q)}× ${text}` : text;
}

/** Valor digitado → "1.234,56" (ou vazio). */
function tidyMoney(value: string) {
  const cents = parseBRL(value);
  return cents == null ? "" : centsToInput(cents);
}

type Errors = Partial<Record<"title" | "quantity" | "parts" | "catalog", string>>;

/**
 * Item criado na hora, para orçamento que não cabe num pacote pronto:
 * um item avulso ou um pacote montado por partes. Pode ir também para o catálogo.
 */
export function CustomItemDialog({
  open,
  mode,
  onOpenChange,
  groups,
  onAdd,
}: {
  open: boolean;
  mode: CustomMode;
  onOpenChange: (open: boolean) => void;
  groups: CatalogGroup[];
  onAdd: (item: DraftItem, message: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Criar sob medida" size="lg">
        <CustomItemForm initialMode={mode} groups={groups} onAdd={onAdd} />
      </ModalContent>
    </Modal>
  );
}

function CustomItemForm({
  initialMode,
  groups,
  onAdd,
}: {
  initialMode: CustomMode;
  groups: CatalogGroup[];
  onAdd: (item: DraftItem, message: string) => void;
}) {
  const [mode, setMode] = useState<CustomMode>(initialMode);
  const [title, setTitle] = useState("");
  // Item avulso
  const [detail, setDetail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("unidade");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  // Pacote
  const [parts, setParts] = useState<Part[]>(() => [blankPart()]);
  const [packPrice, setPackPrice] = useState("");
  const [packCost, setPackCost] = useState("");
  // Catálogo
  const [toCatalog, setToCatalog] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, startSaving] = useTransition();

  const isPack = mode === "pacote";
  const catalogGroup = group ?? (isPack ? "pacote" : "extra");

  const q = parseQuantity(quantity);
  const named = parts.filter((p) => p.description.trim());
  const partsTotal = named.reduce((s, p) => s + lineTotal(partNumbers(p)), 0);
  const partsCost = named.reduce((s, p) => s + lineCost(partNumbers(p)), 0);
  const packDetail = named.map(partText).join(" · ");

  const price = isPack ? (parseBRL(packPrice) ?? partsTotal) : lineTotal({ quantity: q, unitPrice: parseBRL(unitPrice) ?? 0 });
  const cost = isPack
    ? (parseBRL(packCost) ?? partsCost)
    : lineCost({ quantity: q, unitPrice: 0, unitCost: parseBRL(unitCost) ?? 0 });
  const unitLabel = optionLabel(CATALOG_UNITS, isPack ? "pacote" : unit);
  const shownQty = isPack ? 1 : q;
  const shownDetail = isPack ? packDetail : detail.trim();

  const updatePart = (key: string, patch: Partial<Part>) => setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const removePart = (key: string) => setParts((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : [blankPart()]));
  const addPart = (part: Part) =>
    setParts((ps) => {
      // Troca a primeira linha se ela ainda estiver vazia.
      const first = ps[0];
      const empty = ps.length === 1 && !first.description.trim() && !parseBRL(first.unitPrice) && !parseBRL(first.unitCost);
      return empty ? [part] : [...ps, part];
    });

  function build(): { item: Omit<DraftItem, "key"> | null; errors: Errors } {
    const next: Errors = {};
    const name = title.trim();
    if (!name) next.title = isPack ? "Dê um nome ao pacote." : "Escreva a descrição.";

    let item: Omit<DraftItem, "key">;
    if (isPack) {
      const valueWithoutName = parts.some((p) => !p.description.trim() && (parseBRL(p.unitPrice) || parseBRL(p.unitCost)));
      if (!named.length) next.parts = "Coloque pelo menos uma parte.";
      else if (valueWithoutName) next.parts = "Tem parte com valor e sem nome: dê um nome ou apague.";
      else if (named.some((p) => !(parseQuantity(p.quantity) > 0))) next.parts = "Confira as quantidades: precisam ser maiores que zero.";
      else if (packDetail.length > 500) next.parts = "As partes passam de 500 caracteres no detalhe. Encurte os nomes.";
      item = {
        catalogItemId: null,
        description: name,
        detail: packDetail,
        quantity: "1",
        unit: "pacote",
        unitPrice: price ? centsToInput(price) : "",
        unitCost: cost ? centsToInput(cost) : "",
      };
    } else {
      if (!(q > 0)) next.quantity = "A quantidade precisa ser maior que zero.";
      item = {
        catalogItemId: null,
        description: name,
        detail: detail.trim(),
        quantity: q > 0 ? quantityLabel(q) : quantity,
        unit,
        unitPrice: tidyMoney(unitPrice),
        unitCost: tidyMoney(unitCost),
      };
    }

    if (toCatalog && !next.title) {
      if (name.length < 2) next.catalog = "Pra salvar no catálogo, o nome precisa de pelo menos 2 letras.";
      else if (name.length > 100) next.catalog = `Pra salvar no catálogo, o nome precisa ter até 100 caracteres (está com ${name.length}).`;
      else if (item.detail.length > 300)
        next.catalog = `Pra salvar no catálogo, o detalhe precisa ter até 300 caracteres (está com ${item.detail.length}).`;
    }
    return { item: Object.keys(next).length ? null : item, errors: next };
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    // A janela fica dentro do formulário do orçamento na árvore do React: o envio não pode subir até ele.
    e.preventDefault();
    e.stopPropagation();
    const { item, errors: found } = build();
    setErrors(found);
    if (!item) return;
    if (!toCatalog) {
      onAdd({ ...item, key: newKey() }, "Item adicionado.");
      return;
    }
    startSaving(async () => {
      const fd = new FormData();
      fd.set("name", item.description);
      fd.set("description", item.detail);
      fd.set("group", catalogGroup);
      fd.set("unit", item.unit);
      fd.set("price", item.unitPrice);
      fd.set("cost", item.unitCost);
      let result: Awaited<ReturnType<typeof saveCustomToCatalog>> | null = null;
      try {
        result = await saveCustomToCatalog(null, fd);
      } catch {
        result = null;
      }
      if (!result?.ok) {
        setErrors({ catalog: result && !result.ok ? result.error : "Não consegui salvar no catálogo agora. Tente de novo ou desmarque a opção." });
        return;
      }
      onAdd({ ...item, key: newKey(), catalogItemId: result.id ?? null }, "Item adicionado e salvo no catálogo.");
    });
  }

  const margin = price - cost;
  const marginPct = price > 0 ? margin / price : null;
  const marginTone = cost === 0 || marginPct == null ? "text-ash" : margin < 0 ? "text-danger" : marginPct < MARGIN_MIN ? "text-warn" : "text-ok";
  const priceTyped = parseBRL(packPrice);
  const vsSum =
    isPack && priceTyped != null && partsTotal > 0 && priceTyped !== partsTotal
      ? priceTyped < partsTotal
        ? ` · ${Math.round(((partsTotal - priceTyped) / partsTotal) * 100)}% abaixo`
        : ` · ${Math.round(((priceTyped - partsTotal) / partsTotal) * 100)}% acima`
      : "";

  return (
    <form onSubmit={submit} onChange={(e) => e.stopPropagation()} noValidate className="grid gap-5">
      <div className="grid h-11 grid-cols-2 gap-1 rounded-full border border-line bg-white/[0.02] p-1" role="radiogroup" aria-label="O que criar">
        {MODES.map(([key, label]) => {
          const on = mode === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setMode(key);
                setErrors({});
              }}
              className={cn("rounded-full text-[13px] transition-colors", on ? "bg-white text-void" : "text-ash hover:text-light")}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Field label={isPack ? "Nome do pacote (o cliente vê)" : "Descrição (o cliente vê)"} htmlFor="av-title" error={errors.title}>
        <Input
          id="av-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isPack ? "Ex.: Pacote verão, 3 filmes" : "Ex.: Filme institucional de 60s"}
          maxLength={200}
          aria-invalid={errors.title ? true : undefined}
        />
      </Field>

      {isPack ? (
        <>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-[13px] font-medium text-ash">O que entra</legend>
            <div
              aria-hidden
              className="hidden gap-2 px-1 text-[12px] text-mute sm:grid sm:grid-cols-[minmax(0,1fr)_64px_124px_124px_40px]"
            >
              <span>Parte</span>
              <span>Qtd</span>
              <span>Valor unit.</span>
              <span>Custo unit.</span>
              <span />
            </div>
            <ol className="grid gap-3 sm:gap-2">
              {parts.map((p, i) => {
                const n = i + 1;
                return (
                  <li
                    key={p.key}
                    className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_64px_124px_124px_40px] sm:items-center sm:rounded-none sm:border-0 sm:p-0"
                  >
                    <div className="col-span-3 flex items-center gap-1 sm:col-span-1">
                      <Input
                        aria-label={`Parte ${n}`}
                        value={p.description}
                        onChange={(e) => updatePart(p.key, { description: e.target.value })}
                        placeholder={n === 1 ? "Ex.: Diária de captação" : "Parte do pacote"}
                        maxLength={160}
                        className="h-10 px-3 text-[14px]"
                      />
                      <RemovePart n={n} onClick={() => removePart(p.key)} className="sm:hidden" />
                    </div>
                    <label className="grid gap-1">
                      <span className="text-[12px] text-mute sm:sr-only">Qtd</span>
                      <Input
                        aria-label={`Quantidade da parte ${n}`}
                        inputMode="decimal"
                        value={p.quantity}
                        onChange={(e) => updatePart(p.key, { quantity: e.target.value })}
                        onBlur={(e) => {
                          const v = parseQuantity(e.target.value);
                          if (v > 0) updatePart(p.key, { quantity: quantityLabel(v) });
                        }}
                        className="h-10 px-3 text-[14px] tabular-nums"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[12px] text-mute sm:sr-only">Valor unit.</span>
                      <MoneyInput
                        aria-label={`Valor unitário da parte ${n}`}
                        value={p.unitPrice}
                        onChange={(e) => updatePart(p.key, { unitPrice: e.target.value })}
                        onBlur={(e) => updatePart(p.key, { unitPrice: tidyMoney(e.target.value) })}
                        placeholder="0,00"
                        className="h-10 pr-3 pl-9 text-[14px]"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[12px] text-mute sm:sr-only">Custo unit.</span>
                      <MoneyInput
                        aria-label={`Custo unitário da parte ${n}`}
                        value={p.unitCost}
                        onChange={(e) => updatePart(p.key, { unitCost: e.target.value })}
                        onBlur={(e) => updatePart(p.key, { unitCost: tidyMoney(e.target.value) })}
                        placeholder="0,00"
                        className="h-10 border-dashed pr-3 pl-9 text-[14px]"
                      />
                    </label>
                    <RemovePart n={n} onClick={() => removePart(p.key)} className="hidden sm:grid" />
                  </li>
                );
              })}
            </ol>
            {errors.parts ? (
              <p className="text-[13px] text-danger" role="alert">
                {errors.parts}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {groups.length ? (
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Plus /> Parte do catálogo <ChevronDown className="text-mute" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="start" className="max-h-[min(50vh,380px)] w-[min(360px,calc(100vw-32px))] overflow-y-auto">
                    {groups.map((g, gi) => (
                      <div key={g.key}>
                        {gi > 0 ? <MenuSeparator /> : null}
                        <MenuLabel>{g.label}</MenuLabel>
                        {g.items.map((ci) => (
                          <MenuItem key={ci.id} onSelect={() => addPart(partFromCatalog(ci))}>
                            <span className="min-w-0 flex-1 truncate">{ci.name}</span>
                            <span className="shrink-0 text-[13px] text-mute tabular-nums">{brl(ci.price)}</span>
                          </MenuItem>
                        ))}
                      </div>
                    ))}
                  </MenuContent>
                </Menu>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => addPart(blankPart())}>
                <Plus /> Parte livre
              </Button>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor do pacote" htmlFor="av-pack-price" hint={`Soma das partes: ${brl(partsTotal)}${vsSum}`}>
              <MoneyInput
                id="av-pack-price"
                value={packPrice}
                onChange={(e) => setPackPrice(e.target.value)}
                onBlur={(e) => setPackPrice(tidyMoney(e.target.value))}
                placeholder={partsTotal ? centsToInput(partsTotal) : "0,00"}
              />
            </Field>
            <Field label="Custo do pacote (interno)" htmlFor="av-pack-cost" hint={`Soma dos custos: ${brl(partsCost)}`}>
              <MoneyInput
                id="av-pack-cost"
                value={packCost}
                onChange={(e) => setPackCost(e.target.value)}
                onBlur={(e) => setPackCost(tidyMoney(e.target.value))}
                placeholder={partsCost ? centsToInput(partsCost) : "0,00"}
                className="border-dashed"
              />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field label="O que está incluso (opcional)" htmlFor="av-detail">
            <Input
              id="av-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Ex.: roteiro, 1 diária, edição e cor"
              maxLength={500}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Quantidade" htmlFor="av-qty" error={errors.quantity}>
              <Input
                id="av-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={(e) => {
                  const v = parseQuantity(e.target.value);
                  if (v > 0) setQuantity(quantityLabel(v));
                }}
                aria-invalid={errors.quantity ? true : undefined}
                className="tabular-nums"
              />
            </Field>
            <Field label="Unidade" htmlFor="av-unit">
              <Select id="av-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {CATALOG_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor unitário" htmlFor="av-price">
              <MoneyInput
                id="av-price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                onBlur={(e) => setUnitPrice(tidyMoney(e.target.value))}
                placeholder="0,00"
              />
            </Field>
            <Field label="Custo unitário (interno)" htmlFor="av-cost">
              <MoneyInput
                id="av-cost"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                onBlur={(e) => setUnitCost(tidyMoney(e.target.value))}
                placeholder="0,00"
                className="border-dashed"
              />
            </Field>
          </div>
        </>
      )}

      <div className="grid gap-3 rounded-2xl border border-line bg-white/[0.02] p-4" aria-live="polite">
        <p className="label text-mute">No orçamento</p>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn("text-[15px] break-words", title.trim() ? "text-white" : "text-mute")}>
              {title.trim() || (isPack ? "Nome do pacote" : "Descrição")}
            </p>
            {shownDetail ? <p className="mt-1 text-[13px] break-words text-ash">{shownDetail}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] text-white tabular-nums">{brl(price)}</p>
            <p className="mt-1 text-[12px] text-mute tabular-nums">
              {shownQty > 0 ? `${quantityLabel(shownQty)} ${unitWithQuantity(unitLabel, shownQty)}` : "—"}
            </p>
          </div>
        </div>
        <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[13px] text-mute">
          <span>
            Custo interno <span className="text-ash tabular-nums">{brl(cost)}</span>
          </span>
          <span>
            Margem{" "}
            <span className={cn("tabular-nums", marginTone)}>{cost === 0 ? "sem custo lançado" : percentLabel(marginPct)}</span>
          </span>
        </p>
      </div>

      <div className="grid gap-3">
        <Checkbox label="Salvar também no catálogo, pra usar de novo" checked={toCatalog} onChange={(e) => setToCatalog(e.target.checked)} />
        {toCatalog ? (
          <Field label="Grupo no catálogo" htmlFor="av-group" className="sm:max-w-xs">
            <Select id="av-group" value={catalogGroup} onChange={(e) => setGroup(e.target.value)}>
              {CATALOG_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {errors.catalog ? (
          <p className="text-[13px] text-danger" role="alert">
            {errors.catalog}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <ModalClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </ModalClose>
        <Button type="submit" variant="primary" disabled={saving}>
          <Plus /> {saving ? "Salvando…" : "Adicionar ao orçamento"}
        </Button>
      </div>
    </form>
  );
}

function RemovePart({ n, onClick, className }: { n: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remover parte ${n}`}
      title={`Remover parte ${n}`}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-danger/10 hover:text-danger [&_svg]:size-4",
        className,
      )}
    >
      <Trash2 />
    </button>
  );
}
