import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { bytesBR } from "@/lib/drive/bytes";
import { acharFonte, rotuloDiaria } from "@/lib/drive/estrutura";
import { dateBR, todayISO } from "@/lib/format";
import { contaAtual, dadosDaConexao } from "@/lib/google/conexao";
import { linkPasta } from "@/lib/google/drive";
import { paraDTO, type LinkDTO } from "@/lib/services/drive-links";

/**
 * Leituras do Drive só para as telas do painel (docs/dev/drive.md §7): o que chegou, as diárias com
 * link e rolos, as entregas de cada projeto e a área do cliente. Nada aqui fala com o Google: só banco.
 */

const { driveLotes, driveDiarias, driveLinks, driveProjetos, drivePastas, projects, clients, events, eventCrew, freelancers, users } = schema;

/** Sem sinal há mais de 2 h: o envio parou (o servidor confere no Google depois). */
const SINAL_ATIVO_MS = 2 * 60 * 60_000;

/* ============================== Apoio ============================== */

/** "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" ou a data. */
export function quandoRelativo(d: Date | null | undefined, agora = new Date()): string {
  if (!d) return "—";
  const min = Math.floor((agora.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return dateBR(todayISO(d));
}

/** "12/03 18:40" em Natal. */
export function diaHora(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");
}

/** "12/03" a partir de "2026-03-12". */
export function diaMes(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

const arquivosTexto = (n: number) => (n === 1 ? "1 arquivo" : `${n} arquivos`);

/* ============================== Lotes ============================== */

export type SituacaoLote = { texto: string; tom: "ok" | "warn" | "neutral" };

export type LoteResumo = {
  id: string;
  origem: "freela" | "cliente" | "painel";
  tipo: "video" | "audio" | "cliente" | "painel";
  rotulo: string;
  rolo: string | null;
  assunto: string | null;
  pessoaNome: string | null;
  projectId: string | null;
  projetoTitulo: string | null;
  clientId: string | null;
  clienteNome: string | null;
  eventId: string | null;
  diaria: string | null; // "Diária 02"
  arquivos: number;
  previstos: number;
  bytes: number;
  estado: string;
  situacao: SituacaoLote;
  novo: boolean;
  pastaUrl: string;
  criadoEm: Date;
  quando: string; // "há 2 h"
  diaHora: string; // "12/03 18:40"
};

const colunasLote = {
  id: driveLotes.id,
  origem: driveLotes.origem,
  fonte: driveLotes.fonte,
  rotulo: driveLotes.rotulo,
  rolo: driveLotes.rolo,
  assunto: driveLotes.assunto,
  pessoaNome: driveLotes.pessoaNome,
  projectId: driveLotes.projectId,
  clientId: driveLotes.clientId,
  eventId: driveLotes.eventId,
  pastaId: driveLotes.pastaId,
  arquivosPrevistos: driveLotes.arquivosPrevistos,
  arquivosRecebidos: driveLotes.arquivosRecebidos,
  bytesRecebidos: driveLotes.bytesRecebidos,
  estado: driveLotes.estado,
  vistoEm: driveLotes.vistoEm,
  ultimoSinalEm: driveLotes.ultimoSinalEm,
  criadoEm: driveLotes.criadoEm,
  concluidoEm: driveLotes.concluidoEm,
  projetoTitulo: projects.title,
  clienteNome: clients.name,
  diariaNumero: driveDiarias.numero,
};

type LinhaLote = {
  id: string;
  origem: string;
  fonte: string | null;
  rotulo: string;
  rolo: string | null;
  assunto: string | null;
  pessoaNome: string | null;
  projectId: string | null;
  clientId: string | null;
  eventId: string | null;
  pastaId: string;
  arquivosPrevistos: number;
  arquivosRecebidos: number;
  bytesRecebidos: number;
  estado: string;
  vistoEm: Date | null;
  ultimoSinalEm: Date | null;
  criadoEm: Date;
  concluidoEm: Date | null;
  projetoTitulo: string | null;
  clienteNome: string | null;
  diariaNumero: number | null;
};

/** Recebido, Enviando, Interrompido (sem sinal há 2 h), Parcial ("faltam 2") ou Cancelado. */
export function situacaoDoLote(
  l: { estado: string; ultimoSinalEm: Date | null; arquivosPrevistos: number; arquivosRecebidos: number },
  agora = new Date(),
): SituacaoLote {
  if (l.estado === "concluido") return { texto: "Recebido", tom: "ok" };
  if (l.estado === "cancelado") return { texto: "Cancelado", tom: "neutral" };
  if (l.estado === "parcial") {
    const faltam = Math.max(0, l.arquivosPrevistos - l.arquivosRecebidos);
    return { texto: faltam ? `Parcial · faltam ${faltam}` : "Parcial", tom: "warn" };
  }
  const parado = !l.ultimoSinalEm || agora.getTime() - l.ultimoSinalEm.getTime() > SINAL_ATIVO_MS;
  return parado ? { texto: "Interrompido", tom: "warn" } : { texto: "Enviando", tom: "neutral" };
}

function paraResumo(l: LinhaLote, agora = new Date()): LoteResumo {
  const origem = (l.origem === "freela" || l.origem === "cliente" ? l.origem : "painel") as LoteResumo["origem"];
  const fonte = acharFonte(l.fonte);
  return {
    id: l.id,
    origem,
    tipo: origem === "cliente" ? "cliente" : origem === "painel" ? "painel" : fonte?.tipo === "audio" ? "audio" : "video",
    rotulo: l.rotulo,
    rolo: l.rolo,
    assunto: l.assunto,
    pessoaNome: l.pessoaNome,
    projectId: l.projectId,
    projetoTitulo: l.projetoTitulo,
    clientId: l.clientId,
    clienteNome: l.clienteNome,
    eventId: l.eventId,
    diaria: l.diariaNumero != null ? rotuloDiaria(l.diariaNumero) : null,
    arquivos: l.arquivosRecebidos,
    previstos: l.arquivosPrevistos,
    bytes: l.bytesRecebidos,
    estado: l.estado,
    situacao: situacaoDoLote(l, agora),
    novo: !l.vistoEm,
    pastaUrl: linkPasta(l.pastaId),
    criadoEm: l.criadoEm,
    quando: quandoRelativo(l.concluidoEm ?? l.ultimoSinalEm ?? l.criadoEm, agora),
    diaHora: diaHora(l.concluidoEm ?? l.criadoEm),
  };
}

/** Linha 1 de um lote: "A003 · Câm A · Rafael Moura" ou "Manual de marca · SERHS". */
export function tituloDoLote(l: LoteResumo): string {
  if (l.origem === "cliente") return [l.assunto ?? l.rotulo, l.clienteNome].filter(Boolean).join(" · ");
  return l.rotulo;
}

/**
 * Linha 2: "Verão Pipa · Diária 02 · 128 arquivos · 212,4 GB · há 2 h".
 * `semProjeto`/`semDiaria`: a tela já mostra (ex.: dentro da aba do próprio projeto).
 * `quando`: "há 2 h" (padrão), a data ("12/03 18:40") ou nada.
 */
export function detalheDoLote(
  l: LoteResumo,
  o: { semProjeto?: boolean; semDiaria?: boolean; quando?: "relativo" | "data" | "nao" } = {},
): string {
  const contagem =
    l.estado !== "concluido" && l.previstos > l.arquivos
      ? `${l.arquivos} de ${arquivosTexto(l.previstos)}`
      : arquivosTexto(l.arquivos);
  const projeto = o.semProjeto ? null : l.origem === "cliente" ? (l.projetoTitulo ?? "Arquivos da empresa") : l.projetoTitulo;
  const diaria = o.semDiaria || l.origem !== "freela" ? null : l.diaria;
  const quando = o.quando === "nao" ? null : o.quando === "data" ? l.diaHora : l.quando;
  return [projeto, diaria, contagem, bytesBR(l.bytes), quando].filter(Boolean).join(" · ");
}

function consultaLotes() {
  return db
    .select(colunasLote)
    .from(driveLotes)
    .leftJoin(projects, eq(projects.id, driveLotes.projectId))
    .leftJoin(clients, eq(clients.id, driveLotes.clientId))
    .leftJoin(driveDiarias, eq(driveDiarias.id, driveLotes.diariaId))
    .$dynamic();
}

/** "Chegou": lotes de freela e cliente dos últimos 7 dias. */
export async function lotesRecentes(o: { dias?: number; limite?: number } = {}): Promise<LoteResumo[]> {
  const desde = new Date(Date.now() - (o.dias ?? 7) * 24 * 60 * 60_000);
  const rows = await consultaLotes()
    .where(and(inArray(driveLotes.origem, ["freela", "cliente"]), gt(driveLotes.criadoEm, desde)))
    .orderBy(desc(driveLotes.criadoEm))
    .limit(o.limite ?? 8);
  const agora = new Date();
  return rows.map((r) => paraResumo(r, agora));
}

/** Tudo o que chegou de freelas e do cliente para um projeto (do mais novo ao mais antigo). */
export async function lotesDoProjeto(projectId: string): Promise<LoteResumo[]> {
  const rows = await consultaLotes()
    .where(and(eq(driveLotes.projectId, projectId), inArray(driveLotes.origem, ["freela", "cliente"])))
    .orderBy(desc(driveLotes.criadoEm))
    .limit(500);
  const agora = new Date();
  return rows.map((r) => paraResumo(r, agora));
}

/** O que o cliente mandou pela área (com ou sem projeto). */
export async function lotesDoCliente(clientId: string, limite = 50): Promise<LoteResumo[]> {
  const rows = await consultaLotes()
    .where(and(eq(driveLotes.clientId, clientId), eq(driveLotes.origem, "cliente")))
    .orderBy(desc(driveLotes.criadoEm))
    .limit(limite);
  const agora = new Date();
  return rows.map((r) => paraResumo(r, agora));
}

/** Contagem para a aba Drive do projeto. */
export async function contarLotesDoProjeto(projectId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(driveLotes)
    .where(and(eq(driveLotes.projectId, projectId), inArray(driveLotes.origem, ["freela", "cliente"])));
  return Number(r?.n ?? 0);
}

/* ============================== Diárias ============================== */

export type DiariaComEnvio = {
  eventId: string;
  data: string;
  titulo: string;
  local: string | null;
  numero: number | null;
  link: LinkDTO | null;
  rolos: LoteResumo[];
};

/** Diárias do projeto, com o link de envio mais recente e o que chegou em cada uma. */
export async function diariasComEnvio(projectId: string, lotes?: LoteResumo[]): Promise<DiariaComEnvio[]> {
  const diarias = await db
    .select({ id: events.id, date: events.date, title: events.title, location: events.location })
    .from(events)
    .where(and(eq(events.projectId, projectId), eq(events.type, "diaria")))
    .orderBy(asc(events.date), asc(events.startTime), asc(events.createdAt));
  if (!diarias.length) return [];
  const ids = diarias.map((d) => d.id);

  const conta = await contaAtual();
  const [links, numeros, todos] = await Promise.all([
    db
      .select()
      .from(driveLinks)
      .where(and(inArray(driveLinks.eventId, ids), eq(driveLinks.tipo, "freela-diaria")))
      .orderBy(desc(driveLinks.criadoEm)),
    db
      .select({ eventId: driveDiarias.eventId, numero: driveDiarias.numero, conta: driveProjetos.conta, criadoEm: driveDiarias.criadoEm })
      .from(driveDiarias)
      .leftJoin(driveProjetos, eq(driveProjetos.id, driveDiarias.driveProjetoId))
      .where(inArray(driveDiarias.eventId, ids))
      .orderBy(desc(driveDiarias.criadoEm)),
    lotes ? Promise.resolve(lotes) : lotesDoProjeto(projectId),
  ]);

  return diarias.map((d) => {
    const link = links.find((l) => l.eventId === d.id);
    // O número da conta conectada; senão, o mais recente.
    const n = numeros.find((x) => x.eventId === d.id && x.conta === conta?.conta) ?? numeros.find((x) => x.eventId === d.id);
    return {
      eventId: d.id,
      data: d.date,
      titulo: d.title,
      local: d.location,
      numero: n?.numero ?? null,
      link: link ? paraDTO(link) : null,
      rolos: todos.filter((l) => l.origem === "freela" && l.eventId === d.id),
    };
  });
}

/** Quem está escalado na diária, com o WhatsApp do cadastro (só para mandar o link). */
export async function equipeDaDiaria(eventId: string): Promise<{ id: string; nome: string; telefone: string | null }[]> {
  return db
    .select({ id: freelancers.id, nome: freelancers.name, telefone: freelancers.phone })
    .from(eventCrew)
    .innerJoin(freelancers, eq(freelancers.id, eventCrew.freelancerId))
    .where(eq(eventCrew.eventId, eventId))
    .orderBy(asc(freelancers.name));
}

/* ============================== Projetos e entregas ============================== */

export type ProjetoDrive = {
  projectId: string;
  estado: string | null; // null = sem pasta na conta conectada
  pastaUrl: string | null;
  contaAntiga: boolean;
  liberadasEm: Date | null;
  liberadasPor: string | null;
};

/** Situação das pastas e das entregas de cada projeto (conta conectada; senão, a mais recente). */
export async function drivePorProjeto(projectIds: string[]): Promise<Map<string, ProjetoDrive>> {
  const mapa = new Map<string, ProjetoDrive>();
  if (!projectIds.length) return mapa;
  const conta = await contaAtual();
  const rows = await db
    .select({
      projectId: driveProjetos.projectId,
      conta: driveProjetos.conta,
      estado: driveProjetos.estado,
      pastaUrl: driveProjetos.pastaUrl,
      liberadasEm: driveProjetos.entregasLiberadasEm,
      porNome: users.name,
    })
    .from(driveProjetos)
    .leftJoin(users, eq(users.id, driveProjetos.entregasLiberadasPorId))
    .where(inArray(driveProjetos.projectId, projectIds))
    .orderBy(desc(driveProjetos.criadoEm));
  for (const id of projectIds) {
    const r = rows.find((x) => x.projectId === id && x.conta === conta?.conta) ?? rows.find((x) => x.projectId === id);
    mapa.set(id, {
      projectId: id,
      estado: r?.estado ?? null,
      pastaUrl: r?.pastaUrl ?? null,
      contaAntiga: Boolean(r && r.conta !== conta?.conta),
      liberadasEm: r?.liberadasEm ?? null,
      liberadasPor: r?.porNome ? r.porNome.split(/\s+/)[0] : null,
    });
  }
  return mapa;
}

/** Projetos do cliente (pelo cadastro do projeto), menos os cancelados. */
export async function projetosDoCliente(clientId: string) {
  return db
    .select({ id: projects.id, code: projects.code, title: projects.title, status: projects.status, startDate: projects.startDate })
    .from(projects)
    .where(and(eq(projects.clientId, clientId), ne(projects.status, "cancelado")))
    .orderBy(desc(projects.createdAt));
}

/** Contato do cliente para os textos (e-mail das entregas e WhatsApp da área). */
export async function contatoDoCliente(clientId: string | null | undefined) {
  if (!clientId) return null;
  const c = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
    columns: { id: true, name: true, email: true, phone: true, contactName: true },
  });
  return c ?? null;
}

/** Projetos com a árvore pronta na conta conectada (para "Ir para o projeto" em Arquivos). */
export async function projetosComPasta(): Promise<{ projectId: string; rotulo: string; pastaId: string }[]> {
  const conta = await contaAtual();
  if (!conta) return [];
  const rows = await db
    .select({ projectId: projects.id, code: projects.code, title: projects.title, pastaId: driveProjetos.pastaId, status: projects.status })
    .from(driveProjetos)
    .innerJoin(projects, eq(projects.id, driveProjetos.projectId))
    .where(and(eq(driveProjetos.conta, conta.conta), eq(driveProjetos.estado, "pronta"), ne(projects.status, "cancelado")))
    .orderBy(desc(projects.code))
    .limit(300);
  return rows
    .filter((r): r is typeof r & { pastaId: string } => Boolean(r.pastaId))
    .map((r) => ({ projectId: r.projectId, rotulo: `${r.code} · ${r.title}`, pastaId: r.pastaId }));
}

/* ============================== Pasta do cliente ============================== */

/**
 * Clientes/<Cliente> e "Arquivos da empresa", só do cache (drive_pastas): ver a aba não cria pasta.
 * As chaves seguem drive-pastas.ts ("cliente:<clientesId>:<clientId>" e "empresa:<pastaDoCliente>").
 */
export async function pastasDoCliente(clientId: string): Promise<{ cliente: string | null; empresa: string | null }> {
  const conexao = await dadosDaConexao();
  if (!conexao?.conectado || !conexao.conta || !conexao.clientesId) return { cliente: null, empresa: null };
  const [c] = await db
    .select({ pastaId: drivePastas.pastaId })
    .from(drivePastas)
    .where(and(eq(drivePastas.conta, conexao.conta), eq(drivePastas.chave, `cliente:${conexao.clientesId}:${clientId}`)))
    .limit(1);
  if (!c?.pastaId) return { cliente: null, empresa: null };
  const [e] = await db
    .select({ pastaId: drivePastas.pastaId })
    .from(drivePastas)
    .where(and(eq(drivePastas.conta, conexao.conta), eq(drivePastas.chave, `empresa:${c.pastaId}`)))
    .limit(1);
  return { cliente: linkPasta(c.pastaId), empresa: e?.pastaId ? linkPasta(e.pastaId) : null };
}

/* ============================== Links ============================== */

/** Um link de envio pelo id, só para conferir o tipo e o dono antes de mudar. */
export async function linkPorId(linkId: string) {
  const [l] = await db
    .select({
      id: driveLinks.id,
      tipo: driveLinks.tipo,
      eventId: driveLinks.eventId,
      projectId: driveLinks.projectId,
      clientId: driveLinks.clientId,
      revogadoEm: driveLinks.revogadoEm,
    })
    .from(driveLinks)
    .where(eq(driveLinks.id, linkId))
    .limit(1);
  return l ?? null;
}

/** Envios ainda abertos num link (para avisar antes de desativar). */
export async function lotesAbertosDoLink(linkId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(driveLotes)
    .where(and(eq(driveLotes.linkId, linkId), eq(driveLotes.estado, "aberto"), isNull(driveLotes.concluidoEm)));
  return Number(r?.n ?? 0);
}
