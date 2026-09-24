"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, PackagePlus, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { FormModal, fieldError } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { Card, CardHeader } from "@/components/ui/surface";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  addChecklistItem,
  addKitToChecklist,
  removeChecklistItem,
  setAllChecklistItems,
  toggleChecklistItem,
  updateChecklistInfo,
} from "./actions";

type Item = { name: string; qty: number; out: boolean; back: boolean };
type Kit = { id: string; name: string; items: { name: string; qty: number }[] };

type Op =
  | { kind: "toggle"; index: number; field: "out" | "back"; value: boolean }
  | { kind: "add"; items: Item[] }
  | { kind: "remove"; index: number }
  | { kind: "all"; mode: "out" | "back" | "reset" };

function reduce(items: Item[], op: Op): Item[] {
  switch (op.kind) {
    case "toggle":
      return items.map((it, i) => {
        if (i !== op.index) return it;
        if (op.field === "out") return { ...it, out: op.value, back: op.value ? it.back : false };
        return { ...it, back: op.value, out: op.value ? true : it.out };
      });
    case "add":
      return [...items, ...op.items];
    case "remove":
      return items.filter((_, i) => i !== op.index);
    case "all":
      return items.map((it) =>
        op.mode === "reset" ? { ...it, out: false, back: false } : op.mode === "out" ? { ...it, out: true } : { ...it, out: true, back: true },
      );
  }
}

export function ChecklistEditor({
  checklistId,
  projectId,
  items,
  date,
  today,
  kits,
}: {
  checklistId: string;
  projectId: string;
  items: Item[];
  date: string | null;
  today: string;
  kits: Kit[];
}) {
  const [shown, apply] = useOptimistic(items, reduce);
  const [, startTransition] = useTransition();
  const [kitId, setKitId] = useState(kits[0]?.id ?? "");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const nameRef = useRef<HTMLInputElement>(null);

  function run(op: Op, action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>, fields: Record<string, string>, success?: boolean) {
    const fd = new FormData();
    fd.set("id", checklistId);
    fd.set("projectId", projectId);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      apply(op);
      const res = await action(null, fd);
      if (!res.ok) toast.error(res.error);
      else if (success && res.message) toast.success(res.message);
    });
  }

  const toggle = (i: number, field: "out" | "back") => {
    const value = !shown[i][field];
    run({ kind: "toggle", index: i, field, value }, toggleChecklistItem, {
      index: String(i),
      name: shown[i].name,
      field,
      value: value ? "1" : "0",
    });
  };

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const q = Math.max(1, Math.min(999, Math.round(Number(qty) || 1)));
    if (!n) {
      toast.error("Digite o nome do item.");
      nameRef.current?.focus();
      return;
    }
    run({ kind: "add", items: [{ name: n, qty: q, out: false, back: false }] }, addChecklistItem, { itemName: n, qty: String(q) });
    setName("");
    setQty("1");
    nameRef.current?.focus();
  }

  function addKit() {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    run(
      { kind: "add", items: kit.items.map((it) => ({ name: it.name, qty: Math.max(1, Math.round(it.qty || 1)), out: false, back: false })) },
      addKitToChecklist,
      { kitId: kit.id },
      true,
    );
  }

  const total = shown.length;
  const out = shown.filter((i) => i.out).length;
  const back = shown.filter((i) => i.back).length;
  const away = shown.filter((i) => i.out && !i.back);
  const late = away.length > 0 && !!date && date < today;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className={cn("p-5 sm:p-6", late && "border-warn/30")}>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <p className="text-[13px] text-ash">Conferência</p>
            <p className="mt-3 text-[32px] leading-none font-semibold tracking-[-0.03em] text-white sm:text-[40px]">
              {total ? (
                <>
                  {out} <span className="text-mute">de {total}</span> saíram
                </>
              ) : (
                "Lista vazia"
              )}
            </p>
            <p className="mt-2 text-[14px] text-ash">
              {total ? `${back} ${back === 1 ? "voltou" : "voltaram"} · ${total - out} ainda na base` : "Adicione um kit ou os itens um a um."}
            </p>
          </div>
          {total ? (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" size="md">
                  Marcar todos <ChevronDown className="-mr-1" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => run({ kind: "all", mode: "out" }, setAllChecklistItems, { mode: "out" }, true)}>
                  <Check /> Tudo saiu
                </MenuItem>
                <MenuItem onSelect={() => run({ kind: "all", mode: "back" }, setAllChecklistItems, { mode: "back" }, true)}>
                  <Check /> Tudo voltou
                </MenuItem>
                <MenuSeparator />
                <MenuItem onSelect={() => run({ kind: "all", mode: "reset" }, setAllChecklistItems, { mode: "reset" }, true)}>
                  <RotateCcw /> Zerar a conferência
                </MenuItem>
              </MenuContent>
            </Menu>
          ) : null}
        </div>

        {total ? (
          <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={`${back} voltaram, ${out - back} fora, ${total - out} na base`}>
            <span className="h-full bg-white transition-[width] duration-500 ease-out-expo" style={{ width: `${(back / total) * 100}%` }} />
            <span className="h-full bg-white/35 transition-[width] duration-500 ease-out-expo" style={{ width: `${((out - back) / total) * 100}%` }} />
          </div>
        ) : null}
        {total ? (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-mute" aria-hidden>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-white" /> Voltou
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-white/35" /> Saiu, não voltou
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-white/[0.12]" /> Na base
            </li>
          </ul>
        ) : null}

        {away.length ? (
          <div className={cn("mt-5 rounded-2xl border px-4 py-3", late ? "border-warn/35 bg-warn/[0.06]" : "border-line bg-white/[0.02]")}>
            <p className={cn("flex items-center gap-2 text-[13px] font-medium", late ? "text-warn" : "text-ash")}>
              {late ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : null}
              {late ? `Saíram e não voltaram (${away.length})` : `Fora da base agora (${away.length})`}
            </p>
            <p className="mt-1 text-[13px] text-ash">{away.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)).join(", ")}</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Itens" description={total ? `${total} ${total === 1 ? "item" : "itens"} na lista` : "Monte a lista com um kit pronto ou item por item."} />
        <div className="grid gap-3 px-5 pt-4 sm:px-6 lg:grid-cols-2">
          <div className="flex gap-2">
            <label htmlFor="ck-kit" className="sr-only">
              Kit de equipamento
            </label>
            <div className="min-w-0 flex-1">
              <Select id="ck-kit" value={kitId} onChange={(e) => setKitId(e.target.value)} disabled={!kits.length}>
                {kits.length ? (
                  kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} · {k.items.length} {k.items.length === 1 ? "item" : "itens"}
                    </option>
                  ))
                ) : (
                  <option value="">Nenhum kit cadastrado</option>
                )}
              </Select>
            </div>
            <Button variant="secondary" className="h-11" onClick={addKit} disabled={!kitId}>
              <PackagePlus /> Adicionar kit
            </Button>
          </div>
          <form onSubmit={addItem} className="flex gap-2">
            <label htmlFor="ck-name" className="sr-only">
              Nome do item
            </label>
            <Input ref={nameRef} id="ck-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item avulso, ex.: Rebatedor" className="min-w-0 flex-1" />
            <label htmlFor="ck-qty" className="sr-only">
              Quantidade
            </label>
            <Input
              id="ck-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-[72px] shrink-0 text-center tabular-nums"
            />
            <Button type="submit" variant="secondary" className="h-11" aria-label="Adicionar item">
              <Plus /> <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </form>
        </div>

        {total ? (
          <ul className="mt-4 grid grid-cols-1 border-t border-line">
            {shown.map((it, i) => (
              <li
                key={`${i}-${it.name}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-line px-5 py-3.5 last:border-b-0 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_auto]",
                  it.back && "bg-white/[0.015]",
                )}
              >
                <div className="flex min-w-0 items-baseline gap-2.5">
                  <span className={cn("truncate text-[16px]", it.back ? "text-ash" : "text-light")}>{it.name}</span>
                  <span className="shrink-0 font-mono text-[12px] text-mute tabular-nums">×{it.qty}</span>
                </div>
                <div className="col-span-2 row-start-2 grid grid-cols-2 gap-2 md:col-span-1 md:row-start-auto md:flex">
                  <Toggle on={it.out} onClick={() => toggle(i, "out")} label="Saiu" item={it.name} />
                  <Toggle on={it.back} onClick={() => toggle(i, "back")} label="Voltou" item={it.name} tone="ok" />
                </div>
                <button
                  type="button"
                  onClick={() => run({ kind: "remove", index: i }, removeChecklistItem, { index: String(i), name: it.name })}
                  className="col-start-2 row-start-1 grid size-10 place-items-center justify-self-end rounded-full text-mute transition-colors hover:bg-danger/10 hover:text-danger md:col-start-auto md:row-start-auto"
                  aria-label={`Remover ${it.name}`}
                  title="Remover da lista"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mx-5 my-5 rounded-2xl border border-dashed border-line-strong px-4 py-5 text-[14px] text-mute sm:mx-6">
            Nenhum item ainda. Escolha um kit (Câmera A, Áudio, Luz, Drone) ou adicione um item avulso.
          </p>
        )}
        {total ? <div className="h-2" /> : null}
      </Card>
    </div>
  );
}

function Toggle({ on, onClick, label, item, tone = "light" }: { on: boolean; onClick: () => void; label: string; item: string; tone?: "light" | "ok" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${item}`}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 min-w-[112px] items-center justify-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-[background-color,border-color,color,transform] duration-200 select-none active:scale-[0.97] md:h-10",
        on
          ? tone === "ok"
            ? "border-ok/45 bg-ok/[0.12] text-ok"
            : "border-white bg-white text-void"
          : "border-line-strong bg-white/[0.02] text-ash hover:border-white/30 hover:text-light",
      )}
    >
      <span
        className={cn(
          "grid size-5 place-items-center rounded-full border transition-colors",
          on ? (tone === "ok" ? "border-ok bg-ok text-void" : "border-void bg-void text-white") : "border-current opacity-60",
        )}
        aria-hidden
      >
        {on ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}

/** Editar título e data do checklist. */
export function EditChecklistButton({
  checklistId,
  projectId,
  title,
  date,
}: {
  checklistId: string;
  projectId: string;
  title: string;
  date: string | null;
}) {
  return (
    <FormModal
      title="Editar checklist"
      action={updateChecklistInfo}
      size="sm"
      trigger={
        <Button variant="secondary" size="sm">
          <Pencil /> Editar
        </Button>
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={checklistId} />
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Título" htmlFor="ck-title" error={fieldError(state, "title")}>
            <Input id="ck-title" name="title" defaultValue={title} autoFocus />
          </Field>
          <Field label="Data" htmlFor="ck-date" error={fieldError(state, "date")} hint="O dia em que o equipamento sai.">
            <Input id="ck-date" name="date" type="date" defaultValue={date ?? ""} />
          </Field>
        </>
      )}
    </FormModal>
  );
}
