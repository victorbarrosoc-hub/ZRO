import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { bytesBR } from "@/lib/drive/bytes";
import {
  acharFonte,
  DO_CLIENTE,
  nomePastaAssunto,
  nomePastaCamera,
  nomePastaGravador,
  rotuloDiaria,
  rotuloRolo,
} from "@/lib/drive/estrutura";
import { arquivosNaUltimaHora, ARQUIVOS_POR_HORA, bytesDoLink, inicioDoDia, SINAL_ATIVO_MS } from "@/lib/drive/limites";
import { idDriveValido, limparControles, nomeDeArquivo, nomePasta, segmentosDoCaminho, tipoSeguro } from "@/lib/drive/nomes";
import {
  MENSAGENS,
  respErro,
  textoLimiteDiario,
  textoLimiteLink,
  type PedidoCancelar,
  type PedidoConferir,
  type PedidoDiagnostico,
  type PedidoFecharLote,
  type PedidoIniciar,
  type PedidoLote,
  type RespCancelar,
  type RespConferir,
  type RespDiagnostico,
  type RespErro,
  type RespFecharLote,
  type RespIniciar,
  type RespLote,
  type ResultadoConferir,
  type ResultadoIniciar,
  type Voz,
} from "@/lib/drive/protocolo";
import { todayISO } from "@/lib/format";
import { contaAtual, registrarDiagnostico } from "@/lib/google/conexao";
import { abrir, ChaveErrada, selar } from "@/lib/google/cripto";
import {
  abrirSessao,
  acharPorEnvio,
  arquivoOuNull,
  cancelarSessao,
  caminhoDaPasta,
  consultarSessao,
  criarVazio,
  lixeira,
  type EstadoSessao,
} from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";
import { logClientActivity, logProjectActivity } from "./activity";
import type { LinkLinha } from "./drive-links";
import {
  diariaDoEvento,
  driveProjetoAtual,
  esquecerPasta,
  garantirArquivosDaEmpresa,
  garantirCaminho,
  garantirPasta,
  garantirPastasDoProjeto,
} from "./drive-pastas";

/**
 * Envio para o Drive (docs/dev/drive.md §5): um protocolo para painel, freela e cliente.
 * Os bytes vão do navegador direto ao Google; aqui o servidor abre a sessão (com o Origin do navegador),
 * confere e conclui. `conferir` é a única operação de estado e a conclusão é atômica
 * (UPDATE … WHERE estado='enviando' RETURNING): só quem ganhou a linha soma no lote.
 * Lote e envio são sempre buscados com o filtro do escopo; fora dele: 404.
 */

const { driveLotes, driveEnvios, driveProjetos, driveDiarias, events, eventCrew, freelancers, projects, clients } = schema;

export type Escopo =
  | { origem: "painel"; userId: string }
  | { origem: "freela"; link: LinkLinha } // tipo freela-diaria
  | { origem: "cliente"; link: LinkLinha; clientId: string }; // tipo cliente-area, cookie ok (se tiver senha)

type Lote = typeof driveLotes.$inferSelect;
type Envio = typeof driveEnvios.$inferSelect;

const SESSAO_DIAS = 6; // o Google guarda 7
const CONTEXTO_SESSAO = (id: string) => `drive_envios.sessao:${id}`;
const vozDe = (e: Escopo): Voz => (e.origem === "painel" ? "painel" : "publico");

/* ============================== Apoio ============================== */

async function emParalelo<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return saida;
}

/** GoogleError e afins → erro do protocolo, na voz do escopo. */
function erroDe(e: unknown, v: Voz): RespErro {
  if (e instanceof GoogleError) {
    switch (e.motivo) {
      case "sem_config":
      case "sem_google":
        return respErro("sem_google", v);
      case "reconectar":
        return respErro("reconectar", v);
      case "sem_espaco":
        return respErro("sem_espaco", v);
      case "limite_diario":
        return respErro("limite_diario", v);
      case "pasta":
        return respErro("pasta", v);
      default:
        return respErro(
          "google",
          v,
          v === "painel" ? `O Google recusou (${e.detalhe && /^[\w ]{1,60}$/.test(e.detalhe) ? e.detalhe : e.motivo}). Tente de novo.` : undefined,
        );
    }
  }
  console.error("[drive]", "envio", e instanceof Error ? e.name : "erro");
  return respErro("google", v);
}

function sessaoDe(row: Envio): string | null {
  if (!row.sessaoEnc) return null;
  try {
    return abrir(row.sessaoEnc, CONTEXTO_SESSAO(row.id));
  } catch (e) {
    if (e instanceof ChaveErrada) return null; // chave trocada: a sessão é dada como morta e a busca decide
    throw e;
  }
}

function filtroDoEscopo(escopo: Escopo) {
  return escopo.origem === "painel"
    ? eq(driveLotes.origem, "painel")
    : and(eq(driveLotes.origem, escopo.origem), eq(driveLotes.linkId, escopo.link.id));
}

async function loteNoEscopo(loteId: string, escopo: Escopo): Promise<Lote | undefined> {
  const [l] = await db
    .select()
    .from(driveLotes)
    .where(and(eq(driveLotes.id, loteId), filtroDoEscopo(escopo)))
    .limit(1);
  return l;
}

async function enviosNoEscopo(ids: string[], escopo: Escopo): Promise<Envio[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ e: driveEnvios })
    .from(driveEnvios)
    .innerJoin(driveLotes, eq(driveLotes.id, driveEnvios.loteId))
    .where(and(inArray(driveEnvios.id, ids), filtroDoEscopo(escopo)));
  return rows.map((r) => r.e);
}

async function somarNoLote(loteId: string, tamanho: number) {
  await db
    .update(driveLotes)
    .set({
      arquivosRecebidos: sql`${driveLotes.arquivosRecebidos} + 1`,
      bytesRecebidos: sql`${driveLotes.bytesRecebidos} + ${tamanho}`,
      ultimoSinalEm: new Date(),
    })
    .where(eq(driveLotes.id, loteId));
}

/**
 * Número do rolo, atômico: um UPDATE … RETURNING no contador jsonb do projeto (a linha fica travada
 * pelo Postgres; dois freelas ao mesmo tempo nunca recebem o mesmo número). O número não volta.
 */
export async function proximoRolo(driveProjetoId: string, letra: string): Promise<number> {
  if (!/^[A-Z]$/.test(letra)) throw new Error("letra de rolo inválida");
  const [r] = await db
    .update(driveProjetos)
    .set({
      rolos: sql`jsonb_set(${driveProjetos.rolos}, array[${letra}::text], to_jsonb(coalesce((${driveProjetos.rolos}->>${letra}::text)::int, 0) + 1))`,
      atualizadoEm: new Date(),
    })
    .where(eq(driveProjetos.id, driveProjetoId))
    .returning({ n: sql<number>`(${driveProjetos.rolos}->>${letra}::text)::int`.mapWith(Number) });
  if (!r) throw new GoogleError("google", 0, "projeto sem pastas");
  return r.n;
}

/* ============================== lote ============================== */

/** Lotes que um link público abre por hora (um cartão é um lote): acima disso é abuso, não trabalho. */
const LOTES_POR_HORA = 300;

async function lotesNaUltimaHora(linkId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(driveLotes)
    .where(and(eq(driveLotes.linkId, linkId), gt(driveLotes.criadoEm, new Date(Date.now() - 60 * 60_000))));
  return Number(r?.n ?? 0);
}

function lotePronto(l: Lote, retomado: boolean): RespLote {
  return { ok: true, loteId: l.id, rotulo: l.rotulo, caminho: l.caminho, retomado };
}

async function mesmoLote(...condicoes: Parameters<typeof and>) {
  const [l] = await db
    .select()
    .from(driveLotes)
    .where(and(...condicoes, inArray(driveLotes.estado, ["aberto", "parcial"])))
    .orderBy(desc(driveLotes.criadoEm))
    .limit(1);
  return l;
}

async function retomar(l: Lote): Promise<RespLote> {
  await db.update(driveLotes).set({ ultimoSinalEm: new Date() }).where(eq(driveLotes.id, l.id));
  return lotePronto(l, true);
}

export async function abrirLote(p: PedidoLote, escopo: Escopo, origemNavegador: string): Promise<RespLote | RespErro> {
  void origemNavegador;
  const v = vozDe(escopo);
  const d = p.destino;
  try {
    const conta = await contaAtual();
    if (!conta) return respErro("sem_google", v);
    const agora = new Date();
    const comum = {
      impressao: p.impressao,
      arquivosPrevistos: p.arquivos,
      bytesPrevistos: p.bytes,
      ultimoSinalEm: agora,
    };

    /* ---------- painel: uma pasta do Drive ---------- */
    if (escopo.origem === "painel") {
      if (d.tipo !== "pasta" || !idDriveValido(d.pastaId)) return respErro("formato", v);
      const a = await arquivoOuNull(d.pastaId);
      if (!a || !a.pasta || a.lixeira) return respErro("pasta", v);
      if (!a.podeAdicionar) return respErro("pasta", v, "A conta conectada não pode enviar para esta pasta.");
      const igual = await mesmoLote(eq(driveLotes.origem, "painel"), eq(driveLotes.pastaId, a.id), eq(driveLotes.impressao, p.impressao));
      if (igual) return retomar(igual);
      const trilha = await caminhoDaPasta(a.id).catch(() => [{ id: a.id, nome: a.nome }]);
      const [l] = await db
        .insert(driveLotes)
        .values({ ...comum, origem: "painel", userId: escopo.userId, pastaId: a.id, rotulo: a.nome || "Meu Drive", caminho: trilha.map((t) => t.nome).join(" / ") })
        .returning();
      return lotePronto(l, false);
    }

    // Links públicos: cada lote cria pastas no Drive; um teto por hora segura quem abusar do link.
    if ((await lotesNaUltimaHora(escopo.link.id)) >= LOTES_POR_HORA) return respErro("muitas_tentativas", v);

    /* ---------- freela: um cartão da diária ---------- */
    if (escopo.origem === "freela") {
      if (d.tipo !== "cartao") return respErro("formato", v);
      const link = escopo.link;
      if (link.revogadoEm || (link.expiraEm && link.expiraEm <= agora)) return respErro("link_inativo", v);
      const evento = link.eventId ? await db.query.events.findFirst({ where: eq(events.id, link.eventId) }) : undefined;
      if (!evento?.projectId) return respErro("link_inativo", v);
      const f = acharFonte(d.fonte);
      if (!f) return respErro("formato", v);

      // Quem é: alguém da escala desta diária, ou um nome digitado.
      let freelancerId: string | null = null;
      let pessoaNome: string;
      if ("freelancerId" in d.pessoa) {
        const [e] = await db
          .select({ id: freelancers.id, nome: freelancers.name })
          .from(eventCrew)
          .innerJoin(freelancers, eq(freelancers.id, eventCrew.freelancerId))
          .where(and(eq(eventCrew.eventId, evento.id), eq(eventCrew.freelancerId, d.pessoa.freelancerId)))
          .limit(1);
        if (!e) return respErro("formato", v, "Toque no seu nome para continuar.");
        freelancerId = e.id;
        pessoaNome = nomePasta(e.nome, 60);
      } else {
        const nome = d.pessoa.nome.trim();
        if (nome.length < 2 || nome.length > 60) return respErro("formato", v, "Digite o seu nome.");
        pessoaNome = nomePasta(nome, 60);
      }

      const diaria = await diariaDoEvento(evento.id, { criarPastas: f.tipo === "audio" ? "audios" : "cenas" });
      const dp = await driveProjetoAtual(evento.projectId);
      if (!dp) return respErro("sem_google", v);
      const base = [
        eq(driveLotes.origem, "freela"),
        eq(driveLotes.linkId, link.id),
        eq(driveLotes.fonte, d.fonte),
        freelancerId ? eq(driveLotes.freelancerId, freelancerId) : and(isNull(driveLotes.freelancerId), eq(driveLotes.pessoaNome, pessoaNome)),
      ];
      const registro = {
        ...comum,
        origem: "freela",
        linkId: link.id,
        projectId: evento.projectId,
        clientId: link.clientId,
        eventId: evento.id,
        diariaId: diaria.id,
        driveProjetoId: dp.id,
        freelancerId,
        pessoaNome,
        fonte: d.fonte,
        cartaoNome: limparControles(d.cartaoNome ?? "").nome.trim().slice(0, 255) || null,
      };
      const limite = async (): Promise<RespErro | null> => {
        if (link.limiteBytes == null) return null;
        const usados = await bytesDoLink(link.id);
        if (usados + p.bytes <= link.limiteBytes) return null;
        const cabem = Math.max(0, link.limiteBytes - usados);
        return respErro("limite_link", v, textoLimiteLink(bytesBR(link.limiteBytes), bytesBR(cabem)), cabem);
      };

      if (f.tipo === "audio") {
        const gravadorTexto = (d.gravador ?? "").trim();
        if (gravadorTexto.length < 2 || gravadorTexto.length > 40) return respErro("formato", v, "Diga qual é o gravador.");
        const gravador = nomePasta(gravadorTexto, 40);
        const igual = await mesmoLote(...base, eq(driveLotes.gravador, gravador), eq(driveLotes.impressao, p.impressao));
        if (igual) return retomar(igual);
        const falta = await limite();
        if (falta) return falta;
        if (!diaria.audiosPastaId) return respErro("pasta", v);
        const nomeGravador = nomePastaGravador(gravador, pessoaNome);
        const pastaId = await garantirPasta(diaria.audiosPastaId, nomeGravador);
        const [l] = await db
          .insert(driveLotes)
          .values({
            ...registro,
            gravador,
            pastaId,
            rotulo: `${gravador} · ${pessoaNome}`,
            caminho: [dp.caminho, "02 Áudios", diaria.nome, nomeGravador].filter(Boolean).join(" / "),
          })
          .returning();
        return lotePronto(l, false);
      }

      // Vídeo e foto: um rolo por cartão.
      if (d.decisao === "continuar" && d.continuarLoteId) {
        const [alvo] = await db
          .select()
          .from(driveLotes)
          .where(and(eq(driveLotes.id, d.continuarLoteId), ...base))
          .limit(1);
        if (!alvo || alvo.estado === "cancelado") return respErro("nao_encontrado", v);
        const [l] = await db
          .update(driveLotes)
          .set({ ...comum, estado: "aberto", cartaoNome: registro.cartaoNome ?? alvo.cartaoNome, concluidoEm: null })
          .where(eq(driveLotes.id, alvo.id))
          .returning();
        return lotePronto(l, true);
      }
      if (d.decisao !== "novo") {
        const igual = await mesmoLote(...base, eq(driveLotes.impressao, p.impressao));
        if (igual) return retomar(igual);
        if (registro.cartaoNome) {
          const [recente] = await db
            .select()
            .from(driveLotes)
            .where(
              and(
                ...base,
                eq(driveLotes.cartaoNome, registro.cartaoNome),
                ne(driveLotes.estado, "cancelado"),
                gt(driveLotes.criadoEm, new Date(agora.getTime() - 24 * 60 * 60_000)),
              ),
            )
            .orderBy(desc(driveLotes.criadoEm))
            .limit(1);
          if (recente) {
            return {
              ok: true,
              pergunta: { loteId: recente.id, rotulo: recente.rolo ?? recente.rotulo, arquivos: recente.arquivosRecebidos, bytes: recente.bytesRecebidos },
            };
          }
        }
      }
      const falta = await limite();
      if (falta) return falta;
      if (!diaria.cenasPastaId || !f.letra) return respErro("pasta", v);
      const n = await proximoRolo(dp.id, f.letra);
      const rolo = rotuloRolo(f.letra, n);
      const nomeCamera = nomePastaCamera(f.rotulo, pessoaNome);
      const pastaCamera = await garantirPasta(diaria.cenasPastaId, nomeCamera);
      const descricao = registro.cartaoNome ? `Cartão ${registro.cartaoNome} · enviado por ${pessoaNome}` : `Enviado por ${pessoaNome}`;
      const pastaId = await garantirPasta(pastaCamera, rolo, { descricao });
      const [l] = await db
        .insert(driveLotes)
        .values({
          ...registro,
          rolo,
          pastaId,
          rotulo: `${rolo} · ${f.rotulo} · ${pessoaNome}`,
          caminho: [dp.caminho, "01 Cenas", diaria.nome, nomeCamera, rolo].filter(Boolean).join(" / "),
        })
        .returning();
      return lotePronto(l, false);
    }

    /* ---------- cliente: arquivos para a ZRO ---------- */
    if (d.tipo !== "cliente") return respErro("formato", v);
    const link = escopo.link;
    if (link.revogadoEm || (link.expiraEm && link.expiraEm <= agora)) return respErro("link_inativo", v);
    if (d.consentimento !== true) return respErro("consentimento", v);
    const assunto = d.assunto.trim();
    if (assunto.length < 2 || assunto.length > 80) return respErro("formato", v, "Diga do que se trata (ex.: manual de marca).");
    const cliente = await db.query.clients.findFirst({ where: eq(clients.id, escopo.clientId), columns: { id: true, name: true } });
    if (!cliente) return respErro("link_inativo", v);

    let baseId: string;
    let caminhoBase: string;
    let projectId: string | null = null;
    let driveProjetoId: string | null = null;
    if (d.projetoId) {
      const projeto = await db.query.projects.findFirst({
        where: and(eq(projects.id, d.projetoId), eq(projects.clientId, escopo.clientId), ne(projects.status, "cancelado")),
      });
      if (!projeto) return respErro("nao_encontrado", v);
      const r = await garantirPastasDoProjeto(projeto.id);
      if (!r.ok) return respErro(r.erro === "reconectar" ? "reconectar" : r.erro === "sem_google" ? "sem_google" : "google", v);
      const dp = await driveProjetoAtual(projeto.id);
      const doCliente = dp?.subpastas?.[DO_CLIENTE];
      if (!dp || !doCliente) return respErro("pasta", v);
      baseId = doCliente;
      caminhoBase = [dp.caminho, "03 Assets", "Do cliente"].filter(Boolean).join(" / ");
      projectId = projeto.id;
      driveProjetoId = dp.id;
    } else {
      baseId = await garantirArquivosDaEmpresa(cliente.id);
      caminhoBase = `${cliente.name} / Arquivos da empresa`;
    }
    const nomeAssunto = nomePastaAssunto(todayISO(), assunto);
    const pastaId = await garantirPasta(baseId, nomeAssunto);
    const igual = await mesmoLote(
      eq(driveLotes.origem, "cliente"),
      eq(driveLotes.linkId, link.id),
      eq(driveLotes.pastaId, pastaId),
      eq(driveLotes.impressao, p.impressao),
    );
    if (igual) return retomar(igual);
    if (link.limiteBytes != null) {
      const usados = await bytesDoLink(link.id, inicioDoDia());
      if (usados + p.bytes > link.limiteBytes) {
        const cabem = Math.max(0, link.limiteBytes - usados);
        return respErro("limite_link", v, textoLimiteDiario(bytesBR(cabem)), cabem);
      }
    }
    const [l] = await db
      .insert(driveLotes)
      .values({
        ...comum,
        origem: "cliente",
        linkId: link.id,
        clientId: cliente.id,
        projectId,
        driveProjetoId,
        assunto,
        rotulo: assunto,
        consentimentoEm: agora,
        pastaId,
        caminho: `${caminhoBase} / ${nomeAssunto}`,
      })
      .returning();
    return lotePronto(l, false);
  } catch (e) {
    if (e instanceof GoogleError && e.motivo === "nao_encontrado" && escopo.origem === "freela") return respErro("link_inativo", v);
    return erroDe(e, v);
  }
}

/* ============================== iniciar ============================== */

export async function iniciarArquivos(p: PedidoIniciar, escopo: Escopo, origemNavegador: string): Promise<RespIniciar | RespErro> {
  const v = vozDe(escopo);
  const lote = await loteNoEscopo(p.loteId, escopo);
  if (!lote || lote.estado === "cancelado") return respErro("nao_encontrado", v);
  // Link revogado para de aceitar arquivo novo; expirado depois do início do lote ainda aceita.
  if (escopo.origem !== "painel" && escopo.link.revogadoEm) return respErro("link_inativo", v);
  if (!(await contaAtual())) return respErro("sem_google", v);
  if (escopo.origem !== "painel" && (await arquivosNaUltimaHora(escopo.link.id)) + p.arquivos.length > ARQUIVOS_POR_HORA) {
    return respErro("muitas_tentativas", v);
  }

  // Pastas do cartão: uma busca por prefixo neste pedido ("DCIM", "DCIM/100CANON"…).
  const memo = new Map<string, Promise<string>>([["", Promise.resolve(lote.pastaId)]]);
  const pastaDe = (segs: string[]): Promise<string> => {
    let chave = "";
    let atual = memo.get("")!;
    for (const seg of segs) {
      const pai = atual;
      chave += `/${seg}`;
      if (!memo.has(chave)) memo.set(chave, pai.then((id) => garantirPasta(id, seg)));
      atual = memo.get(chave)!;
    }
    return atual;
  };

  const resultados = await emParalelo(p.arquivos, 6, (a) => iniciarUm(a, lote, origemNavegador, pastaDe, v));
  const agora = new Date();
  const abriuAlgo = resultados.some((r) => r.ok && r.estado === "enviar");
  await db
    .update(driveLotes)
    .set({ ultimoSinalEm: agora, ...(abriuAlgo && lote.estado !== "aberto" ? { estado: "aberto", concluidoEm: null } : {}) })
    .where(eq(driveLotes.id, lote.id));
  if (escopo.origem !== "painel") await db.update(schema.driveLinks).set({ ultimoUsoEm: agora }).where(eq(schema.driveLinks.id, escopo.link.id));
  return { ok: true, resultados };
}

async function iniciarUm(
  a: PedidoIniciar["arquivos"][number],
  lote: Lote,
  origemNavegador: string,
  pastaDe: (segs: string[]) => Promise<string>,
  v: Voz,
): Promise<ResultadoIniciar> {
  let envioId: string | null = null;
  try {
    const { nome, mudou } = nomeDeArquivo(a.nome);
    const segs = segmentosDoCaminho(a.caminho);
    const caminhoRelativo = segs.join("/");
    const tipo = tipoSeguro(a.tipo);
    const tamanho = a.tamanho;
    const modificado = a.modificado ?? null;
    const agora = new Date();
    let pastaFinal = await pastaDe(segs);

    // Já recebido (nesta pasta, com o mesmo nome e tamanho): não sobe de novo.
    const [ja] = await db
      .select()
      .from(driveEnvios)
      .where(and(eq(driveEnvios.pastaId, pastaFinal), eq(driveEnvios.nome, nome), eq(driveEnvios.tamanho, tamanho), eq(driveEnvios.estado, "concluido")))
      .orderBy(sql`case when ${driveEnvios.loteId} = ${lote.id} then 0 else 1 end`, asc(driveEnvios.criadoEm))
      .limit(1);
    if (ja) {
      if (ja.loteId === lote.id) return { chave: a.chave, ok: true, envioId: ja.id, estado: "concluido", jaRecebido: true };
      // Chegou por outro envio: registra também neste lote (conta como chegado no cartão).
      const [copia] = await db
        .insert(driveEnvios)
        .values({
          loteId: lote.id,
          pastaId: pastaFinal,
          caminhoRelativo,
          nome,
          nomeOriginal: mudou ? a.nome : null,
          tipo,
          tamanho,
          modificado,
          estado: "concluido",
          arquivoId: ja.arquivoId,
          md5: ja.md5,
          concluidoEm: agora,
          ultimoSinalEm: agora,
        })
        .returning({ id: driveEnvios.id });
      await somarNoLote(lote.id, tamanho);
      return { chave: a.chave, ok: true, envioId: copia.id, estado: "concluido", jaRecebido: true };
    }

    // Retomada: a mesma linha deste lote (caminho, nome, tamanho; data quando os dois lados têm).
    const candidatos = await db
      .select()
      .from(driveEnvios)
      .where(
        and(
          eq(driveEnvios.loteId, lote.id),
          eq(driveEnvios.caminhoRelativo, caminhoRelativo),
          eq(driveEnvios.nome, nome),
          eq(driveEnvios.tamanho, tamanho),
          inArray(driveEnvios.estado, ["enviando", "expirado", "falhou"]),
        ),
      )
      .orderBy(desc(driveEnvios.criadoEm));
    const linha = candidatos.find((c) => c.modificado == null || modificado == null || Number(c.modificado) === modificado);
    if (linha) {
      envioId = linha.id;
      const sessao = linha.estado === "enviando" ? sessaoDe(linha) : null;
      if (sessao) {
        // Nunca devolve uma sessão sem antes perguntar ao Google (uma URI morta não volta ao navegador).
        const st = await consultarSessao(sessao, tamanho);
        if (st.estado === "concluido") {
          const r = await concluir(linha, st.id, v);
          if (r.estado === "concluido") return { chave: a.chave, ok: true, envioId: linha.id, estado: "concluido", jaRecebido: false };
          return { chave: a.chave, ok: false, erro: "conferencia", mensagem: MENSAGENS[v].conferencia };
        }
        const vence = linha.sessaoExpiraEm && linha.sessaoExpiraEm.getTime() < Date.now();
        if (st.estado === "parcial" && !vence) {
          await db.update(driveEnvios).set({ ultimoSinalEm: agora }).where(eq(driveEnvios.id, linha.id));
          return { chave: a.chave, ok: true, envioId: linha.id, estado: "enviar", sessao, offset: st.offset, retomado: true };
        }
        if (st.estado === "parcial") await cancelarSessao(sessao); // perto de vencer no Google: começa outra
      }
      await db
        .update(driveEnvios)
        .set({ estado: "enviando", erro: null, sessaoEnc: null, pastaId: pastaFinal, tipo, modificado, ultimoSinalEm: agora })
        .where(eq(driveEnvios.id, linha.id));
    } else {
      const [nova] = await db
        .insert(driveEnvios)
        .values({
          loteId: lote.id,
          pastaId: pastaFinal,
          caminhoRelativo,
          nome,
          nomeOriginal: mudou ? a.nome : null,
          tipo,
          tamanho,
          modificado,
          estado: "enviando",
          ultimoSinalEm: agora,
        })
        .returning({ id: driveEnvios.id });
      envioId = nova.id;
    }
    const id = envioId;

    // Pai que sumiu do Drive: esquece o cache e tenta uma vez de novo.
    const comPasta = async <T,>(fazer: (pasta: string) => Promise<T>): Promise<T> => {
      try {
        return await fazer(pastaFinal);
      } catch (e) {
        if (!(e instanceof GoogleError && e.motivo === "pasta")) throw e;
        await esquecerPasta(pastaFinal);
        pastaFinal = await garantirCaminho(lote.pastaId, segs);
        await db.update(driveEnvios).set({ pastaId: pastaFinal }).where(eq(driveEnvios.id, id));
        return fazer(pastaFinal);
      }
    };

    // 0 byte: só metadados, concluído na hora.
    if (tamanho === 0) {
      const r = await comPasta((pasta) => criarVazio(nome, pasta, { zroEnvio: id }));
      const [ganhou] = await db
        .update(driveEnvios)
        .set({ estado: "concluido", arquivoId: r.id, md5: r.md5, concluidoEm: new Date(), sessaoEnc: null })
        .where(and(eq(driveEnvios.id, id), eq(driveEnvios.estado, "enviando")))
        .returning({ id: driveEnvios.id });
      if (ganhou) await somarNoLote(lote.id, 0);
      return { chave: a.chave, ok: true, envioId: id, estado: "concluido", jaRecebido: false };
    }

    const aberta = await comPasta((pasta) =>
      abrirSessao({ nome, tipo, tamanho, paiId: pasta, origem: origemNavegador, envioId: id }),
    );
    await db
      .update(driveEnvios)
      .set({
        sessaoEnc: selar(aberta.sessao, CONTEXTO_SESSAO(id)),
        sessaoExpiraEm: new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60_000),
        sessaoHost: aberta.host,
        ultimoSinalEm: new Date(),
      })
      .where(eq(driveEnvios.id, id));
    return { chave: a.chave, ok: true, envioId: id, estado: "enviar", sessao: aberta.sessao, offset: 0, retomado: false };
  } catch (e) {
    const r = erroDe(e, v);
    if (envioId) {
      await db
        .update(driveEnvios)
        .set({ estado: "falhou", erro: r.erro, sessaoEnc: null })
        .where(and(eq(driveEnvios.id, envioId), eq(driveEnvios.estado, "enviando")))
        .catch(() => {});
    }
    return { chave: a.chave, ok: false, erro: r.erro, mensagem: r.mensagem };
  }
}

/* ============================== conferir ============================== */

/**
 * Confere no Drive e conclui (atômico). O id do arquivo vem da sessão ou da busca por appProperties,
 * nunca do navegador. Não bateu (pasta, tamanho, lixeira): falhou. Nada é apagado no Drive.
 */
async function concluir(row: Envio, arquivoId: string, v: Voz): Promise<ResultadoConferir> {
  const a = await arquivoOuNull(arquivoId, "id,mimeType,size,md5Checksum,parents,trashed");
  const bate = !!a && !a.lixeira && a.pais.includes(row.pastaId) && (a.tamanho ?? 0) === Number(row.tamanho);
  if (!a || !bate) {
    await db
      .update(driveEnvios)
      .set({ estado: "falhou", erro: "conferencia", sessaoEnc: null, arquivoId })
      .where(and(eq(driveEnvios.id, row.id), eq(driveEnvios.estado, "enviando")));
    return { envioId: row.id, estado: "falhou", mensagem: MENSAGENS[v].conferencia };
  }
  const agora = new Date();
  const [ganhou] = await db
    .update(driveEnvios)
    .set({ estado: "concluido", arquivoId, md5: a.md5, concluidoEm: agora, sessaoEnc: null, erro: null, ultimoSinalEm: agora })
    .where(and(eq(driveEnvios.id, row.id), eq(driveEnvios.estado, "enviando")))
    .returning({ id: driveEnvios.id });
  if (ganhou && row.loteId) await somarNoLote(row.loteId, Number(row.tamanho));
  return { envioId: row.id, estado: "concluido" };
}

async function conferirUm(row: Envio, v: Voz): Promise<ResultadoConferir> {
  switch (row.estado) {
    case "concluido":
      return { envioId: row.id, estado: "concluido" };
    case "cancelado":
      return { envioId: row.id, estado: "cancelado" };
    case "expirado":
      return { envioId: row.id, estado: "expirado" };
    case "falhou":
      return { envioId: row.id, estado: "falhou", mensagem: row.erro === "conferencia" ? MENSAGENS[v].conferencia : MENSAGENS[v].google };
  }
  const sessao = sessaoDe(row);
  const st: EstadoSessao = sessao ? await consultarSessao(sessao, Number(row.tamanho)) : { estado: "morta" };
  if (st.estado === "concluido") return concluir(row, st.id, v);
  if (st.estado === "parcial") {
    await db.update(driveEnvios).set({ ultimoSinalEm: new Date() }).where(eq(driveEnvios.id, row.id));
    return { envioId: row.id, estado: "parcial", offset: st.offset };
  }
  // Sessão morta: o arquivo pode ter chegado (resposta final perdida). Procura antes de desistir.
  const achado = await acharPorEnvio(row.id, row.pastaId, { nome: row.nome, tamanho: Number(row.tamanho) });
  if (achado && achado.tamanho === Number(row.tamanho)) return concluir(row, achado.id, v);
  await db
    .update(driveEnvios)
    .set({ estado: "expirado", sessaoEnc: null })
    .where(and(eq(driveEnvios.id, row.id), eq(driveEnvios.estado, "enviando")));
  return { envioId: row.id, estado: "expirado" };
}

export async function conferirEnvios(p: PedidoConferir, escopo: Escopo): Promise<RespConferir | RespErro> {
  const v = vozDe(escopo);
  const ids = [...new Set(p.envioIds)];
  const rows = await enviosNoEscopo(ids, escopo);
  if (rows.length !== ids.length) return respErro("nao_encontrado", v);
  try {
    const porId = new Map(rows.map((r) => [r.id, r]));
    const resultados = await emParalelo(ids, 6, (id) => conferirUm(porId.get(id)!, v));
    return { ok: true, resultados };
  } catch (e) {
    return erroDe(e, v);
  }
}

/* ============================== cancelar ============================== */

/** Cancela uma linha: pergunta antes; se o arquivo já chegou, conclui em vez de cancelar. */
async function cancelarUm(row: Envio, v: Voz): Promise<"cancelado" | "concluido" | "nada"> {
  if (row.estado !== "enviando") return "nada";
  const sessao = sessaoDe(row);
  if (sessao) {
    try {
      const st = await consultarSessao(sessao, Number(row.tamanho));
      if (st.estado === "concluido") {
        const r = await concluir(row, st.id, v);
        if (r.estado === "concluido") return "concluido";
      }
    } catch {
      // Google fora: cancela mesmo assim (se o arquivo tiver chegado, ele continua no Drive)
    }
    await cancelarSessao(sessao);
  }
  const [r] = await db
    .update(driveEnvios)
    .set({ estado: "cancelado", sessaoEnc: null })
    .where(and(eq(driveEnvios.id, row.id), eq(driveEnvios.estado, "enviando")))
    .returning({ id: driveEnvios.id });
  return r ? "cancelado" : "nada";
}

export async function cancelarEnvios(p: PedidoCancelar, escopo: Escopo): Promise<RespCancelar | RespErro> {
  const v = vozDe(escopo);
  const ids = [...new Set(p.envioIds)];
  const rows = await enviosNoEscopo(ids, escopo);
  if (rows.length !== ids.length) return respErro("nao_encontrado", v);
  const r = await emParalelo(rows, 6, (row) => cancelarUm(row, v));
  return { ok: true, cancelados: r.filter((x) => x === "cancelado").length, concluidos: r.filter((x) => x === "concluido").length };
}

/** Desativar link com "Cancelar os envios em andamento". Devolve quantos foram cancelados. */
export async function cancelarEnviosDoLink(linkId: string): Promise<number> {
  const rows = (
    await db
      .select({ e: driveEnvios })
      .from(driveEnvios)
      .innerJoin(driveLotes, eq(driveLotes.id, driveEnvios.loteId))
      .where(and(eq(driveLotes.linkId, linkId), eq(driveEnvios.estado, "enviando")))
  ).map((r) => r.e);
  const r = await emParalelo(rows, 6, (row) => cancelarUm(row, "publico"));
  for (const loteId of new Set(rows.map((x) => x.loteId).filter((x): x is string => !!x))) {
    await fecharLoteInterno(loteId).catch(() => {});
  }
  return r.filter((x) => x === "cancelado").length;
}

/* ============================== fecharLote ============================== */

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Histórico do CRM (uma vez por lote, travado por avisadoEm). */
async function gravarHistorico(l: Lote, arquivos: number, bytes: number, faltam: number) {
  const resumo = `${plural(arquivos, "arquivo", "arquivos")}, ${bytesBR(bytes)}${faltam > 0 ? ` (faltaram ${plural(faltam, "arquivo", "arquivos")})` : ""}.`;
  if (l.origem === "freela") {
    const d = l.diariaId ? await db.query.driveDiarias.findFirst({ where: eq(driveDiarias.id, l.diariaId) }) : undefined;
    const diaria = d ? ` · ${rotuloDiaria(d.numero)}` : "";
    const quem = l.pessoaNome ?? "Freela";
    const texto =
      l.fonte === "gravador"
        ? `${quem} enviou o áudio do ${l.gravador ?? "gravador"}${diaria}: ${resumo}`
        : `${quem} enviou o rolo ${l.rolo ?? ""} · ${acharFonte(l.fonte)?.rotulo ?? ""}${diaria}: ${resumo}`;
    await logProjectActivity(l.projectId, "arquivos", texto);
    return;
  }
  if (l.origem === "cliente") {
    const cliente = l.clientId ? await db.query.clients.findFirst({ where: eq(clients.id, l.clientId), columns: { name: true } }) : undefined;
    const texto = `${cliente?.name ?? "O cliente"} enviou “${l.assunto ?? l.rotulo}”: ${resumo}`;
    if (l.projectId) await logProjectActivity(l.projectId, "arquivos", texto);
    else await logClientActivity(l.clientId, "arquivos", texto);
  }
}

async function fecharLoteInterno(loteId: string, cancelou = false): Promise<RespFecharLote> {
  const [c] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      concluidos: sql<number>`count(*) filter (where ${driveEnvios.estado} = 'concluido')`.mapWith(Number),
      bytes: sql<number>`coalesce(sum(${driveEnvios.tamanho}) filter (where ${driveEnvios.estado} = 'concluido'), 0)`.mapWith(Number),
      cancelados: sql<number>`count(*) filter (where ${driveEnvios.estado} = 'cancelado')`.mapWith(Number),
    })
    .from(driveEnvios)
    .where(eq(driveEnvios.loteId, loteId));
  const l = await db.query.driveLotes.findFirst({ where: eq(driveLotes.id, loteId) });
  if (!l) throw new Error("lote");
  const concluidos = Number(c?.concluidos ?? 0);
  const bytes = Number(c?.bytes ?? 0);
  const faltam = Math.max(0, l.arquivosPrevistos - concluidos);
  const estado: RespFecharLote["estado"] =
    faltam === 0 && concluidos > 0
      ? "concluido"
      : concluidos === 0 && (cancelou || Number(c?.cancelados ?? 0) > 0 || Number(c?.total ?? 0) === 0)
        ? "cancelado"
        : "parcial";
  const agora = new Date();
  await db
    .update(driveLotes)
    .set({ estado, arquivosRecebidos: concluidos, bytesRecebidos: bytes, concluidoEm: estado === "concluido" ? agora : null, ultimoSinalEm: agora })
    .where(eq(driveLotes.id, loteId));
  if (l.origem !== "painel" && estado !== "cancelado" && concluidos > 0) {
    const [aviso] = await db
      .update(driveLotes)
      .set({ avisadoEm: agora })
      .where(and(eq(driveLotes.id, loteId), isNull(driveLotes.avisadoEm)))
      .returning({ id: driveLotes.id });
    if (aviso) await gravarHistorico(l, concluidos, bytes, faltam).catch(() => {});
  }
  return { ok: true, estado, arquivos: concluidos, bytes, faltam };
}

export async function fecharLote(p: PedidoFecharLote, escopo: Escopo): Promise<RespFecharLote | RespErro> {
  const v = vozDe(escopo);
  const l = await loteNoEscopo(p.loteId, escopo);
  if (!l) return respErro("nao_encontrado", v);
  try {
    return await fecharLoteInterno(l.id);
  } catch (e) {
    return erroDe(e, v);
  }
}

/* ============================== conciliação ============================== */

/**
 * Sem cron: roda com after() quando o painel abre Arquivos ou a aba Drive. Envios sem sinal há mais
 * de 2 h: o mesmo caminho do conferir (consulta, busca por appProperties, conclui ou marca expirado).
 * Nenhuma linha vira "expirado" sem perguntar ao Google antes. Lote sem nada pendente é fechado.
 */
export async function conciliarParados(limite = 20): Promise<number> {
  if (!(await contaAtual())) return 0;
  const corte = new Date(Date.now() - SINAL_ATIVO_MS);
  const rows = await db
    .select()
    .from(driveEnvios)
    .where(and(eq(driveEnvios.estado, "enviando"), or(isNull(driveEnvios.ultimoSinalEm), lt(driveEnvios.ultimoSinalEm, corte))))
    .orderBy(sql`random()`)
    .limit(limite);
  const lotes = new Set<string>();
  let feitos = 0;
  for (const row of rows) {
    try {
      const sessao = sessaoDe(row);
      const st: EstadoSessao = sessao ? await consultarSessao(sessao, Number(row.tamanho)) : { estado: "morta" };
      if (st.estado === "concluido") {
        await concluir(row, st.id, "painel");
      } else if (st.estado === "parcial") {
        // Ainda dá para retomar. Perto de vencer no Google: encerra (já perguntou).
        if (row.sessaoExpiraEm && row.sessaoExpiraEm.getTime() < Date.now() && sessao) {
          await cancelarSessao(sessao);
          await db
            .update(driveEnvios)
            .set({ estado: "expirado", sessaoEnc: null })
            .where(and(eq(driveEnvios.id, row.id), eq(driveEnvios.estado, "enviando")));
        } else continue;
      } else {
        await conferirUm({ ...row, sessaoEnc: null }, "painel");
      }
      feitos++;
      if (row.loteId) lotes.add(row.loteId);
    } catch {
      // Google fora: fica para a próxima
    }
  }
  // Lotes parados sem nada pendente.
  const parados = await db
    .select({ id: driveLotes.id })
    .from(driveLotes)
    .where(
      and(
        eq(driveLotes.estado, "aberto"),
        lt(driveLotes.ultimoSinalEm, corte),
        sql`not exists (select 1 from ${driveEnvios} where ${driveEnvios.loteId} = ${driveLotes.id} and ${driveEnvios.estado} = 'enviando')`,
      ),
    )
    .limit(limite);
  for (const l of parados) lotes.add(l.id);
  for (const loteId of lotes) {
    const [pendente] = await db
      .select({ id: driveEnvios.id })
      .from(driveEnvios)
      .where(and(eq(driveEnvios.loteId, loteId), eq(driveEnvios.estado, "enviando")))
      .limit(1);
    if (!pendente) await fecharLoteInterno(loteId).catch(() => {});
  }
  return feitos;
}

/** O painel já mostrou estes lotes (tira o ponto de "novo"). */
export async function marcarLotesVistos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db
    .update(driveLotes)
    .set({ vistoEm: new Date() })
    .where(and(inArray(driveLotes.id, ids.slice(0, 200)), isNull(driveLotes.vistoEm)));
}

/* ============================== diagnóstico ============================== */

/**
 * Depois do teste de Ajustes: manda o arquivo de teste para a lixeira (nunca apaga de vez) e guarda o
 * resultado (os últimos 12). O host vem do servidor quando ele sabe; a sessão nunca aparece.
 */
export async function diagnosticoEnvio(p: PedidoDiagnostico, escopo: Escopo): Promise<RespDiagnostico | RespErro> {
  if (escopo.origem !== "painel") return respErro("sem_acesso", "publico");
  let [row] = await enviosNoEscopo([p.envioId], escopo);
  if (!row) return respErro("nao_encontrado", "painel");
  // Teste que não chegou ao fim: a sessão é cancelada no Google (ou concluída, se chegou).
  if (row.estado === "enviando") {
    await cancelarUm(row, "painel").catch(() => "nada");
    [row] = await enviosNoEscopo([p.envioId], escopo);
  }
  // O arquivo de teste vai para a lixeira (nunca apagado de vez).
  if (row.arquivoId) await lixeira(row.arquivoId).catch(() => {});
  const r = p.resultado;
  const registro = {
    preflight: r.preflight,
    viu308: r.viu308,
    rangeLegivel: r.rangeLegivel,
    finalLegivel: r.finalLegivel,
    host: (row.sessaoHost ?? r.host).slice(0, 100),
    navegador: r.navegador.slice(0, 40),
    em: new Date().toISOString(),
    ok: r.preflight && r.viu308,
    conferido: row.estado === "concluido",
  };
  await registrarDiagnostico(registro);
  return { ok: true, registro };
}

/* ============================== resumos para Ajustes ============================== */

/** "Enviado nas últimas 24 h" e quantos envios estão em andamento (com sinal nas últimas 2 h). */
export async function resumoDeEnvios(): Promise<{ bytes24h: number; emAndamento: number }> {
  const desde = new Date(Date.now() - 24 * 60 * 60_000);
  const ativo = new Date(Date.now() - SINAL_ATIVO_MS);
  const [r] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${driveEnvios.tamanho}) filter (where ${driveEnvios.estado} = 'concluido' and ${driveEnvios.concluidoEm} > ${desde.toISOString()}::timestamptz), 0)`.mapWith(Number),
      andamento: sql<number>`count(*) filter (where ${driveEnvios.estado} = 'enviando' and ${driveEnvios.ultimoSinalEm} > ${ativo.toISOString()}::timestamptz)`.mapWith(Number),
    })
    .from(driveEnvios)
    .where(or(gt(driveEnvios.concluidoEm, desde), eq(driveEnvios.estado, "enviando")));
  return { bytes24h: Number(r?.bytes ?? 0), emAndamento: Number(r?.andamento ?? 0) };
}
