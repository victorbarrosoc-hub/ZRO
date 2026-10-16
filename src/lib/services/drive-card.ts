import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { quadroMudar, ORG } from "@/app/(painel)/painel/quadro/servidor";
import { SECOES_ENTREGAS } from "@/lib/drive/estrutura";
import { driveProjetoAtual } from "./drive-pastas";

/**
 * O card da Pauta visto pelo Drive (link de envio por card, docs/dev/drive.md §15):
 * o projeto do card, as pastas onde a peça final pode cair e o registro no card do que chegou.
 * O card só muda por `quadroMudar` (por campo, com histórico), nunca direto no jsonb.
 */

const { quadroCards, projects, clients, freelancers, driveEnvios, driveLotes } = schema;

export type CardPauta = Record<string, unknown> & { id: string };

/** "Master" | "Redes" | "Legendas" (seções de 06 Entregas) ou "render" (05 Render). */
export const CHAVES_DESTINO = [...SECOES_ENTREGAS, "render"] as const;
export type ChaveDestino = (typeof CHAVES_DESTINO)[number];
export type DestinoCard = { chave: ChaveDestino; rotulo: string; pastaId: string };

/** Quem manda pelo link e não está no painel aparece assim no "por" da conversa do card. */
export const POR_LINK = "Link de envio";

export async function lerCard(cardId: string): Promise<CardPauta | null> {
  const [r] = await db
    .select({ dados: quadroCards.dados })
    .from(quadroCards)
    .where(and(eq(quadroCards.org, ORG), eq(quadroCards.id, cardId)))
    .limit(1);
  return r ? ({ ...(r.dados as Record<string, unknown>), id: cardId } as CardPauta) : null;
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * O projeto do card, com a mesma regra da ficha (pastas-peca.tsx): "nenhum" = sem projeto; escolhido =
 * ele; vazio = o único projeto em andamento (ativo ou pausado) do cliente. Interno ("casa") não tem.
 */
export async function projetoDoCard(card: CardPauta): Promise<{ id: string; title: string; clientId: string | null } | null> {
  const escolhido = texto(card.projeto);
  if (escolhido === "nenhum") return null;
  if (escolhido) {
    return (await db.query.projects.findFirst({ where: eq(projects.id, escolhido), columns: { id: true, title: true, clientId: true } })) ?? null;
  }
  const cliente = texto(card.cliente);
  if (!cliente || cliente === "casa") return null;
  const ativos = await db
    .select({ id: projects.id, title: projects.title, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.clientId, cliente), inArray(projects.status, ["ativo", "pausado"])))
    .limit(2);
  return ativos.length === 1 ? ativos[0] : null;
}

/** Onde a peça pode cair: as seções de 06 Entregas (ou a própria 06 Entregas) e 05 Render. Só banco. */
export async function destinosDoProjeto(projectId: string): Promise<DestinoCard[]> {
  const dp = await driveProjetoAtual(projectId).catch(() => undefined);
  if (!dp?.pastaId) return [];
  const sub = dp.subpastas ?? {};
  const lista: DestinoCard[] = [];
  for (const s of SECOES_ENTREGAS) {
    const id = sub[`06 Entregas/${s}`];
    if (id) lista.push({ chave: s, rotulo: `06 Entregas / ${s}`, pastaId: id });
    else if (dp.entregasId) lista.push({ chave: s, rotulo: "06 Entregas", pastaId: dp.entregasId });
  }
  if (dp.renderId) lista.push({ chave: "render", rotulo: "05 Render", pastaId: dp.renderId });
  return lista;
}

/** "SERHS · Reels · Verão em Pipa" (como a ficha mostra) ou só o tema, no trabalho da casa. */
export async function tituloDoCard(card: CardPauta): Promise<{ titulo: string; tema: string; cliente: string | null }> {
  const tema = texto(card.tema).trim() || "Sem título";
  const clienteId = texto(card.cliente);
  if (!clienteId || clienteId === "casa") return { titulo: tema, tema, cliente: null };
  const c = await db.query.clients.findFirst({ where: eq(clients.id, clienteId), columns: { name: true } });
  const nome = c?.name ?? null;
  const formatos = Array.isArray(card.formatos) ? card.formatos.filter((f): f is string => typeof f === "string") : [];
  const formato = formatos[0] ?? "Post";
  return { titulo: nome ? `${nome} · ${formato} · ${tema}` : tema, tema, cliente: nome };
}

/** O freela responsável pelo card ("f:<id>"), se for freela. */
export async function freelaDoCard(card: CardPauta): Promise<{ id: string; nome: string; phone: string | null } | null> {
  const resp = texto(card.resp);
  if (!resp.startsWith("f:")) return null;
  const f = await db.query.freelancers.findFirst({
    where: eq(freelancers.id, resp.slice(2)),
    columns: { id: true, name: true, phone: true },
  });
  return f ? { id: f.id, nome: f.name, phone: f.phone } : null;
}

const linkDoArquivo = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "Alguém";

/** O id do Drive dentro de um link (file/d/<id>, ?id=<id>), para não repetir o mesmo arquivo. */
function idNoLink(url: string): string | null {
  const m = /\/d\/([A-Za-z0-9_-]{10,})/.exec(url) ?? /[?&]id=([A-Za-z0-9_-]{10,})/.exec(url);
  return m ? m[1] : null;
}

/**
 * Lote de um card que terminou (link do freela ou "Enviar aqui" da ficha; fecharLote ou a conciliação): uma mensagem na conversa do card
 * ("Rafael subiu 2 arquivos em 06 Entregas / Redes.") e o link de cada arquivo em `links`.
 * Idempotente: a mensagem tem chave fixa por lote (cm_env_<lote>) e só é regravada se o texto mudar;
 * um arquivo que já está nos links não entra de novo. Card apagado (lápide) ou sumido: nada.
 */
export async function registrarEnvioNoCard(loteId: string): Promise<boolean> {
  const l = await db.query.driveLotes.findFirst({ where: eq(driveLotes.id, loteId) });
  if (!l?.cardId) return false;
  const arquivos = await db
    .select({ id: driveEnvios.arquivoId, nome: driveEnvios.nome })
    .from(driveEnvios)
    .where(and(eq(driveEnvios.loteId, l.id), eq(driveEnvios.estado, "concluido"), isNotNull(driveEnvios.arquivoId)))
    .orderBy(asc(driveEnvios.concluidoEm), asc(driveEnvios.criadoEm));
  if (!arquivos.length) return false;
  // O rótulo do lote começa pelo destino: "06 Entregas / Redes · Rafael Moura" (link) ou "06 Entregas / Master" (painel).
  const destino = l.rotulo.split(" · ")[0];
  const n = arquivos.length;
  const txt = `${primeiroNome(l.pessoaNome)} subiu ${n === 1 ? "1 arquivo" : `${n} arquivos`} em ${destino}.`;
  const chaveMsg = `cm_env_${l.id}`;
  // Pelo painel ("Enviar aqui"), quem enviou é o sócio logado; pelo link, o registro diz que veio do link.
  const doPainel = l.origem === "painel" && !!l.userId;
  const quem = doPainel ? l.userId! : `link:${l.linkId ?? "?"}`;
  const por = doPainel ? `u:${l.userId}` : POR_LINK;

  // Até três voltas: se alguém mexeu nos links entre a leitura e a gravação, lê de novo.
  for (let volta = 0; volta < 3; volta++) {
    const [row] = await db
      .select({ dados: quadroCards.dados, versao: quadroCards.versao })
      .from(quadroCards)
      .where(and(eq(quadroCards.org, ORG), eq(quadroCards.id, l.cardId)))
      .limit(1);
    if (!row) return false;
    const card = row.dados as Record<string, unknown>;
    if (card.apagadoEm) return false;

    const campos: Record<string, unknown> = {};
    const atuais = Array.isArray(card.links) ? (card.links as { url: string; nome?: string }[]) : [];
    const ja = new Set(atuais.map((x) => idNoLink(String(x?.url ?? ""))).filter(Boolean));
    const novos = arquivos.filter((a) => a.id && !ja.has(a.id)).map((a) => ({ url: linkDoArquivo(a.id!), nome: a.nome }));
    // Dois arquivos com o mesmo id não existem, mas a lista não repete nem dentro do lote.
    const vistos = new Set<string>();
    const unicos = novos.filter((x) => (vistos.has(x.url) ? false : (vistos.add(x.url), true)));
    if (unicos.length) campos.links = [...atuais, ...unicos];
    const msg = card[chaveMsg] as { txt?: string } | undefined;
    if (msg?.txt !== txt) campos[chaveMsg] = { por, em: Date.now(), txt };
    if (!Object.keys(campos).length) return true;
    campos.mod = Date.now();

    const r = await quadroMudar(quem, ORG, l.cardId, campos, row.versao);
    if (!r.ok) return false;
    if (!("links" in r.conflitos) && !(chaveMsg in r.conflitos)) return true;
  }
  return false;
}
