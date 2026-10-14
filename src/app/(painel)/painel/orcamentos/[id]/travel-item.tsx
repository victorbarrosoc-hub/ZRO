"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownUp, Loader2, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { Modal, ModalContent } from "@/components/ui/overlay";
import { brl, centsToInput, dateShort, parseBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { newKey, type DraftItem } from "./draft";
import { findPlaces, measureRoute, natalGasPrice } from "./travel-actions";

type Place = { label: string; detail: string; lat: number; lon: number };
type Gas = Awaited<ReturnType<typeof natalGasPrice>>;

const NATAL: Place = { label: "Natal", detail: "RN", lat: -5.7945, lon: -35.211 };
const KM_L_KEY = "zro:deslocamento:km-l";

const num = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number, digits = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);

/** Cálculo de deslocamento de carro: km do trajeto, gasolina de Natal (ANP) e consumo do carro. */
export function TravelDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: DraftItem, message: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Deslocamento" size="lg">
        <TravelForm onAdd={onAdd} />
      </ModalContent>
    </Modal>
  );
}

function TravelForm({ onAdd }: { onAdd: (item: DraftItem, message: string) => void }) {
  const [from, setFrom] = useState<Place | null>(NATAL);
  const [to, setTo] = useState<Place | null>(null);
  const [roundTrip, setRoundTrip] = useState(true);
  const [trips, setTrips] = useState("1");
  const [km, setKm] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [measuring, startMeasuring] = useTransition();
  const [kmL, setKmL] = useState(() => {
    try {
      return localStorage.getItem(KM_L_KEY) ?? "10";
    } catch {
      return "10";
    }
  });
  const [gas, setGas] = useState<Gas>(null);
  const [gasLoading, setGasLoading] = useState(true);
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Preço da ANP ao abrir.
  useEffect(() => {
    let alive = true;
    natalGasPrice()
      .then((g) => {
        if (!alive) return;
        setGas(g);
        if (g) setPrice((p) => p || centsToInput(Math.round(g.price * 100)));
      })
      .catch(() => {})
      .finally(() => alive && setGasLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Km sozinho quando origem e destino estão escolhidos.
  useEffect(() => {
    if (!from || !to) return;
    startMeasuring(async () => {
      setRouteError(null);
      const r = await measureRoute({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }).catch(() => null);
      if (r?.ok) {
        setKm(fmt(r.km));
        setMinutes(r.minutes);
      } else {
        setMinutes(null);
        setRouteError(r && !r.ok ? r.error : "O cálculo da rota não respondeu. Digite os km.");
      }
    });
  }, [from, to]);

  const kmLeg = num(km);
  const tripsN = Math.max(1, Math.round(num(trips)) || 1);
  const kmTotal = kmLeg * (roundTrip ? 2 : 1) * tripsN;
  const kmPerL = num(kmL);
  const liters = kmPerL > 0 ? kmTotal / kmPerL : 0;
  const priceCents = parseBRL(price) ?? 0;
  const cost = Math.round(liters * priceCents);

  function rememberKmL(value: string) {
    try {
      if (num(value) > 0) localStorage.setItem(KM_L_KEY, value);
    } catch {}
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    // A janela fica dentro do formulário do orçamento: o envio não pode subir até ele.
    e.preventDefault();
    e.stopPropagation();
    if (!(kmLeg > 0)) return setError("Escolha origem e destino, ou digite os km do trajeto.");
    if (!(kmPerL > 0)) return setError("Diga quantos km o carro faz com 1 litro.");
    if (!(priceCents > 0)) return setError("Coloque o preço do litro da gasolina.");
    const route = [from?.label, to?.label].filter(Boolean).join(" → ") || `${fmt(kmLeg)} km`;
    const detail = [
      `${fmt(kmTotal, 0)} km`,
      roundTrip ? "ida e volta" : "só ida",
      tripsN > 1 ? `${tripsN} viagens` : null,
      `${fmt(liters)} L de gasolina a ${brl(priceCents)}/L`,
    ]
      .filter(Boolean)
      .join(" · ");
    onAdd(
      {
        key: newKey(),
        catalogItemId: null,
        description: `Deslocamento ${route}`,
        detail,
        quantity: "1",
        unit: "trecho",
        unitPrice: centsToInput(cost),
        unitCost: centsToInput(cost),
      },
      "Deslocamento adicionado.",
    );
  }

  return (
    <form onSubmit={submit} onChange={(e) => e.stopPropagation()} noValidate className="grid gap-5">
      <div className="grid gap-2">
        <PlaceField label="Saída" value={from} onChange={setFrom} placeholder="Cidade ou endereço de saída" />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="grid size-9 place-items-center rounded-full border border-line-strong text-mute transition-colors hover:border-white/40 hover:text-light"
            aria-label="Trocar saída e chegada"
            title="Trocar saída e chegada"
          >
            <ArrowDownUp className="size-4" aria-hidden />
          </button>
        </div>
        <PlaceField label="Chegada" value={to} onChange={setTo} placeholder="Ex.: João Pessoa, Pipa, um endereço" autoFocus />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Km do trajeto (só ida)"
          htmlFor="tv-km"
          hint={measuring ? "Calculando a rota…" : minutes ? `≈ ${duration(minutes)} de carro` : routeError ? undefined : "Calculado pela rota. Dá para mudar."}
          error={routeError ?? undefined}
        >
          <div className="relative">
            <Input
              id="tv-km"
              inputMode="decimal"
              value={km}
              onChange={(e) => {
                setKm(e.target.value);
                setMinutes(null);
              }}
              placeholder="0"
              className="pr-12 tabular-nums"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-mute">
              {measuring ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "km"}
            </span>
          </div>
        </Field>
        <Field label="Trajeto" htmlFor="tv-round">
          <div id="tv-round" className="grid h-11 grid-cols-2 gap-1 rounded-full border border-line bg-white/[0.02] p-1" role="radiogroup" aria-label="Trajeto">
            {[
              [false, "Só ida"],
              [true, "Ida e volta"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={roundTrip === value}
                onClick={() => setRoundTrip(value as boolean)}
                className={cn("rounded-full text-[13px] transition-colors", roundTrip === value ? "bg-white text-void" : "text-ash hover:text-light")}
              >
                {label as string}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Viagens" htmlFor="tv-trips" hint="Ex.: 3 diárias indo e voltando = 3">
          <Input id="tv-trips" inputMode="numeric" value={trips} onChange={(e) => setTrips(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Consumo do carro" htmlFor="tv-kml" hint="Quantos km faz com 1 litro. Fica guardado para a próxima vez.">
          <div className="relative">
            <Input
              id="tv-kml"
              inputMode="decimal"
              value={kmL}
              onChange={(e) => setKmL(e.target.value)}
              onBlur={(e) => rememberKmL(e.target.value)}
              className="pr-16 tabular-nums"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-mute">km/L</span>
          </div>
        </Field>
        <Field
          label="Gasolina (litro)"
          htmlFor="tv-price"
          hint={
            gasLoading
              ? "Buscando o preço da semana na ANP…"
              : gas
                ? `Média em Natal na ANP, ${dateShort(gas.start)} a ${dateShort(gas.end)} (${gas.stations} postos). Dá para mudar.`
                : "Sem preço da ANP agora: digite o do posto."
          }
        >
          <MoneyInput
            id="tv-price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={(e) => {
              const c = parseBRL(e.target.value);
              setPrice(c == null ? "" : centsToInput(c));
            }}
            placeholder="0,00"
          />
        </Field>
      </div>

      <div className="grid gap-4 rounded-2xl border border-line bg-white/[0.02] p-4 sm:grid-cols-3">
        <Figure label="Rodagem" value={kmTotal > 0 ? `${fmt(kmTotal, 0)} km` : "—"} />
        <Figure label="Gasolina" value={liters > 0 ? `${fmt(liters)} L` : "—"} />
        <Figure label="Custo" value={cost > 0 ? brl(cost) : "—"} strong />
      </div>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button type="submit" variant="primary" disabled={!(cost > 0)}>
          <Plus /> Adicionar ao orçamento
        </Button>
      </div>
    </form>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid gap-1">
      <p className="label text-mute">{label}</p>
      <p className={cn("tabular-nums", strong ? "text-[22px] font-semibold text-white" : "text-[18px] text-light")}>{value}</p>
    </div>
  );
}

/** Cidade ou endereço com sugestões enquanto digita. */
function PlaceField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só vale a resposta da última busca: uma lenta não sobrescreve a mais nova.
  const latest = useRef(0);
  const id = `tv-${label.toLowerCase()}`;

  function search(text: string) {
    setQuery(text);
    setProblem(null);
    setResults([]);
    if (timer.current) clearTimeout(timer.current);
    const seq = ++latest.current;
    if (text.trim().length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await findPlaces(text).catch(() => null);
      if (seq !== latest.current) return;
      setLoading(false);
      if (r?.ok) {
        setResults(r.places);
        setActive(0);
        if (!r.places.length) setProblem("Nada encontrado. Tente o nome da cidade.");
      } else setProblem(r && !r.ok ? r.error : "A busca não respondeu agora.");
    }, 350);
  }

  function pick(place: Place) {
    onChange(place);
    setQuery("");
    setResults([]);
  }

  if (value) {
    return (
      <div className="grid gap-1.5">
        <p className="text-[13px] font-medium text-ash">{label}</p>
        <div className="flex min-h-11 items-center gap-3 rounded-full border border-line-strong bg-white/[0.03] py-1 pr-1 pl-4">
          <MapPin className="size-4 shrink-0 text-mute" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[15px] text-light">
            {value.label}
            {value.detail ? <span className="text-mute"> · {value.detail}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid size-9 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.06] hover:text-light"
            aria-label={`Trocar ${label.toLowerCase()}`}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ash">
        {label}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mute" aria-hidden />
        <Input
          id={id}
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(results[active]);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={`${id}-list`}
          className="pr-11 pl-11"
        />
        {loading ? <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-mute" aria-hidden /> : null}
      </div>
      {results.length ? (
        <ul id={`${id}-list`} role="listbox" className="grid gap-0.5 rounded-2xl border border-line-strong bg-ink p-1.5 shadow-lg">
          {results.map((p, i) => (
            <li key={`${p.label}-${p.lat}-${p.lon}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => pick(p)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] transition-colors",
                  i === active ? "bg-white/[0.07] text-white" : "text-light",
                )}
              >
                <MapPin className="size-3.5 shrink-0 text-mute" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {p.label}
                  {p.detail ? <span className="text-mute"> · {p.detail}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : problem ? (
        <p className="text-[13px] text-mute">{problem}</p>
      ) : null}
    </div>
  );
}

