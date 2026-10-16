import "server-only";
import { and, eq, gt, gte, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Limites do envio (docs/dev/drive.md §5).
 * - Por IP, em memória (por instância): 6.000 requisições a cada 10 minutos; 20 tentativas de senha por hora.
 * - Por link, no banco: 10.000 arquivos em `iniciar` por hora; bytes do link (total no freela, por dia no cliente).
 * Sem pré-checagem de espaço ou dos 750 GB pelo tamanho declarado: o Google recusa e a mensagem chega certa.
 */

const { driveEnvios, driveLotes } = schema;

type Janela = { inicio: number; n: number };
const janelas = new Map<string, Janela>();
let ultimaLimpeza = Date.now();

const REGRAS = {
  envio: { max: 6000, ms: 10 * 60_000 },
  senha: { max: 20, ms: 60 * 60_000 },
} as const;

/** Conta uma requisição. false = passou do limite. */
export function permitirIp(ip: string | null, tipo: keyof typeof REGRAS): boolean {
  const agora = Date.now();
  if (agora - ultimaLimpeza > 60_000) {
    for (const [k, j] of janelas) if (agora - j.inicio > 60 * 60_000) janelas.delete(k);
    ultimaLimpeza = agora;
  }
  const regra = REGRAS[tipo];
  const chave = `${tipo}:${ip ?? "?"}`;
  const j = janelas.get(chave);
  if (!j || agora - j.inicio > regra.ms) {
    janelas.set(chave, { inicio: agora, n: 1 });
    return true;
  }
  j.n++;
  return j.n <= regra.max;
}

/** IP de quem chamou (Vercel: x-forwarded-for). Só para os limites em memória: nunca é gravado. */
export function ipDe(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}

export const ARQUIVOS_POR_HORA = 10_000;
/** Envio sem sinal há mais que isto não conta para o limite (quem declarou e sumiu não trava ninguém). */
export const SINAL_ATIVO_MS = 2 * 60 * 60_000;

/** Arquivos que o link já pediu para iniciar na última hora. */
export async function arquivosNaUltimaHora(linkId: string): Promise<number> {
  const desde = new Date(Date.now() - 60 * 60_000);
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(driveEnvios)
    .innerJoin(driveLotes, eq(driveLotes.id, driveEnvios.loteId))
    .where(and(eq(driveLotes.linkId, linkId), gte(driveEnvios.criadoEm, desde)));
  return Number(r?.n ?? 0);
}

/**
 * Bytes que contam para o limite do link: concluídos + enviando com sinal nas últimas 2 horas.
 * `desde`: só a partir dessa hora (o limite do cliente é por dia).
 */
export async function bytesDoLink(linkId: string, desde?: Date): Promise<number> {
  const ativo = new Date(Date.now() - SINAL_ATIVO_MS);
  const [r] = await db
    .select({ n: sql<number>`coalesce(sum(${driveEnvios.tamanho}), 0)`.mapWith(Number) })
    .from(driveEnvios)
    .innerJoin(driveLotes, eq(driveLotes.id, driveEnvios.loteId))
    .where(
      and(
        eq(driveLotes.linkId, linkId),
        desde ? gte(driveEnvios.criadoEm, desde) : undefined,
        or(eq(driveEnvios.estado, "concluido"), and(eq(driveEnvios.estado, "enviando"), gt(driveEnvios.ultimoSinalEm, ativo))),
      ),
    );
  return Number(r?.n ?? 0);
}

/** Meia-noite de hoje em Natal (o limite diário do cliente volta aí). */
export function inicioDoDia(agora = new Date()): Date {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return new Date(`${hoje}T00:00:00-03:00`);
}
