import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Preço médio da gasolina comum em Natal, do levantamento semanal da ANP
 * (planilha "resumo_semanal_lpc", aba CAPITAIS). Guardado em settings e
 * renovado no máximo a cada 12 horas; se a ANP não responder, vale o último.
 */
export type FuelPrice = { price: number; start: string; end: string; stations: number; fetchedAt: string };

const KEY = "combustivel:natal-gasolina";
const PAGE =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const UA = "Mozilla/5.0 (compatible; ZRO-Filmes/1.0; +https://zrofilmes.vercel.app)";

async function cached(): Promise<FuelPrice | null> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, KEY) });
  const v = row?.value as FuelPrice | undefined;
  return v && typeof v === "object" && typeof v.price === "number" ? v : null;
}

export async function getNatalGasPrice(): Promise<FuelPrice | null> {
  const last = await cached();
  if (last && Date.now() - new Date(last.fetchedAt).getTime() < MAX_AGE_MS) return last;
  try {
    const fresh = await fetchFromAnp();
    if (fresh) {
      await db
        .insert(schema.settings)
        .values({ key: KEY, value: fresh })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: fresh } });
      return fresh;
    }
  } catch (e) {
    console.warn("Preço da ANP indisponível agora:", e instanceof Error ? e.message : e);
  }
  return last;
}

async function get(url: string) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} em ${url}`);
  return res;
}

/** Data do Excel (dias desde 1899-12-30) → AAAA-MM-DD. */
function excelDate(serial: string) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return "";
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
}

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function fetchFromAnp(): Promise<FuelPrice | null> {
  const html = await (await get(PAGE)).text();
  // A semana mais recente vem primeiro na página.
  const link = html.match(/https:\/\/[^"']*resumo_semanal_lpc_[\d-]+_[\d-]+\.xlsx/)?.[0];
  if (!link) throw new Error("planilha semanal não encontrada na página da ANP");
  const files = unzipSync(new Uint8Array(await (await get(link)).arrayBuffer()));
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : "");

  // Aba CAPITAIS: nome → id → arquivo da planilha.
  const rid = text("xl/workbook.xml").match(/<sheet [^>]*name="CAPITAIS"[^>]*r:id="([^"]+)"/)?.[1];
  const target = rid ? text("xl/_rels/workbook.xml.rels").match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] : null;
  const sheet = text(`xl/${(target ?? "worksheets/sheet1.xml").replace(/^\/?xl\//, "")}`);
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "")),
  );

  for (const row of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const raw = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      cells[c[1]] = /t="s"/.test(c[2]) && raw ? (shared[Number(raw)] ?? "") : raw;
    }
    if (cells.C === "RIO GRANDE DO NORTE" && cells.D === "NATAL" && cells.E === "GASOLINA COMUM") {
      const price = Math.round(Number(cells.H) * 100) / 100;
      if (!(price > 0)) break;
      return {
        price,
        start: excelDate(cells.A),
        end: excelDate(cells.B),
        stations: Number(cells.F) || 0,
        fetchedAt: new Date().toISOString(),
      };
    }
  }
  throw new Error("Natal não apareceu na planilha da ANP");
}
