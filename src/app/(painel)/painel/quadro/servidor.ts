import "server-only";

/**
 * O banco do Quadro: a versão para o Postgres da ZRO do quadro-banco.sql da Maestro
 * (docs/quadro). Mesmas regras:
 *  1. grava por CAMPO (nunca o card inteiro): null tira o campo;
 *  2. apagar é lápide (apagadoEm); aqui não existe DELETE;
 *  3. toda gravação vai para o histórico, com cada campo [antes, depois];
 *  4. a organização vem sempre explícita e é conferida;
 *  5. conflito por campo: com "base", campo que outra pessoa mudou depois volta em "conflitos".
 * Quem chama (banco/route.ts) já conferiu a sessão.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { quadroCards, quadroHistorico } = schema;

/** A ZRO é uma organização só; o nome vem explícito em toda chamada e é conferido. */
export const ORG = "zro";
const ID_OK = /^[A-Za-z0-9_-]{4,64}$/;
/** Teto de um card no banco (texto, checklist, conversa): evita gravação gigante por engano. */
const MAX_BYTES = 400_000;

type Card = Record<string, unknown> & { id: string };
export type Res<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const tamanho = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Hora do banco (não a do servidor): o cursor de "desde" compara com atualizado_em. */
async function agoraNoBanco() {
  const r = (await db.execute(sql`select now()::text as agora`)) as unknown;
  const rows = (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as { agora: string }[];
  return rows[0].agora;
}

/** Todos os cards da organização, inclusive os apagados. "cursor" é para o ouvir(). */
export async function quadroCarregar(org: string): Promise<Res<{ cards: Card[]; cursor: string }>> {
  if (org !== ORG) return { ok: false, erro: "sem_acesso" };
  const [rows, agora] = await Promise.all([
    db.select({ dados: quadroCards.dados }).from(quadroCards).where(eq(quadroCards.org, org)),
    agoraNoBanco(),
  ]);
  return { ok: true, cards: rows.map((r) => r.dados as Card), cursor: agora };
}

/**
 * O que mudou desde o cursor (com 5 s de folga: uma gravação que começou antes e
 * terminou depois não escapa). Receber o mesmo card duas vezes não faz mal.
 */
export async function quadroDesde(org: string, cursor: unknown): Promise<Res<{ cards: Card[]; cursor: string }>> {
  if (org !== ORG) return { ok: false, erro: "sem_acesso" };
  const desde = new Date(String(cursor));
  if (typeof cursor !== "string" || Number.isNaN(desde.getTime())) return { ok: false, erro: "formato" };
  const [rows, agora] = await Promise.all([
    db
      .select({ dados: quadroCards.dados })
      .from(quadroCards)
      .where(and(eq(quadroCards.org, org), gt(quadroCards.atualizadoEm, new Date(desde.getTime() - 5000)))),
    agoraNoBanco(),
  ]);
  return { ok: true, cards: rows.map((r) => r.dados as Card), cursor: agora };
}

/** Criar: o card inteiro, uma vez. Número repetido não sobrescreve ninguém. */
export async function quadroCriar(quem: string, org: string, id: unknown, dados: unknown): Promise<Res<{ versao: number }>> {
  if (org !== ORG) return { ok: false, erro: "sem_acesso" };
  if (typeof id !== "string" || !ID_OK.test(id)) return { ok: false, erro: "formato" };
  if (!objeto(dados) || tamanho(dados) > MAX_BYTES) return { ok: false, erro: "formato" };
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) if (v !== null && v !== undefined) d[k] = v;
  d.id = id;
  const versoes = Object.fromEntries(Object.keys(d).map((k) => [k, 1]));
  const criado = await db.transaction(async (t) => {
    const [row] = await t
      .insert(quadroCards)
      .values({ org, id, dados: d, versao: 1, versoes })
      .onConflictDoNothing()
      .returning({ id: quadroCards.id });
    if (!row) return false;
    await t.insert(quadroHistorico).values({
      org,
      cardId: id,
      quem,
      operacao: "criar",
      campos: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, [null, v]])),
    });
    return true;
  });
  return criado ? { ok: true, versao: 1 } : { ok: false, erro: "id_existe" };
}

/**
 * Mudar: SÓ os campos enviados (null = tirar o campo). Com "base" (a versão em que o
 * card foi lido), campo que outra pessoa mudou depois disso não é sobrescrito: volta
 * em "conflitos" com o valor que ficou.
 */
export async function quadroMudar(
  quem: string,
  org: string,
  id: unknown,
  campos: unknown,
  base?: unknown,
): Promise<Res<{ versao: number; conflitos: Record<string, unknown> }>> {
  if (org !== ORG) return { ok: false, erro: "sem_acesso" };
  if (typeof id !== "string" || !ID_OK.test(id) || !objeto(campos)) return { ok: false, erro: "formato" };
  return db.transaction(async (t) => {
    const [c] = await t
      .select()
      .from(quadroCards)
      .where(and(eq(quadroCards.org, org), eq(quadroCards.id, id)))
      .for("update");
    if (!c) return { ok: false as const, erro: "nao_existe" };
    const nova = c.versao + 1;
    const dados = { ...(c.dados as Record<string, unknown>) };
    const versoes = { ...(c.versoes as Record<string, number>) };
    const hist: Record<string, [unknown, unknown]> = {};
    const conflitos: Record<string, unknown> = {};
    for (const [k, bruto] of Object.entries(campos)) {
      if (k === "id") continue;
      const v = bruto === undefined ? null : bruto;
      const antes = k in dados ? dados[k] : null;
      if (igual(antes, v)) continue;
      if (typeof base === "number" && (versoes[k] ?? 0) > base) {
        conflitos[k] = antes;
        continue;
      }
      if (v === null) delete dados[k];
      else dados[k] = v;
      versoes[k] = nova;
      hist[k] = [antes, v];
    }
    if (!Object.keys(hist).length) return { ok: true as const, versao: c.versao, conflitos };
    if (tamanho(dados) > MAX_BYTES) return { ok: false as const, erro: "card_grande_demais" };
    await t
      .update(quadroCards)
      .set({ dados, versoes, versao: nova, atualizadoEm: sql`now()` })
      .where(and(eq(quadroCards.org, org), eq(quadroCards.id, id)));
    await t.insert(quadroHistorico).values({ org, cardId: id, quem, operacao: "mudar", campos: hist });
    return { ok: true as const, versao: nova, conflitos };
  });
}
