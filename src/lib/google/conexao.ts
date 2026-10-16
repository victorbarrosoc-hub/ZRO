import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DiagnosticoRegistro } from "@/lib/drive/protocolo";
import { googleConfigurado } from "./config";
import { abrir, ChaveErrada, selar } from "./cripto";
import { sobre, linkPasta } from "./drive";
import { GoogleError } from "./erros";
import { renovarAcesso, revogar } from "./oauth";

/**
 * A conexão da ZRO com o Google: uma linha em drive_conexao (id "zro").
 * O refresh token só existe aqui e em oauth.ts, cifrado no banco. O token de acesso fica em memória
 * (por instância) e nunca vai ao navegador.
 */

const ID = "zro";
const CONTEXTO_REFRESH = "drive_conexao.refresh:zro";
const { driveConexao } = schema;

export type StatusDrive =
  | { estado: "sem-config"; faltam: string[] }
  | { estado: "desconectado" }
  | { estado: "reconectar"; conta: string | null }
  | {
      estado: "conectado";
      conta: string;
      nome: string | null;
      raiz: { id: string; nome: string; url: string } | null;
      espaco: { usado: number; limite: number | null } | null; // limite null = espaço do Workspace sem teto informado
    };

async function linha() {
  return db.query.driveConexao.findFirst({ where: eq(driveConexao.id, ID) });
}

/** Conectado e sem pedido de reconexão (só banco, rápido). */
export async function driveConectado(): Promise<boolean> {
  if (!googleConfigurado().ok) return false;
  const l = await linha();
  return Boolean(l?.refreshTokenEnc && l.conta && l.erro !== "reconectar");
}

/** Conta conectada agora (filtra drive_pastas e drive_projetos). null = desconectado. */
export async function contaAtual(): Promise<{ conta: string; geracao: number } | null> {
  const l = await linha();
  if (!l?.refreshTokenEnc || !l.conta) return null;
  return { conta: l.conta, geracao: l.geracao };
}

let espacoCache: { em: number; conta: string; valor: { usado: number; limite: number | null } } | null = null;

/** Situação do Google para as telas (sem segredo nenhum). Espaço com cache de 60 s. */
export async function statusDrive(opcoes?: { espaco?: boolean }): Promise<StatusDrive> {
  const cfg = googleConfigurado();
  if (!cfg.ok) return { estado: "sem-config", faltam: cfg.faltam };
  const l = await linha();
  if (!l?.refreshTokenEnc || !l.conta) return { estado: "desconectado" };
  if (l.erro === "reconectar") return { estado: "reconectar", conta: l.conta };
  let espaco: { usado: number; limite: number | null } | null = null;
  if (opcoes?.espaco) {
    if (espacoCache && espacoCache.conta === l.conta && Date.now() - espacoCache.em < 60_000) {
      espaco = espacoCache.valor;
    } else {
      try {
        const s = await sobre();
        espaco = { usado: s.usado, limite: s.limite };
        espacoCache = { em: Date.now(), conta: l.conta, valor: espaco };
      } catch (e) {
        if (e instanceof GoogleError && e.motivo === "reconectar") return { estado: "reconectar", conta: l.conta };
      }
    }
  }
  return {
    estado: "conectado",
    conta: l.conta,
    nome: l.contaNome,
    raiz: l.raizId ? { id: l.raizId, nome: l.raizNome, url: linkPasta(l.raizId) } : null,
    espaco,
  };
}

/** Dados da conexão para Ajustes (sem o refresh token). */
export async function dadosDaConexao() {
  const l = await linha();
  if (!l) return null;
  return {
    conta: l.conta,
    contaNome: l.contaNome,
    geracao: l.geracao,
    raizNome: l.raizNome,
    raizId: l.raizId,
    clientesId: l.clientesId,
    conectadoEm: l.conectadoEm,
    desconectadoEm: l.desconectadoEm,
    conectado: Boolean(l.refreshTokenEnc),
    erro: l.erro,
    diagnosticos: l.diagnosticos ?? [],
  };
}

/** Grava a conexão nova. `trocar`: outra conta (a raiz é recriada nela). */
export async function salvarConexao(i: {
  refresh: string;
  conta: string;
  nome: string | null;
  escopo: string;
  userId: string;
  trocar: boolean;
}): Promise<void> {
  const enc = selar(i.refresh, CONTEXTO_REFRESH);
  const agora = new Date();
  const comum = {
    conta: i.conta,
    contaNome: i.nome,
    escopo: i.escopo,
    refreshTokenEnc: enc,
    conectadoPorId: i.userId,
    conectadoEm: agora,
    desconectadoEm: null,
    erro: null,
    erroEm: null,
  };
  const atual = await linha();
  if (!atual) {
    await db.insert(driveConexao).values({ id: ID, ...comum }).onConflictDoNothing();
  }
  await db
    .update(driveConexao)
    .set(
      i.trocar && atual
        ? { ...comum, geracao: atual.geracao + 1, raizId: null, clientesId: null }
        : comum,
    )
    .where(eq(driveConexao.id, ID));
  esquecerToken();
  espacoCache = null;
}

/** Desconecta: revoga no Google (sem quebrar se falhar) e apaga o refresh token. Nada some do Drive. */
export async function desconectar(userId: string): Promise<void> {
  void userId;
  const l = await linha();
  if (l?.refreshTokenEnc) {
    try {
      await revogar(abrir(l.refreshTokenEnc, CONTEXTO_REFRESH));
    } catch {
      // chave trocada ou Google fora: o token sai do banco do mesmo jeito
    }
  }
  await db
    .update(driveConexao)
    .set({ refreshTokenEnc: null, desconectadoEm: new Date(), erro: null, erroEm: null })
    .where(eq(driveConexao.id, ID));
  esquecerToken();
  espacoCache = null;
}

let cache: { token: string; exp: number; chave: string } | null = null;
let emCurso: Promise<string> | null = null;

/** Esquece o token de acesso em memória (401 do Google, reconexão, desconexão). */
export function esquecerToken(): void {
  cache = null;
}

async function marcarReconectar() {
  esquecerToken();
  await db.update(driveConexao).set({ erro: "reconectar", erroEm: new Date() }).where(eq(driveConexao.id, ID));
}

/**
 * Token de acesso do servidor. Cache por instância até 60 s antes de vencer; uma renovação por vez.
 * invalid_grant: grava erro='reconectar' (a cifra fica; reconectar sobrescreve).
 */
export async function tokenDeAcesso(): Promise<string> {
  const l = await linha();
  if (!l?.refreshTokenEnc) throw new GoogleError("sem_google");
  if (l.erro === "reconectar") throw new GoogleError("reconectar");
  if (cache && cache.chave === l.refreshTokenEnc && Date.now() < cache.exp - 60_000) return cache.token;
  if (emCurso) return emCurso;
  const enc = l.refreshTokenEnc;
  emCurso = (async () => {
    let refresh: string;
    try {
      refresh = abrir(enc, CONTEXTO_REFRESH);
    } catch (e) {
      if (e instanceof ChaveErrada) {
        await marcarReconectar();
        throw new GoogleError("reconectar", 0, "chave");
      }
      throw e;
    }
    try {
      const r = await renovarAcesso(refresh);
      cache = { token: r.acesso, exp: r.expiraEm, chave: enc };
      return r.acesso;
    } catch (e) {
      if (e instanceof GoogleError && e.motivo === "reconectar") await marcarReconectar();
      throw e;
    }
  })().finally(() => {
    emCurso = null;
  });
  return emCurso;
}

/**
 * Token de acesso para a prévia do painel (o service worker de /painel/stream/ lê o vídeo direto do Google).
 * Só o token de acesso (vale cerca de 1 h); o refresh token nunca sai daqui. `expiraEm` já desconta 2 min
 * e fica em no máximo 15 min: o service worker pede outro antes.
 */
export async function acessoCurto(): Promise<{ token: string; expiraEm: number }> {
  const token = await tokenDeAcesso();
  const exp = cache?.token === token ? cache.exp : Date.now() + 10 * 60_000;
  return { token, expiraEm: Math.min(exp - 2 * 60_000, Date.now() + 15 * 60_000) };
}

/** Guarda o resultado do teste de envio direto (os últimos 12). */
export async function registrarDiagnostico(registro: DiagnosticoRegistro): Promise<DiagnosticoRegistro[]> {
  const l = await linha();
  const lista = [...(l?.diagnosticos ?? []), registro].slice(-12);
  await db.update(driveConexao).set({ diagnosticos: lista }).where(eq(driveConexao.id, ID));
  return lista;
}

/** Raiz e Clientes guardados na conexão (garantirRaiz grava). */
export async function salvarRaiz(r: { raizId: string; clientesId: string; raizNome?: string }): Promise<void> {
  await db
    .update(driveConexao)
    .set({ raizId: r.raizId, clientesId: r.clientesId, ...(r.raizNome ? { raizNome: r.raizNome } : {}) })
    .where(eq(driveConexao.id, ID));
}
