import "server-only";

/**
 * Lugares e distância de carro, com serviços abertos do OpenStreetMap:
 * Photon (busca de cidade ou endereço) e OSRM (rota de carro).
 */
export type Place = { label: string; detail: string; lat: number; lon: number };

const UA = "ZRO-Filmes/1.0 (painel interno; zrofilmes.vercel.app)";
/** Centro de Natal: a busca prefere lugares perto da ZRO. */
export const NATAL: Place = { label: "Natal", detail: "Rio Grande do Norte", lat: -5.7945, lon: -35.211 };

const UF: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amapá: "AP", Amazonas: "AM", Bahia: "BA", Ceará: "CE", "Distrito Federal": "DF",
  "Espírito Santo": "ES", Goiás: "GO", Maranhão: "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", Pará: "PA", Paraíba: "PB", Paraná: "PR", Pernambuco: "PE", Piauí: "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", Rondônia: "RO", Roraima: "RR", "Santa Catarina": "SC",
  "São Paulo": "SP", Sergipe: "SE", Tocantins: "TO",
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
};

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "12");
  url.searchParams.set("lat", String(NATAL.lat));
  url.searchParams.set("lon", String(NATAL.lon));
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`busca de lugar: ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  // Cidade antes de rua: "João Pessoa" é a capital da Paraíba, não a rua do Centro.
  const rank = (f: PhotonFeature) => {
    const t = f.properties.type ?? f.properties.osm_value ?? "";
    if (["city", "town", "municipality"].includes(t)) return 0;
    if (["village", "hamlet", "suburb", "district", "locality", "county", "state"].includes(t)) return 1;
    if (f.properties.osm_key && f.properties.osm_key !== "highway" && t !== "street" && t !== "house") return 2;
    return 3;
  };
  const features = (data.features ?? []).map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i);
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const { f } of features) {
    const p = f.properties;
    if (p.countrycode && p.countrycode !== "BR") continue;
    const uf = p.state ? (UF[p.state] ?? p.state) : "";
    const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(", ") : "";
    const label = p.name || street || p.city || "";
    if (!label) continue;
    const place = [p.name && street && p.name !== street ? street : "", p.district, p.city !== label ? p.city : "", uf]
      .filter(Boolean)
      .join(" · ");
    const [lon, lat] = f.geometry.coordinates;
    const key = `${label}|${place}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, detail: place, lat, lon });
    if (out.length >= 6) break;
  }
  return out;
}

/** Distância de carro em km (uma ida) e o tempo em minutos. */
export async function drivingDistance(from: Pick<Place, "lat" | "lon">, to: Pick<Place, "lat" | "lon">) {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`rota: ${res.status}`);
  const data = (await res.json()) as { code: string; routes?: { distance: number; duration: number }[] };
  const route = data.code === "Ok" ? data.routes?.[0] : undefined;
  if (!route) return null;
  return { km: Math.round((route.distance / 1000) * 10) / 10, minutes: Math.round(route.duration / 60) };
}
