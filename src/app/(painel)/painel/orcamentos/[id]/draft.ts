/**
 * Itens do orçamento enquanto são editados: textos como o usuário digitou,
 * convertidos em números só na conta e na hora de salvar.
 */
import { CATALOG_GROUPS } from "@/lib/domain";
import { centsToInput, parseBRL } from "@/lib/format";
import type { CatalogOption } from "@/lib/queries/quotes";
import { quantityLabel } from "@/lib/services/quotes";

/** Linha do editor: textos como o usuário digitou (a conta usa os números lidos). */
export type DraftItem = {
  key: string;
  catalogItemId: string | null;
  description: string;
  detail: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  unitCost: string;
};

export function toDraft(it: {
  id: string;
  catalogItemId: string | null;
  description: string;
  detail: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  unitCost: number;
}): DraftItem {
  return {
    key: it.id,
    catalogItemId: it.catalogItemId,
    description: it.description,
    detail: it.detail ?? "",
    quantity: quantityLabel(it.quantity),
    unit: it.unit ?? "",
    unitPrice: centsToInput(it.unitPrice),
    unitCost: it.unitCost ? centsToInput(it.unitCost) : "",
  };
}

/** "1", "1,5" ou "1.5" → número. */
export function parseQuantity(text: string) {
  const raw = text.trim();
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(n) ? n : 0;
}

export function draftNumbers(d: DraftItem) {
  return { quantity: parseQuantity(d.quantity), unitPrice: parseBRL(d.unitPrice) ?? 0, unitCost: parseBRL(d.unitCost) ?? 0 };
}

function isBlank(d: DraftItem) {
  return !d.description.trim() && !d.detail.trim() && !parseBRL(d.unitPrice) && !parseBRL(d.unitCost);
}

/** Itens prontos para o servidor (linhas totalmente vazias ficam de fora). */
export function serializeItems(items: DraftItem[]) {
  return items
    .filter((d) => !isBlank(d))
    .map((d) => {
      const n = draftNumbers(d);
      return {
        catalogItemId: d.catalogItemId,
        description: d.description,
        detail: d.detail || null,
        quantity: n.quantity,
        unit: d.unit || null,
        unitPrice: n.unitPrice,
        unitCost: n.unitCost,
      };
    });
}

export function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random()}`;
}

export function blankItem(): DraftItem {
  return { key: newKey(), catalogItemId: null, description: "", detail: "", quantity: "1", unit: "unidade", unitPrice: "", unitCost: "" };
}

export function itemFromCatalog(ci: CatalogOption): DraftItem {
  return {
    key: newKey(),
    catalogItemId: ci.id,
    description: ci.name,
    detail: ci.description ?? "",
    quantity: "1",
    unit: ci.unit,
    unitPrice: centsToInput(ci.price),
    unitCost: ci.cost ? centsToInput(ci.cost) : "",
  };
}

export type CatalogGroup = { key: string; label: string; items: CatalogOption[] };

export function groupCatalog(catalog: CatalogOption[]) {
  const known = new Set<string>(CATALOG_GROUPS.map((g) => g.key));
  const groups: CatalogGroup[] = CATALOG_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: catalog.filter((c) => c.group === g.key),
  }));
  groups.push({ key: "outros", label: "Outros", items: catalog.filter((c) => !known.has(c.group)) });
  return groups.filter((g) => g.items.length);
}
