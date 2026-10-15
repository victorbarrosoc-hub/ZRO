import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { ORG, quadroCarregar, quadroCriar } from "@/app/(painel)/painel/quadro/servidor";
import { db, schema } from "@/lib/db";
import type { ClientRecurring } from "@/lib/db/schema";
import { monthLong, todayISO } from "@/lib/format";

/**
 * Contrato recorrente, todo mês sozinho:
 *  1. a cobrança do valor fixo no Financeiro (vence no dia combinado);
 *  2. as entregas fixas do mês viram cards na coluna Pauta (prazo: o último dia do mês).
 * Só o mês corrente. Cada parte é travada em recurring_runs (cliente + mês): gerar de novo
 * não duplica nada, nem com duas pessoas abrindo o painel ao mesmo tempo.
 */

const { clients, financeEntries, recurringRuns } = schema;

/** Teto de cards por cliente e mês (proteção contra quantidade digitada errada). */
const MAX_CARDS = 60;
/** Os formatos da Pauta e como costumam ser escritos (sem acento, minúsculas). */
const FORMATOS: [string, string[]][] = [
  ["Post", ["post", "posts", "postagem", "postagens"]],
  ["Carrossel", ["carrossel", "carrosseis", "carrosel"]],
  ["Reels", ["reels", "reel"]],
  ["Story", ["story", "stories", "storys"]],
  ["Shorts", ["shorts", "short"]],
  ["Vídeo", ["video", "videos"]],
  ["Filme", ["filme", "filmes"]],
  ["Foto", ["foto", "fotos", "fotografia", "fotografias"]],
  ["Artigo", ["artigo", "artigos"]],
];

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * "Reels" → Reels (o nome é só o formato); "Vídeo institucional" → Vídeo (o nome fica);
 * "Cobertura do evento" → sem formato (a Pauta mostra "Post").
 */
function formatoDe(titulo: string): { formato: string | null; soFormato: boolean } {
  const t = sem(titulo);
  const exato = FORMATOS.find(([, a]) => a.includes(t));
  if (exato) return { formato: exato[0], soFormato: true };
  const palavras = t.split(/[^a-z0-9]+/);
  const dentro = FORMATOS.find(([, a]) => a.some((x) => palavras.includes(x)));
  return { formato: dentro?.[0] ?? null, soFormato: false };
}

function ultimoDia(mes: string) {
  return new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10);
}

/** Dia do pagamento dentro do mês (31 em fevereiro vira o último dia). Sem dia: o dia 1. */
function vencimento(mes: string, dia?: number | null) {
  const fim = ultimoDia(mes);
  const d = Math.min(Math.max(1, dia ?? 1), Number(fim.slice(8, 10)));
  return `${mes}-${String(d).padStart(2, "0")}`;
}

export type RecurringResult = { cobrancas: number; cards: number };

/** A cobrança do mês. Se já tem uma entrada do cliente no mês com o mesmo valor, não cria outra. */
async function gerarCobranca(clientId: string, nome: string, r: ClientRecurring, mes: string) {
  if (r.value <= 0) return 0;
  return db.transaction(async (t) => {
    const [trava] = await t
      .update(recurringRuns)
      .set({ financeAt: new Date() })
      .where(and(eq(recurringRuns.clientId, clientId), eq(recurringRuns.month, mes), isNull(recurringRuns.financeAt)))
      .returning({ clientId: recurringRuns.clientId });
    if (!trava) return 0;
    const [ja] = await t
      .select({ id: financeEntries.id })
      .from(financeEntries)
      .where(
        and(
          eq(financeEntries.clientId, clientId),
          eq(financeEntries.kind, "entrada"),
          eq(financeEntries.amount, r.value),
          sql`${financeEntries.dueDate} like ${`${mes}-%`}`,
        ),
      )
      .limit(1);
    let entryId = ja?.id ?? null;
    if (!entryId) {
      const [row] = await t
        .insert(financeEntries)
        .values({
          kind: "entrada",
          category: "cliente",
          description: `${nome} · contrato recorrente de ${monthLong(mes)}`,
          clientId,
          amount: r.value,
          dueDate: vencimento(mes, r.payDay),
          notes: "Gerado pelo contrato recorrente do cliente (CRM).",
        })
        .returning({ id: financeEntries.id });
      entryId = row.id;
    }
    await t
      .update(recurringRuns)
      .set({ financeEntryId: entryId })
      .where(and(eq(recurringRuns.clientId, clientId), eq(recurringRuns.month, mes)));
    return ja ? 0 : 1;
  });
}

/**
 * Os cards do mês na Pauta. O número de cada card é fixo (cliente + mês + posição):
 * se algo falhar no meio, a próxima tentativa completa sem repetir os que já foram.
 */
async function gerarCards(quem: string, clientId: string, r: ClientRecurring, mes: string) {
  const lista = r.deliverables.flatMap((d) =>
    Array.from({ length: d.qty }, (_, i) => ({ titulo: d.title.trim(), i: i + 1, qty: d.qty })),
  );
  if (!lista.length) return 0;
  const [trava] = await db
    .update(recurringRuns)
    .set({ pautaAt: new Date() })
    .where(and(eq(recurringRuns.clientId, clientId), eq(recurringRuns.month, mes), isNull(recurringRuns.pautaAt)))
    .returning({ clientId: recurringRuns.clientId });
  if (!trava) return 0;

  try {
    const atual = await quadroCarregar(ORG);
    let ordem = 0;
    if (atual.ok)
      for (const c of atual.cards)
        if (c.coluna === "pauta" && !c.apagadoEm) ordem = Math.max(ordem, Number(c.ordem) || 0);
    const nomeMes = monthLong(mes).split(" de ")[0];
    const base = `rec_${clientId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}_${mes.replace("-", "")}`;
    const agora = Date.now();
    let criados = 0;
    for (const [n, e] of lista.slice(0, MAX_CARDS).entries()) {
      const { formato, soFormato } = formatoDe(e.titulo);
      // o título da Pauta já mostra cliente e formato: o tema leva o resto
      const tema = [soFormato ? null : e.titulo, e.qty > 1 ? `${e.i} de ${e.qty}` : null, nomeMes].filter(Boolean).join(" · ");
      const dados: Record<string, unknown> = {
        tema,
        coluna: "pauta",
        ordem: ordem + n + 1,
        colunaEm: agora,
        criadoEm: agora,
        criadoPor: `u:${quem}`,
        mod: agora,
        cliente: clientId,
        prazo: ultimoDia(mes),
        recorrente: mes,
        [`cm_${base}_${n + 1}`]: { por: `u:${quem}`, em: agora, txt: `Card do contrato recorrente de ${monthLong(mes)}.` },
      };
      if (formato) dados.formatos = [formato];
      const res = await quadroCriar(quem, ORG, `${base}_${n + 1}`, dados);
      if (res.ok) criados++;
      else if (res.erro !== "id_existe") throw new Error(res.erro);
    }
    await db
      .update(recurringRuns)
      .set({ cards: sql`${recurringRuns.cards} + ${criados}` })
      .where(and(eq(recurringRuns.clientId, clientId), eq(recurringRuns.month, mes)));
    return criados;
  } catch (e) {
    // solta a trava: a próxima abertura do painel tenta de novo (os números fixos evitam repetição)
    await db
      .update(recurringRuns)
      .set({ pautaAt: null })
      .where(and(eq(recurringRuns.clientId, clientId), eq(recurringRuns.month, mes)));
    throw e;
  }
}

/**
 * Gera o que falta do mês para os clientes com contrato recorrente (ou só um cliente).
 * `quem` é o id do usuário (vai para o histórico da Pauta).
 */
export async function gerarRecorrentes(quem: string, opts: { clientId?: string; hoje?: string } = {}): Promise<RecurringResult> {
  const mes = (opts.hoje ?? todayISO()).slice(0, 7);
  const lista = await db
    .select({ id: clients.id, name: clients.name, recurring: clients.recurring })
    .from(clients)
    .where(opts.clientId ? and(eq(clients.id, opts.clientId), isNotNull(clients.recurring)) : isNotNull(clients.recurring));
  const out: RecurringResult = { cobrancas: 0, cards: 0 };
  if (!lista.length) return out;
  const feitos = new Map(
    (
      await db
        .select({ clientId: recurringRuns.clientId, financeAt: recurringRuns.financeAt, pautaAt: recurringRuns.pautaAt })
        .from(recurringRuns)
        .where(eq(recurringRuns.month, mes))
    ).map((x) => [x.clientId, x]),
  );
  for (const c of lista) {
    const r = c.recurring;
    if (!r || (r.startMonth && r.startMonth > mes)) continue;
    const ja = feitos.get(c.id);
    const fin = r.autoFinance !== false && !ja?.financeAt;
    const pauta = r.autoPauta !== false && !ja?.pautaAt;
    if (!fin && !pauta) continue;
    if (!ja) await db.insert(recurringRuns).values({ clientId: c.id, month: mes }).onConflictDoNothing();
    if (fin) out.cobrancas += await gerarCobranca(c.id, c.name, r, mes);
    if (pauta) out.cards += await gerarCards(quem, c.id, r, mes);
  }
  return out;
}

/* Abrir o painel confere o mês, mas não a cada clique: no máximo a cada 10 min por servidor. */
const CONFERIDO = globalThis as unknown as { __zroRecorrentes?: { mes: string; em: number } };

/** Para o painel: confere o mês sem nunca derrubar a página. */
export async function conferirRecorrentes(quem: string) {
  const mes = todayISO().slice(0, 7);
  const ultimo = CONFERIDO.__zroRecorrentes;
  if (ultimo && ultimo.mes === mes && Date.now() - ultimo.em < 10 * 60_000) return null;
  CONFERIDO.__zroRecorrentes = { mes, em: Date.now() };
  try {
    return await gerarRecorrentes(quem);
  } catch (e) {
    CONFERIDO.__zroRecorrentes = undefined;
    console.error("[recorrentes]", e);
    return null;
  }
}

/** O que já foi gerado neste mês para um cliente (para a ficha do cliente). */
export async function recorrenteDoMes(clientId: string) {
  const mes = todayISO().slice(0, 7);
  const [row] = await db
    .select({ financeEntryId: recurringRuns.financeEntryId, cards: recurringRuns.cards, pautaAt: recurringRuns.pautaAt })
    .from(recurringRuns)
    .where(and(eq(recurringRuns.clientId, clientId), eq(recurringRuns.month, mes)));
  return row ?? null;
}
