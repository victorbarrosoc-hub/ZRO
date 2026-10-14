"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { getNatalGasPrice, type FuelPrice } from "@/lib/services/fuel";
import { drivingDistance, searchPlaces, type Place } from "@/lib/services/route";

/** Busca de cidade ou endereço para o cálculo de deslocamento. */
export async function findPlaces(query: string): Promise<{ ok: true; places: Place[] } | { ok: false; error: string }> {
  await requireUser();
  try {
    return { ok: true, places: await searchPlaces(String(query ?? "").slice(0, 120)) };
  } catch {
    return { ok: false, error: "A busca de lugares não respondeu. Tente de novo ou digite os km." };
  }
}

const Point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

/** Km de carro entre dois pontos (uma ida). */
export async function measureRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): Promise<{ ok: true; km: number; minutes: number } | { ok: false; error: string }> {
  await requireUser();
  const a = Point.safeParse(from);
  const b = Point.safeParse(to);
  if (!a.success || !b.success) return { ok: false, error: "Escolha a origem e o destino na lista." };
  try {
    const route = await drivingDistance(a.data, b.data);
    return route ? { ok: true, ...route } : { ok: false, error: "Não achei rota de carro entre esses lugares. Digite os km." };
  } catch {
    return { ok: false, error: "O cálculo da rota não respondeu. Tente de novo ou digite os km." };
  }
}

/** Gasolina comum em Natal, média da ANP na última semana pesquisada. */
export async function natalGasPrice(): Promise<FuelPrice | null> {
  await requireUser();
  return getNatalGasPrice();
}
