import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { GB } from "@/lib/drive/bytes";
import { rotuloDiaria } from "@/lib/drive/estrutura";
import { ipDe, permitirIp } from "@/lib/drive/limites";
import { addDaysISO, dateBR } from "@/lib/format";
import { driveConectado } from "@/lib/google/conexao";
import { abrir, ChaveErrada, chaveDerivada, FORMATO_TOKEN, hashToken, novoToken, selar } from "@/lib/google/cripto";
import { GoogleError } from "@/lib/google/erros";
import { SITE_URL } from "@/lib/site-url";
import { cancelarEnviosDoLink } from "./drive-envios";
import { diariaDoEvento, type DiariaDTO } from "./drive-pastas";

/**
 * Links públicos (docs/dev/drive.md §12.1): um por diária (freela) e um por cliente (área).
 * Token de 256 bits; o banco guarda o hash (busca) e a cifra (o painel mostra o link de novo).
 * Nunca apagados: desativar = revogadoEm.
 */

const { driveLinks, driveLotes, driveDiarias, events, projects, clients, loginAttempts } = schema;

export type TipoLink = "freela-diaria" | "cliente-area";
export type LinkLinha = typeof driveLinks.$inferSelect;

export type LinkDTO = {
  id: string;
  tipo: TipoLink;
  url: string | null;
  estado: "ativo" | "expirado" | "desativado";
  expiraEm: Date | null;
  temSenha: boolean;
  limiteBytes: number | null;
  rotulo: string;
  criadoEm: Date;
  ultimoUsoEm: Date | null;
};

/** Limite padrão da área do cliente: 20 GB por dia. */
export const LIMITE_AREA_PADRAO_GB = 20;
const CONTEXTO_TOKEN = (id: string) => `drive_links.token:${id}`;

export function estadoDoLink(l: Pick<LinkLinha, "revogadoEm" | "expiraEm">, agora = new Date()): LinkDTO["estado"] {
  if (l.revogadoEm) return "desativado";
  if (l.expiraEm && l.expiraEm <= agora) return "expirado";
  return "ativo";
}

function urlDoLink(l: LinkLinha): string | null {
  if (l.revogadoEm || !l.tokenEnc) return null;
  try {
    const token = abrir(l.tokenEnc, CONTEXTO_TOKEN(l.id));
    return `${SITE_URL}/${l.tipo === "freela-diaria" ? "enviar" : "cliente"}/${token}`;
  } catch (e) {
    if (e instanceof ChaveErrada) return null; // chave trocada: "Trocar link" gera outro
    throw e;
  }
}

export function paraDTO(l: LinkLinha): LinkDTO {
  return {
    id: l.id,
    tipo: l.tipo as TipoLink,
    url: urlDoLink(l),
    estado: estadoDoLink(l),
    expiraEm: l.expiraEm,
    temSenha: Boolean(l.senhaHash),
    limiteBytes: l.limiteBytes,
    rotulo: l.rotulo,
    criadoEm: l.criadoEm,
    ultimoUsoEm: l.ultimoUsoEm,
  };
}

/** Link pelo token (formato conferido antes). Só do tipo pedido. */
export async function buscarLinkPorToken(token: string, tipo: TipoLink): Promise<LinkLinha | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const [l] = await db
    .select()
    .from(driveLinks)
    .where(and(eq(driveLinks.tokenHash, hashToken(token)), eq(driveLinks.tipo, tipo)))
    .limit(1);
  return l ?? null;
}

/** 23:59:59 em Natal do 30º dia depois do fim da diária. */
export function validadePadraoDaDiaria(evento: { date: string; endDate: string | null }): Date {
  const fim = evento.endDate && evento.endDate > evento.date ? evento.endDate : evento.date;
  return new Date(`${addDaysISO(fim, 30)}T23:59:59-03:00`);
}

async function inserirLink(v: Omit<typeof driveLinks.$inferInsert, "id" | "tokenHash" | "tokenEnc">): Promise<LinkLinha> {
  const id = crypto.randomUUID();
  const token = novoToken();
  const [l] = await db
    .insert(driveLinks)
    .values({ ...v, id, tokenHash: hashToken(token), tokenEnc: selar(token, CONTEXTO_TOKEN(id)) })
    .returning();
  return l;
}

/* ============================== Diária (freela) ============================== */

/**
 * O link da diária (o mais recente, mesmo expirado ou desativado). `criar`: gera um ativo se não houver,
 * congelando o número da diária (precisa do Google).
 */
export async function linkDaDiaria(
  eventId: string,
  o: { criar: boolean; userId: string },
): Promise<{ ok: true; link: LinkDTO | null; diaria: DiariaDTO | null; rolos: number } | { ok: false; mensagem: string }> {
  if (!(await driveConectado())) return { ok: false, mensagem: "Conecte o Google Drive em Ajustes." };
  const evento = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!evento) return { ok: false, mensagem: "Diária não encontrada." };
  if (!evento.projectId) return { ok: false, mensagem: "Esta diária não tem projeto." };
  const projeto = await db.query.projects.findFirst({ where: eq(projects.id, evento.projectId) });
  if (!projeto) return { ok: false, mensagem: "Esta diária não tem projeto." };

  const ultimo = async () =>
    (
      await db
        .select()
        .from(driveLinks)
        .where(and(eq(driveLinks.eventId, eventId), eq(driveLinks.tipo, "freela-diaria")))
        .orderBy(desc(driveLinks.criadoEm))
        .limit(1)
    )[0];

  let link = await ultimo();
  let diaria: DiariaDTO | null = null;
  if (o.criar && (!link || estadoDoLink(link) !== "ativo")) {
    try {
      diaria = await diariaDoEvento(eventId);
    } catch (e) {
      return { ok: false, mensagem: mensagemGoogle(e) };
    }
    // Um expirado ainda ocupa a vaga de "ativo" no índice: sai antes do novo entrar.
    if (link && !link.revogadoEm) {
      await db.update(driveLinks).set({ revogadoEm: new Date(), revogadoPorId: o.userId }).where(eq(driveLinks.id, link.id));
    }
    try {
      link = await inserirLink({
        tipo: "freela-diaria",
        eventId,
        diariaId: diaria.id,
        projectId: projeto.id,
        clientId: projeto.clientId,
        rotulo: `${projeto.title} · ${rotuloDiaria(diaria.numero)} · ${dateBR(evento.date)}`,
        expiraEm: validadePadraoDaDiaria(evento),
        limiteBytes: null,
        criadoPorId: o.userId,
      });
    } catch {
      link = await ultimo(); // dois cliques ao mesmo tempo: fica o que entrou primeiro
    }
  }
  if (!diaria && link?.diariaId) {
    const d = await db.query.driveDiarias.findFirst({ where: eq(driveDiarias.id, link.diariaId) });
    if (d) diaria = { id: d.id, numero: d.numero, nome: d.nome, data: d.data, cenasPastaId: d.cenasPastaId, audiosPastaId: d.audiosPastaId };
  }
  const [r] = await db
    .select({ n: count() })
    .from(driveLotes)
    .where(and(eq(driveLotes.eventId, eventId), eq(driveLotes.origem, "freela"), gt(driveLotes.arquivosRecebidos, 0)));
  return { ok: true, link: link ? paraDTO(link) : null, diaria, rolos: Number(r?.n ?? 0) };
}

/* ============================== Área do cliente ============================== */

/** A área do cliente (a mais recente). `criar`: gera uma ativa se não houver (sem Google também funciona). */
export async function areaDoCliente(
  clientId: string,
  o: { criar: boolean; userId: string; senha?: string | null; limiteDiarioGB?: number | null },
): Promise<{ ok: true; link: LinkDTO | null } | { ok: false; mensagem: string }> {
  const cliente = await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { id: true, name: true } });
  if (!cliente) return { ok: false, mensagem: "Cliente não encontrado." };
  const ultimo = async () =>
    (
      await db
        .select()
        .from(driveLinks)
        .where(and(eq(driveLinks.clientId, clientId), eq(driveLinks.tipo, "cliente-area")))
        .orderBy(desc(driveLinks.criadoEm))
        .limit(1)
    )[0];
  let link = await ultimo();
  if (o.criar && (!link || link.revogadoEm)) {
    if (o.senha != null && o.senha !== "" && o.senha.length < 6) return { ok: false, mensagem: "A senha precisa de pelo menos 6 caracteres." };
    const gb = o.limiteDiarioGB === undefined ? LIMITE_AREA_PADRAO_GB : o.limiteDiarioGB;
    try {
      link = await inserirLink({
        tipo: "cliente-area",
        clientId,
        rotulo: cliente.name,
        expiraEm: null,
        limiteBytes: gb == null ? null : Math.round(gb * GB),
        senhaHash: o.senha ? await hashPassword(o.senha) : null,
        criadoPorId: o.userId,
      });
    } catch {
      link = await ultimo();
    }
  }
  return { ok: true, link: link ? paraDTO(link) : null };
}

/* ============================== Mudanças no link ============================== */

/** Gera outro token: o link antigo para de funcionar (envios já iniciados terminam). */
export async function trocarLink(linkId: string, userId: string): Promise<LinkDTO> {
  const antigo = await db.query.driveLinks.findFirst({ where: eq(driveLinks.id, linkId) });
  if (!antigo) throw new Error("Link não encontrado.");
  // Link de diária já vencido: o novo ganha a validade padrão (senão nasceria vencido).
  let expiraEm = antigo.expiraEm;
  if (expiraEm && expiraEm <= new Date()) {
    const evento = antigo.eventId ? await db.query.events.findFirst({ where: eq(events.id, antigo.eventId) }) : undefined;
    const padrao = evento ? validadePadraoDaDiaria(evento) : null;
    expiraEm = padrao && padrao > new Date() ? padrao : new Date(Date.now() + 30 * 24 * 60 * 60_000);
  }
  const id = crypto.randomUUID();
  const token = novoToken();
  const novo = await db.transaction(async (t) => {
    await t.update(driveLinks).set({ revogadoEm: new Date(), revogadoPorId: userId }).where(and(eq(driveLinks.id, linkId), isNull(driveLinks.revogadoEm)));
    const [l] = await t
      .insert(driveLinks)
      .values({
        id,
        tipo: antigo.tipo,
        tokenHash: hashToken(token),
        tokenEnc: selar(token, CONTEXTO_TOKEN(id)),
        senhaHash: antigo.senhaHash,
        senhaVersao: antigo.senhaVersao + 1,
        eventId: antigo.eventId,
        diariaId: antigo.diariaId,
        projectId: antigo.projectId,
        clientId: antigo.clientId,
        rotulo: antigo.rotulo,
        expiraEm,
        limiteBytes: antigo.limiteBytes,
        criadoPorId: userId,
      })
      .returning();
    return l;
  });
  return paraDTO(novo);
}

/** Desativa. `cancelarEnvios`: cancela no Google as sessões em andamento (o que já chegou fica). */
export async function desativarLink(linkId: string, o: { userId: string; cancelarEnvios: boolean }): Promise<{ cancelados: number }> {
  await db
    .update(driveLinks)
    .set({ revogadoEm: new Date(), revogadoPorId: o.userId })
    .where(and(eq(driveLinks.id, linkId), isNull(driveLinks.revogadoEm)));
  if (!o.cancelarEnvios) return { cancelados: 0 };
  return { cancelados: await cancelarEnviosDoLink(linkId) };
}

/** Senha da área (null tira). Muda senhaVersao: os cookies antigos param de valer. */
export async function definirSenha(linkId: string, senha: string | null): Promise<void> {
  if (senha != null && senha.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
  await db
    .update(driveLinks)
    .set({ senhaHash: senha ? await hashPassword(senha) : null, senhaVersao: sql`${driveLinks.senhaVersao} + 1` })
    .where(eq(driveLinks.id, linkId));
}

export async function definirValidade(linkId: string, expiraEm: Date | null): Promise<void> {
  await db.update(driveLinks).set({ expiraEm }).where(eq(driveLinks.id, linkId));
}

export async function definirLimite(linkId: string, limiteBytes: number | null): Promise<void> {
  await db
    .update(driveLinks)
    .set({ limiteBytes: limiteBytes == null ? null : Math.max(0, Math.round(limiteBytes)) })
    .where(eq(driveLinks.id, linkId));
}

/**
 * Antes de excluir projeto, diária ou cliente: os links que levariam a ele param (nunca apagados).
 * Envios em andamento continuam até o fim.
 */
export async function revogarLinksDe(ref: { projectId?: string; eventId?: string; clientId?: string }): Promise<number> {
  const condicoes = [];
  if (ref.projectId) {
    condicoes.push(eq(driveLinks.projectId, ref.projectId));
    const evs = db.select({ id: events.id }).from(events).where(eq(events.projectId, ref.projectId));
    condicoes.push(inArray(driveLinks.eventId, evs));
  }
  if (ref.eventId) condicoes.push(eq(driveLinks.eventId, ref.eventId));
  if (ref.clientId) condicoes.push(eq(driveLinks.clientId, ref.clientId));
  if (!condicoes.length) return 0;
  const r = await db
    .update(driveLinks)
    .set({ revogadoEm: new Date() })
    .where(and(isNull(driveLinks.revogadoEm), or(...condicoes)))
    .returning({ id: driveLinks.id });
  return r.length;
}

/* ============================== Textos ============================== */

/** WhatsApp do link da diária. */
export function textoWhatsAppDiaria(i: { data: string; projeto: string; url: string }): string {
  const [, m, d] = i.data.slice(0, 10).split("-");
  return `Link para o material da diária de ${d}/${m} (${i.projeto}): ${i.url}. No computador, escolha o cartão inteiro. Um envio por cartão.`;
}

/** WhatsApp da área do cliente. Com senha, uma segunda mensagem avisa que ela vai à parte. */
export function textoWhatsAppArea(i: { contato: string | null; cliente: string; url: string; temSenha: boolean }): string[] {
  const contato = i.contato?.trim().split(/\s+/)[0];
  const msgs = [
    `Olá${contato ? `, ${contato}` : ""}. Esta é a área da ${i.cliente} na ZRO: ${i.url}. Lá ficam os arquivos finais dos projetos, e por ela você nos manda logo, manual de marca e referências.`,
  ];
  if (i.temSenha) msgs.push("A senha vai em outra mensagem.");
  return msgs;
}

/* ============================== Senha e cookie da área ============================== */

export const COOKIE_AREA = "zro_area";
const DIAS_COOKIE = 30;
// Hash qualquer: sem senha cadastrada, o tempo de resposta é o mesmo.
const HASH_FALSO = "$2b$12$/dQxQT0Ze8Zg/txtvYxXYuzue8YGyeQcfLoi4DAEu7ttf8dH3w1W6";
const TENTATIVAS = 5;
const JANELA_MIN = 15;

export async function assinarCookieDaArea(link: { id: string; senhaVersao: number }): Promise<string> {
  return new SignJWT({ l: link.id, v: link.senhaVersao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS_COOKIE}d`)
    .sign(chaveDerivada("zro:area-cliente"));
}

/** O cookie vale para este link e para a senha atual (trocar a senha derruba). */
export async function cookieDaAreaValido(valor: string | undefined, link: { id: string; senhaVersao: number }): Promise<boolean> {
  if (!valor) return false;
  try {
    const { payload } = await jwtVerify(valor, chaveDerivada("zro:area-cliente"), { algorithms: ["HS256"] });
    return payload.l === link.id && payload.v === link.senhaVersao;
  } catch {
    return false;
  }
}

/** httpOnly, secure em produção, lax, só no caminho da própria área, 30 dias (renovado a cada uso). */
export function opcoesDoCookieDaArea(token: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/cliente/${token}`,
    maxAge: DIAS_COOKIE * 24 * 60 * 60,
  };
}

/** A área pede senha e o navegador não tem o cookie certo? (lê o cookie da requisição atual) */
export async function areaPedeSenha(link: LinkLinha): Promise<boolean> {
  if (!link.senhaHash) return false;
  const valor = (await cookies()).get(COOKIE_AREA)?.value;
  return !(await cookieDaAreaValido(valor, link));
}

/**
 * Senha da área (Server Action pública). Link ativo; 5 erros em 15 minutos por link (login_attempts,
 * sem IP gravado) e 20 por hora por IP só em memória. Certo: grava o cookie da área.
 */
export async function entrarNaArea(
  token: string,
  senha: string,
): Promise<{ ok: true } | { ok: false; erro: "senha" | "muitas_tentativas" | "inativo" }> {
  const link = await buscarLinkPorToken(token, "cliente-area");
  if (!link || estadoDoLink(link) !== "ativo") return { ok: false, erro: "inativo" };
  let ip: string | null = null;
  try {
    ip = ipDe(await headers());
  } catch {
    ip = null;
  }
  if (!permitirIp(ip, "senha")) return { ok: false, erro: "muitas_tentativas" };
  const email = `area:${link.id}`;
  const desde = new Date(Date.now() - JANELA_MIN * 60_000);
  const [falhas] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, desde)));
  if (Number(falhas?.n ?? 0) >= TENTATIVAS) return { ok: false, erro: "muitas_tentativas" };

  const certo = await verifyPassword(String(senha ?? "").slice(0, 200), link.senhaHash ?? HASH_FALSO);
  const ok = Boolean(link.senhaHash) ? certo : true;
  await db.insert(loginAttempts).values({ email, ip: null, success: ok });
  if (!ok) return { ok: false, erro: "senha" };
  (await cookies()).set(COOKIE_AREA, await assinarCookieDaArea(link), opcoesDoCookieDaArea(token));
  return { ok: true };
}

/* ============================== Apoio ============================== */

function mensagemGoogle(e: unknown): string {
  if (e instanceof GoogleError) {
    if (e.motivo === "sem_google" || e.motivo === "sem_config") return "Conecte o Google Drive em Ajustes.";
    if (e.motivo === "reconectar") return "A conexão com o Google expirou. Reconecte em Ajustes.";
    if (e.motivo === "nao_encontrado") return "Esta diária não tem projeto.";
    return e.detalhe && !/^HTTP/.test(e.detalhe) && e.motivo === "google" ? e.detalhe : "O Google não respondeu. Tente de novo.";
  }
  return "Não deu para gerar o link. Tente de novo.";
}
