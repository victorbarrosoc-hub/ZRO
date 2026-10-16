/**
 * Motor de envio no navegador: arquivos direto do aparelho para o Google Drive, pela sessão retomável
 * que o servidor da ZRO abre (docs/dev/drive.md §6).
 *
 * Porte em TypeScript da lógica de mobile/lib/uploader.js do SOBEDESCE (decisões de Range, recuo, vigia
 * de travamento, mensagens), com as correções do plano:
 *  - 308 sem Range é DESCONHECIDO, não zero: quem não sabe pergunta ao servidor (`conferir`), que lê o
 *    Range sem CORS. Zero só quando o aparelho já mostrou Range antes e o ponto confirmado era 0.
 *  - 404/410 na sessão: `conferir` primeiro (o arquivo pode ter chegado); só então `iniciar` de novo.
 *  - Todo arquivo termina com `conferir`: quem conclui é o servidor (a resposta final pode vir sem CORS).
 *  - 308 que não avança depois de um PUT completo é o bug 319985 do WebKit (corpo vazio): o arquivo passa
 *    a ir por cópia em memória, pedaço a pedaço.
 *  - Nada de URI de sessão guardada no aparelho: a retomada depois de recarregar é pelo mesmo cartão.
 * Um lote por cartão/pasta/seleção; até `paralelos` arquivos ao mesmo tempo; partes de um arquivo, nunca.
 */
import { ALINHAMENTO, fimDoPedaco, lerRange, type Destino, type ResultadoConferir, type ResultadoDiagnostico, type ResultadoIniciar, type RespErro, type Voz } from "../protocolo";
import { navegadorResumido, ehIOS, paralelosPadrao, pedacoPadrao } from "./plataforma";
import { Abortado, redeFetch, redeXHR, type Rede, type RespostaPut } from "./rede";
import { esquecerLote, lerSalvos, marcarRangeVisto, rangeJaVisto, salvarLotes, type LoteSalvo } from "./retomar";
import { impressao as calcularImpressao, type Selecao } from "./selecao";
import { manterTelaAcesa } from "./tela-acesa";
import { FalhaDeRede, type Transporte } from "./transporte";

export type EstadoItem =
  | "fila"
  | "preparando"
  | "enviando"
  | "pausado"
  | "conferindo"
  | "concluido"
  | "ja-recebido"
  | "erro"
  | "cancelado";

export type ItemFila = {
  chave: string;
  lote: string;
  envioId: string | null;
  nome: string;
  caminho: string;
  tamanho: number;
  enviado: number;
  estado: EstadoItem;
  nota: string | null;
  erro: string | null;
};

export type LoteFila = {
  chave: string;
  loteId: string | null;
  rotulo: string | null;
  caminho: string | null;
  estado: "preparando" | "pergunta" | "enviando" | "pausado" | "concluido" | "parcial" | "erro" | "cancelado";
  arquivos: number;
  bytes: number;
  recebidos: number;
  bytesEnviados: number;
  ignorados: string[];
  pergunta: { loteId: string; rotulo: string } | null;
  erro: string | null;
};

export type Foto = {
  lotes: LoteFila[];
  itens: ItemFila[];
  total: { bytes: number; enviados: number; velocidade: number; restante: number | null };
  ativo: boolean;
  semInternet: boolean;
  precisaEntrar: boolean;
  retomaveis: LoteSalvo[];
  diagnostico: ResultadoDiagnostico | null;
  /** Aviso único da fila (limite diário, Drive cheio, Google desconectado, link inativo). */
  aviso: string | null;
};

export interface Motor {
  /** Devolve a chave do lote. */
  adicionar(selecao: Selecao, destino: Destino): string;
  responder(lote: string, decisao: "continuar" | "novo"): void;
  pausar(chave?: string): void;
  continuar(chave?: string): void;
  cancelar(chave: string): void;
  tentarDeNovo(chave?: string): void;
  limparConcluidos(): void;
  assinar(fn: () => void): () => void;
  foto(): Foto;
  destruir(): void;
}

export type OpcoesMotor = {
  transporte: Transporte;
  /** Nome do registro de retomada no aparelho ("painel", "enviar:<linkId>"…). */
  escopo: string;
  voz: Voz;
  rede?: Rede;
  paralelos?: number;
  /** Só testes e diagnóstico (ex.: 0,25 = 256 KiB). */
  pedacoMiB?: number;
  diagnostico?: boolean;
  /** Base do recuo entre tentativas (padrão 1 s; os testes usam menos). */
  recuoBaseMs?: number;
};

export const FOTO_VAZIA: Foto = Object.freeze({
  lotes: [],
  itens: [],
  total: { bytes: 0, enviados: 0, velocidade: 0, restante: null },
  ativo: false,
  semInternet: false,
  precisaEntrar: false,
  retomaveis: [],
  diagnostico: null,
  aviso: null,
}) as Foto;

/* ============================== Textos ============================== */

const TEXTOS = {
  painel: {
    rede: "A conexão caiu várias vezes. Toque em Tentar de novo: continua de onde parou.",
    semInternet: "Sem internet. Continua sozinho quando a conexão voltar.",
    recomeco: "O envio expirou no Google; recomeçando este arquivo.",
    recomecos: "O Google encerrou este envio várias vezes. Toque em Tentar de novo.",
    webkit: "Este navegador não conseguiu ler o arquivo. Tente pelo Chrome no computador.",
    espaco: "O Drive está cheio. Libere espaço e tente de novo.",
    limite: "O Google limita 750 GB de envio por dia. Libera em até 24 horas.",
    nada: "Nada para enviar: só havia arquivos do sistema.",
    falhou: "Não deu para enviar este arquivo. Toque em Tentar de novo.",
    instavel: "Conexão instável. Tentando de novo.",
  },
  publico: {
    rede: "Não deu para enviar este arquivo. Toque em Tentar de novo: continua de onde parou.",
    semInternet: "Sem internet. O envio continua sozinho quando a conexão voltar.",
    recomeco: "O envio deste arquivo expirou no Google. Recomeçando.",
    recomecos: "Não deu para enviar este arquivo. Toque em Tentar de novo.",
    webkit: "Este navegador não conseguiu ler o arquivo. Tente pelo Chrome no computador.",
    espaco: "Não dá para receber arquivos agora. Avise a ZRO.",
    limite: "Muito material hoje. Tente de novo amanhã ou avise a ZRO.",
    nada: "Nada para enviar: só havia arquivos do sistema.",
    falhou: "Não deu para enviar este arquivo. Toque em Tentar de novo: continua de onde parou.",
    instavel: "Conexão instável. Tentando de novo.",
  },
} as const;

/* ============================== Tipos internos ============================== */

const MiB = 1024 * 1024;
const VIGIA_MS = 45_000;
const MAX_FALHAS = 10;
const MAX_RECOMECOS = 3;
const LIMITE_HITS = 4;
const GRUPO_INICIAR = 20;
const JANELA_CONFERIR_MS = 300;

type Motivo = "pausa" | "cancelar" | "destruir" | "entrar";

type Item = {
  chave: string;
  lote: Lote;
  file: File;
  nome: string;
  caminho: string;
  tamanho: number;
  tipo: string;
  modificado: number;
  envioId: string | null;
  sessao: string | null;
  /** O ponto que veio do servidor ou do Google agora há pouco (não precisa perguntar de novo). */
  pontoConfiavel: boolean;
  offset: number;
  emVoo: number;
  estado: EstadoItem;
  nota: string | null;
  erro: string | null;
  recomecos: number;
  copia: boolean;
  semAvanco: number;
  iniciando: Promise<void> | null;
  ctl: AbortController | null;
  put: AbortController | null;
  motivo: Motivo | null;
  resync: boolean;
  ultimoProgresso: number;
};

type Lote = {
  chave: string;
  destino: Destino;
  selecao: Selecao;
  impressao: string | null;
  loteId: string | null;
  rotulo: string | null;
  caminho: string | null;
  estado: LoteFila["estado"];
  erro: string | null;
  pergunta: { loteId: string; rotulo: string } | null;
  itens: Item[];
  fechando: boolean;
  preparando: boolean;
};

class ItemConcluido extends Error {}
class ErroItem extends Error {
  parar: "espaco" | "limite" | "google" | "link" | null;
  constructor(mensagem: string, parar: ErroItem["parar"] = null) {
    super(mensagem);
    this.parar = parar;
  }
}
class PrecisaEntrar extends Error {}

const ATIVOS = new Set<EstadoItem>(["preparando", "enviando", "conferindo"]);
const PENDENTES = new Set<EstadoItem>(["fila", "preparando", "enviando", "conferindo", "pausado"]);
const FEITOS = new Set<EstadoItem>(["concluido", "ja-recebido"]);

let sequencia = 0;
const novaChave = (p: string) => `${p}${Date.now().toString(36)}${(++sequencia).toString(36)}`;

function esperar(ms: number, sinal?: AbortSignal): Promise<void> {
  return new Promise((ok, falha) => {
    if (sinal?.aborted) return falha(new Abortado());
    const t = setTimeout(() => {
      sinal?.removeEventListener("abort", parar);
      ok();
    }, ms);
    const parar = () => {
      clearTimeout(t);
      falha(new Abortado());
    };
    sinal?.addEventListener("abort", parar, { once: true });
  });
}

/** Recuo exponencial com jitter, até 64 vezes a base (64 s no padrão). */
function recuoCom(base: number, falhas: number): number {
  return Math.min(64 * base, base * 2 ** Math.min(falhas - 1, 6)) * (0.5 + Math.random() * 0.5);
}

function razaoDoCorpo(texto: string): string {
  try {
    const j = JSON.parse(texto || "null") as { error?: { errors?: { reason?: string }[] } } | null;
    return j?.error?.errors?.[0]?.reason ?? "";
  } catch {
    return "";
  }
}

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/* ============================== O motor ============================== */

export function criarMotor(o: OpcoesMotor): Motor {
  const navegador = typeof window !== "undefined" && typeof XMLHttpRequest !== "undefined";
  const rede: Rede = o.rede ?? (navegador ? redeXHR() : redeFetch());
  const voz = o.voz;
  const T = TEXTOS[voz];
  const pedaco = o.pedacoMiB ? Math.max(ALINHAMENTO, Math.round(o.pedacoMiB * MiB)) : pedacoPadrao();
  const paralelos = Math.max(1, o.paralelos ?? paralelosPadrao());
  // No diagnóstico, uma falha de CORS precisa aparecer em segundos, não depois de dez recuos.
  const recuo = (falhas: number) => recuoCom(o.recuoBaseMs ?? (o.diagnostico ? 250 : 1000), falhas);
  const maxFalhas = o.diagnostico ? 2 : MAX_FALHAS;

  let lotes: Lote[] = [];
  const rodando = new Set<Item>();
  const ouvintes = new Set<() => void>();
  let fotoAtual: Foto = FOTO_VAZIA;
  let timerFoto: ReturnType<typeof setTimeout> | null = null;
  let tique: ReturnType<typeof setInterval> | null = null;
  let velocidade = 0;
  let ultimaAmostra: { em: number; bytes: number } | null = null;
  let semInternet = !online();
  let precisaEntrar = false;
  let aviso: string | null = null;
  let pausaGeral = false;
  let destruido = false;
  let ligado = false;
  let escondidoEm = 0;
  let rangeVisto = rangeJaVisto();
  let salvos: LoteSalvo[] = navegador ? lerSalvos(o.escopo) : [];
  const diag = { preflight: null as boolean | null, viu308: false, rangeLegivel: false, finalLegivel: null as boolean | null, host: "" };
  let diagnostico: ResultadoDiagnostico | null = null;
  const esperandoRede = new Set<() => void>();
  if (navegador && salvos.length) fotoAtual = { ...FOTO_VAZIA, retomaveis: salvos };

  /* ---------- foto (no máximo 5 vezes por segundo) ---------- */

  function montarFoto(): Foto {
    const itens: ItemFila[] = [];
    let bytes = 0;
    let enviados = 0;
    const fotoLotes: LoteFila[] = lotes.map((l) => {
      let lb = 0;
      let le = 0;
      let rec = 0;
      for (const it of l.itens) {
        const enviado = FEITOS.has(it.estado) ? it.tamanho : Math.min(it.tamanho, it.offset + it.emVoo);
        lb += it.tamanho;
        le += enviado;
        if (FEITOS.has(it.estado)) rec++;
        itens.push({
          chave: it.chave,
          lote: l.chave,
          envioId: it.envioId,
          nome: it.nome,
          caminho: it.caminho,
          tamanho: it.tamanho,
          enviado,
          estado: it.estado,
          nota: it.nota,
          erro: it.erro,
        });
      }
      if (l.estado !== "cancelado") {
        bytes += lb;
        enviados += le;
      }
      return {
        chave: l.chave,
        loteId: l.loteId,
        rotulo: l.rotulo,
        caminho: l.caminho,
        estado: l.estado,
        arquivos: l.itens.length,
        bytes: lb,
        recebidos: rec,
        bytesEnviados: le,
        ignorados: l.selecao.ignorados,
        pergunta: l.pergunta,
        erro: l.erro,
      };
    });
    const ativo = [...rodando].some((it) => ATIVOS.has(it.estado));
    const restante = velocidade > 1 ? Math.max(0, bytes - enviados) / velocidade : null;
    const emUso = new Set(lotes.map((l) => l.loteId).filter(Boolean));
    return {
      lotes: fotoLotes,
      itens,
      total: { bytes, enviados, velocidade: ativo ? velocidade : 0, restante: ativo ? restante : null },
      ativo,
      semInternet,
      precisaEntrar,
      retomaveis: salvos.filter((s) => !emUso.has(s.loteId)),
      diagnostico,
      aviso,
    };
  }

  function emitir(agora = false) {
    if (agora) {
      if (timerFoto) clearTimeout(timerFoto);
      timerFoto = null;
      publicar();
      return;
    }
    if (timerFoto) return;
    timerFoto = setTimeout(() => {
      timerFoto = null;
      publicar();
    }, 200);
  }

  function publicar() {
    fotoAtual = montarFoto();
    manterTelaAcesa(fotoAtual.ativo);
    for (const f of ouvintes) f();
  }

  function medir() {
    const agora = Date.now();
    let total = 0;
    for (const l of lotes) for (const it of l.itens) total += FEITOS.has(it.estado) ? it.tamanho : it.offset + it.emVoo;
    if (ultimaAmostra) {
      const dt = (agora - ultimaAmostra.em) / 1000;
      if (dt > 0.3) {
        const inst = Math.max(0, total - ultimaAmostra.bytes) / dt;
        velocidade = velocidade ? velocidade * 0.7 + inst * 0.3 : inst;
        ultimaAmostra = { em: agora, bytes: total };
      }
    } else ultimaAmostra = { em: agora, bytes: total };
    emitir();
  }

  function atividade() {
    const ativo = rodando.size > 0;
    if (ativo && !tique) tique = setInterval(medir, 500);
    if (!ativo && tique) {
      clearInterval(tique);
      tique = null;
      velocidade = 0;
      ultimaAmostra = null;
    }
  }

  /* ---------- registro de retomada ---------- */

  function salvarRegistro() {
    if (!navegador) return;
    const abertos = lotes
      .filter((l) => l.loteId && l.impressao && !["concluido", "cancelado", "erro"].includes(l.estado))
      .map((l) => ({
        loteId: l.loteId!,
        rotulo: l.rotulo ?? "",
        impressao: l.impressao!,
        arquivos: l.itens.length,
        bytes: l.itens.reduce((s, it) => s + it.tamanho, 0),
        enviados: l.itens.reduce((s, it) => s + (FEITOS.has(it.estado) ? it.tamanho : it.offset), 0),
        criadoEm: salvos.find((s) => s.loteId === l.loteId)?.criadoEm ?? Date.now(),
      }));
    salvarLotes(o.escopo, abertos);
    salvos = lerSalvos(o.escopo);
  }

  function esquecerRegistro(loteId: string | null) {
    if (!navegador || !loteId) return;
    esquecerLote(o.escopo, loteId);
    salvos = lerSalvos(o.escopo);
  }

  /* ---------- eventos do navegador ---------- */

  const aoOnline = () => {
    semInternet = false;
    for (const f of [...esperandoRede]) f();
    bombear();
    emitir(true);
  };
  const aoOffline = () => {
    semInternet = true;
    emitir(true);
  };
  const aoVisibilidade = () => {
    if (document.visibilityState === "hidden") {
      escondidoEm = Date.now();
      salvarRegistro();
      return;
    }
    const fora = escondidoEm ? Date.now() - escondidoEm : 0;
    escondidoEm = 0;
    if (!rodando.size) return;
    // O iOS corta a rede de páginas em segundo plano: quem ficou sem dar sinal é refeito
    // (consulta e segue de onde o Google parou).
    setTimeout(() => {
      for (const it of rodando) {
        if (it.put && fora > 1000 && Date.now() - it.ultimoProgresso > 2500) {
          it.resync = true;
          it.put.abort();
        }
      }
    }, 1500);
  };
  const aoSair = () => salvarRegistro();
  const antesDeSair = (e: BeforeUnloadEvent) => {
    if (rodando.size && !ehIOS()) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  function ligar() {
    if (ligado || !navegador) return;
    ligado = true;
    destruido = false;
    window.addEventListener("online", aoOnline);
    window.addEventListener("offline", aoOffline);
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("beforeunload", antesDeSair);
    document.addEventListener("visibilitychange", aoVisibilidade);
  }

  function desligar() {
    if (!ligado) return;
    ligado = false;
    window.removeEventListener("online", aoOnline);
    window.removeEventListener("offline", aoOffline);
    window.removeEventListener("pagehide", aoSair);
    window.removeEventListener("beforeunload", antesDeSair);
    document.removeEventListener("visibilitychange", aoVisibilidade);
  }

  /* ---------- espera de rede ---------- */

  async function esperarConexao(it: Item | null, falhas: number, sinal?: AbortSignal) {
    if (!online()) {
      semInternet = true;
      if (it) it.nota = T.semInternet;
      emitir(true);
      await new Promise<void>((ok, falha) => {
        const pronto = () => {
          esperandoRede.delete(pronto);
          sinal?.removeEventListener("abort", parar);
          ok();
        };
        const parar = () => {
          esperandoRede.delete(pronto);
          falha(new Abortado());
        };
        esperandoRede.add(pronto);
        sinal?.addEventListener("abort", parar, { once: true });
      });
    }
    if (it) it.nota = T.instavel;
    emitir();
    await esperar(recuo(falhas), sinal);
    if (it) it.nota = null;
  }

  /** Chamada ao servidor da ZRO com novas tentativas em queda de rede (e 503 do Google). */
  async function servidor<R>(fazer: () => Promise<R | RespErro>, sinal?: AbortSignal): Promise<R | RespErro> {
    for (let falhas = 1; ; falhas++) {
      if (sinal?.aborted) throw new Abortado();
      try {
        const r = await fazer();
        const e = r as RespErro;
        if (e && e.ok === false && (e.erro === "google" || e.erro === "muitas_tentativas") && falhas < 4) {
          await esperar(recuo(falhas + 1), sinal);
          continue;
        }
        return r;
      } catch (e) {
        if (!(e instanceof FalhaDeRede) || falhas >= MAX_FALHAS) throw e;
        await esperarConexao(null, falhas, sinal);
      }
    }
  }

  /** Erro do servidor → o que o item faz. */
  function lancarErro(r: RespErro): never {
    if (r.erro === "sem_acesso" || r.erro === "senha") throw new PrecisaEntrar();
    if (r.erro === "sem_espaco") throw new ErroItem(r.mensagem, "espaco");
    if (r.erro === "limite_diario") throw new ErroItem(r.mensagem, "limite");
    if (r.erro === "sem_google" || r.erro === "reconectar") throw new ErroItem(r.mensagem, "google");
    if (r.erro === "link_inativo") throw new ErroItem(r.mensagem, "link");
    throw new ErroItem(r.mensagem);
  }

  /* ---------- conferir agrupado (janela de 300 ms, até 50) ---------- */

  type Espera = { envioId: string; ok: (r: ResultadoConferir) => void; falha: (e: unknown) => void };
  let filaConferir: Espera[] = [];
  let timerConferir: ReturnType<typeof setTimeout> | null = null;

  function conferirServidor(envioId: string, sinal?: AbortSignal): Promise<ResultadoConferir> {
    const p = new Promise<ResultadoConferir>((ok, falha) => {
      filaConferir.push({ envioId, ok, falha });
      if (filaConferir.length >= 50) despacharConferir();
      else if (!timerConferir) timerConferir = setTimeout(despacharConferir, JANELA_CONFERIR_MS);
    });
    if (!sinal) return p;
    return new Promise<ResultadoConferir>((ok, falha) => {
      const parar = () => falha(new Abortado());
      if (sinal.aborted) return parar();
      sinal.addEventListener("abort", parar, { once: true });
      p.then(
        (r) => {
          sinal.removeEventListener("abort", parar);
          ok(r);
        },
        (e) => {
          sinal.removeEventListener("abort", parar);
          falha(e);
        },
      );
    });
  }

  function despacharConferir() {
    if (timerConferir) clearTimeout(timerConferir);
    timerConferir = null;
    const grupo = filaConferir.slice(0, 50);
    filaConferir = filaConferir.slice(50);
    if (filaConferir.length) timerConferir = setTimeout(despacharConferir, JANELA_CONFERIR_MS);
    if (!grupo.length) return;
    const ids = [...new Set(grupo.map((g) => g.envioId))];
    servidor(() => o.transporte.conferir({ op: "conferir", envioIds: ids })).then(
      (r) => {
        if (!r.ok) {
          for (const g of grupo) g.falha(r);
          return;
        }
        const porId = new Map(r.resultados.map((x) => [x.envioId, x]));
        for (const g of grupo) {
          const x = porId.get(g.envioId);
          if (x) g.ok(x);
          else g.falha({ ok: false, erro: "nao_encontrado", mensagem: T.falhou } satisfies RespErro);
        }
      },
      (e) => {
        for (const g of grupo) g.falha(e);
      },
    );
  }

  /* ---------- iniciar (sob demanda; pequenos em grupos de até 20) ---------- */

  function aplicarInicio(it: Item, r: ResultadoIniciar) {
    if (!r.ok) {
      it.estado = "erro";
      it.erro = r.mensagem;
      return r;
    }
    it.envioId = r.envioId;
    if (r.estado === "concluido") {
      it.estado = r.jaRecebido ? "ja-recebido" : "concluido";
      it.offset = it.tamanho;
      it.sessao = null;
      it.nota = null;
      return r;
    }
    it.sessao = r.sessao;
    it.offset = Math.min(r.offset, it.tamanho);
    it.pontoConfiavel = true;
    if (o.diagnostico && !diag.host) {
      try {
        diag.host = new URL(r.sessao).host;
      } catch {
        diag.host = "";
      }
    }
    return r;
  }

  async function iniciarGrupo(grupo: Item[], sinal?: AbortSignal) {
    const lote = grupo[0].lote;
    const r = await servidor(
      () =>
        o.transporte.iniciar({
          op: "iniciar",
          loteId: lote.loteId!,
          arquivos: grupo.map((it) => ({
            chave: it.chave,
            nome: it.nome,
            caminho: it.caminho,
            tamanho: it.tamanho,
            tipo: it.tipo || "application/octet-stream",
            ...(it.modificado ? { modificado: it.modificado } : {}),
          })),
        }),
      sinal,
    );
    if (!r.ok) lancarErro(r);
    const porChave = new Map(r.resultados.map((x) => [x.chave, x]));
    const cancelados: string[] = [];
    for (const it of grupo) {
      const x = porChave.get(it.chave);
      if (!x) continue;
      if (it.estado === "cancelado") {
        // Cancelado enquanto o servidor abria a sessão: cancela lá também.
        if (x.ok && x.estado === "enviar") cancelados.push(x.envioId);
        continue;
      }
      const res = aplicarInicio(it, x);
      if (!res.ok && it === grupo[0]) {
        lancarErro({ ok: false, erro: res.erro, mensagem: res.mensagem });
      }
      if (!res.ok && (res.erro === "sem_espaco" || res.erro === "limite_diario" || res.erro === "sem_google" || res.erro === "reconectar")) {
        pararFila(res.mensagem);
      }
    }
    if (cancelados.length) void o.transporte.cancelar({ op: "cancelar", envioIds: cancelados }).catch(() => {});
  }

  async function garantirInicio(it: Item, sinal: AbortSignal) {
    if (it.iniciando) {
      await it.iniciando;
      return;
    }
    const grupo = [it];
    if (it.tamanho <= pedaco) {
      for (const outro of it.lote.itens) {
        if (grupo.length >= GRUPO_INICIAR) break;
        if (outro !== it && outro.estado === "fila" && !outro.sessao && !outro.iniciando && outro.tamanho <= pedaco) grupo.push(outro);
      }
    }
    const p = iniciarGrupo(grupo, sinal);
    const marca = p.then(
      () => undefined,
      () => undefined,
    );
    for (const g of grupo) g.iniciando = marca;
    try {
      await p;
    } finally {
      for (const g of grupo) if (g.iniciando === marca) g.iniciando = null;
    }
  }

  /* ---------- um arquivo ---------- */

  async function put(it: Item, inicio: number, fim: number, corpo: Blob | null): Promise<RespostaPut> {
    const c = new AbortController();
    it.put = c;
    const sinalItem = it.ctl?.signal;
    const repassar = () => c.abort();
    sinalItem?.addEventListener("abort", repassar, { once: true });
    it.ultimoProgresso = Date.now();
    try {
      return await rede.put(it.sessao!, {
        inicio,
        fim,
        total: it.tamanho,
        corpo,
        sinal: c.signal,
        vigiaMs: VIGIA_MS,
        aoProgresso: (n) => {
          it.emVoo = n;
          it.ultimoProgresso = Date.now();
        },
      });
    } finally {
      sinalItem?.removeEventListener("abort", repassar);
      it.put = null;
      it.emVoo = 0;
    }
  }

  /** O servidor diz onde estamos (ou conclui, ou manda recomeçar). */
  async function perguntarAoServidor(it: Item, sinal: AbortSignal): Promise<void> {
    it.estado = "conferindo";
    emitir();
    let r: ResultadoConferir;
    try {
      r = await conferirServidor(it.envioId!, sinal);
    } catch (e) {
      if (e instanceof Abortado || e instanceof FalhaDeRede) throw e;
      lancarErro(e as RespErro);
    }
    if (r.estado === "concluido") throw new ItemConcluido();
    if (r.estado === "parcial") {
      it.offset = Math.min(r.offset, it.tamanho);
      it.estado = "enviando";
      return;
    }
    if (r.estado === "expirado") return recomecar(it, sinal);
    if (r.estado === "cancelado") {
      it.motivo = "cancelar";
      throw new Abortado();
    }
    // Falhou no servidor (conferência): "Tentar de novo" abre outra sessão para este arquivo.
    it.sessao = null;
    throw new ErroItem(r.mensagem);
  }

  async function recomecar(it: Item, sinal: AbortSignal) {
    if (++it.recomecos > MAX_RECOMECOS) throw new ErroItem(T.recomecos);
    it.nota = T.recomeco;
    it.sessao = null;
    it.offset = 0;
    it.copia = false;
    it.semAvanco = 0;
    emitir();
    await iniciarGrupo([it], sinal);
    if (FEITOS.has(it.estado)) throw new ItemConcluido();
    it.estado = "enviando";
  }

  /** Consulta pelo próprio navegador ("bytes *\/T"). */
  async function consultar(it: Item, sinal: AbortSignal): Promise<void> {
    for (let falhas = 1; ; falhas++) {
      let r: RespostaPut;
      try {
        r = await put(it, 0, 0, null);
      } catch (e) {
        if (e instanceof Abortado && it.resync && !it.motivo) {
          it.resync = false;
          continue;
        }
        throw e;
      }
      if (r.status === 308) {
        const lido = lerRange(r.range);
        if (lido != null) {
          vRange();
          it.offset = Math.min(lido, it.tamanho);
          return;
        }
        if (rangeVisto && it.offset === 0) return; // a ausência é real: o Google tem 0 byte
        return perguntarAoServidor(it, sinal);
      }
      if (r.status === 200 || r.status === 201 || r.status === 404 || r.status === 410 || r.status === 0) {
        return perguntarAoServidor(it, sinal);
      }
      if (r.status >= 500 || r.status === 429 || r.status === 403) {
        if (falhas > maxFalhas) throw new ErroItem(T.rede);
        await esperarConexao(it, falhas, sinal);
        continue;
      }
      return perguntarAoServidor(it, sinal);
    }
  }

  function vRange() {
    if (!rangeVisto) {
      rangeVisto = true;
      marcarRangeVisto();
    }
  }

  async function laco(it: Item, sinal: AbortSignal) {
    let falhas = 0;
    let ruins = 0;
    let limites = 0;
    let primeiro = true;
    let noFim = 0;
    for (;;) {
      if (sinal.aborted) throw new Abortado();
      if (it.offset >= it.tamanho) {
        if (++noFim > 3) throw new ErroItem(T.falhou);
        await perguntarAoServidor(it, sinal); // conclui (ou volta com o ponto certo)
        continue;
      }
      const inicio = it.offset;
      const fim = fimDoPedaco(inicio, pedaco, it.tamanho);
      const corpo = it.copia
        ? new Blob([await it.file.slice(inicio, fim).arrayBuffer()])
        : it.file.slice(inicio, fim, it.tipo || "application/octet-stream");
      let r: RespostaPut;
      try {
        r = await put(it, inicio, fim, corpo);
      } catch (e) {
        if (e instanceof Abortado && it.resync && !it.motivo) {
          it.resync = false;
          await consultar(it, sinal);
          continue;
        }
        throw e;
      }
      if (o.diagnostico) {
        if (primeiro && diag.preflight === null) diag.preflight = r.status !== 0;
        if (r.status === 308) diag.viu308 = true;
        if (r.status === 308 && lerRange(r.range) != null) diag.rangeLegivel = true;
        if (fim === it.tamanho) diag.finalLegivel = r.status === 200 || r.status === 201;
      }
      primeiro = false;

      if (r.status === 308) {
        falhas = 0;
        ruins = 0;
        limites = 0;
        const lido = lerRange(r.range);
        let novo: number;
        if (lido != null) {
          vRange();
          novo = lido;
        } else if (rangeVisto && inicio === 0) {
          novo = 0; // o aparelho já mostrou Range antes: a ausência é real
        } else {
          const sessaoAntes = it.sessao;
          await perguntarAoServidor(it, sinal); // desconhecido, nunca zero
          if (it.sessao !== sessaoAntes) continue; // o servidor mandou recomeçar
          novo = it.offset;
        }
        if (novo <= inicio) {
          // 308 sem avanço depois de um PUT completo: o corpo foi vazio (bug 319985 do WebKit).
          if (!it.copia) {
            it.copia = true;
            it.semAvanco = 0;
          } else if (++it.semAvanco >= 2) {
            throw new ErroItem(T.webkit);
          }
        } else it.semAvanco = 0;
        it.offset = Math.min(Math.max(novo, 0), it.tamanho);
        it.pontoConfiavel = true;
        continue;
      }
      if (r.status === 200 || r.status === 201) {
        it.offset = it.tamanho;
        await perguntarAoServidor(it, sinal);
        continue;
      }
      if (r.status === 0) {
        // Último pedaço: a resposta final pode vir sem CORS. O servidor resolve.
        if (fim === it.tamanho || r.travou) {
          await perguntarAoServidor(it, sinal);
          continue;
        }
        if (++falhas > maxFalhas) throw new ErroItem(T.rede);
        await esperarConexao(it, falhas, sinal);
        await consultar(it, sinal);
        continue;
      }
      if (r.status === 404 || r.status === 410) {
        await perguntarAoServidor(it, sinal); // expirado → recomeça; achou o arquivo → conclui
        continue;
      }
      const razao = razaoDoCorpo(r.texto);
      if (razao === "storageQuotaExceeded") throw new ErroItem(T.espaco, "espaco");
      if (razao === "userRateLimitExceeded" && ++limites >= LIMITE_HITS) throw new ErroItem(T.limite, "limite");
      if (r.status >= 500 || r.status === 429 || (r.status === 403 && /rateLimit/i.test(razao))) {
        if (++falhas > maxFalhas) throw new ErroItem(T.rede);
        await esperarConexao(it, falhas, sinal);
        await consultar(it, sinal);
        continue;
      }
      if (r.status === 400 || r.status === 416 || r.status === 401) {
        if (++ruins > 3) {
          ruins = 0;
          await recomecar(it, sinal);
          continue;
        }
        await consultar(it, sinal);
        continue;
      }
      throw new ErroItem(T.falhou);
    }
  }

  async function rodar(it: Item) {
    const ctl = new AbortController();
    it.ctl = ctl;
    it.motivo = null;
    it.resync = false;
    it.erro = null;
    it.estado = "preparando";
    rodando.add(it);
    atividade();
    emitir();
    try {
      if (!it.sessao) {
        await garantirInicio(it, ctl.signal);
        if (FEITOS.has(it.estado)) throw new ItemConcluido();
        if ((it.estado as EstadoItem) === "erro") return;
      } else if (!it.pontoConfiavel) {
        it.estado = "enviando";
        await consultar(it, ctl.signal);
      }
      it.estado = "enviando";
      it.pontoConfiavel = false;
      emitir();
      await laco(it, ctl.signal);
    } catch (e) {
      if (e instanceof ItemConcluido) {
        if (!FEITOS.has(it.estado)) it.estado = "concluido";
        it.offset = it.tamanho;
        it.nota = null;
        it.sessao = null;
      } else if (e instanceof Abortado) {
        if (it.motivo === "cancelar") it.estado = "cancelado";
        else if (it.motivo === "destruir") it.estado = "pausado";
        else it.estado = "pausado";
        it.pontoConfiavel = false;
      } else if (e instanceof PrecisaEntrar) {
        it.estado = "pausado";
        it.pontoConfiavel = false;
        entrar();
      } else if (e instanceof ErroItem) {
        it.estado = "erro";
        it.erro = e.message;
        it.nota = null;
        if (e.parar) pararFila(e.message);
      } else {
        it.estado = "erro";
        it.erro = e instanceof FalhaDeRede ? T.rede : T.falhou;
        it.nota = null;
      }
    } finally {
      if (it.ctl === ctl) it.ctl = null;
      it.emVoo = 0;
      rodando.delete(it);
      atividade();
      if (o.diagnostico && (FEITOS.has(it.estado) || it.estado === "erro")) {
        diagnostico = {
          preflight: Boolean(diag.preflight),
          viu308: diag.viu308,
          rangeLegivel: diag.rangeLegivel,
          finalLegivel: Boolean(diag.finalLegivel),
          host: diag.host,
          navegador: navegadorResumido(),
        };
      }
      verificarFim(it.lote);
      bombear();
      emitir(true);
    }
  }

  /* ---------- fila ---------- */

  function bombear() {
    if (destruido || pausaGeral || precisaEntrar) return;
    for (const l of lotes) {
      if (l.estado !== "enviando") continue;
      for (const it of l.itens) {
        if (rodando.size >= paralelos) return;
        if (it.estado === "fila" && !it.iniciando) void rodar(it);
      }
    }
  }

  function pararFila(mensagem: string) {
    aviso = mensagem;
    for (const l of lotes) for (const it of l.itens) if (it.estado === "fila") it.estado = "pausado";
    emitir(true);
  }

  function entrar() {
    if (precisaEntrar) return;
    precisaEntrar = true;
    for (const it of rodando) {
      it.motivo = "entrar";
      it.ctl?.abort();
    }
    emitir(true);
  }

  function verificarFim(l: Lote) {
    if (l.estado !== "enviando" || l.fechando || !l.loteId) return;
    if (l.itens.some((it) => PENDENTES.has(it.estado) || it.iniciando)) return;
    l.fechando = true;
    const loteId = l.loteId;
    servidor(() => o.transporte.fecharLote({ op: "fecharLote", loteId }))
      .then((r) => {
        if (!r.ok) {
          if (r.erro === "sem_acesso" || r.erro === "senha") entrar();
          return;
        }
        if (l.estado === "enviando") l.estado = r.estado;
        if (r.estado === "concluido" || r.estado === "cancelado") esquecerRegistro(loteId);
        else salvarRegistro();
      })
      .catch(() => {})
      .finally(() => {
        l.fechando = false;
        emitir(true);
      });
  }

  async function prepararLote(l: Lote) {
    if (l.preparando) return;
    l.preparando = true;
    l.estado = "preparando";
    l.erro = null;
    emitir(true);
    try {
      if (!l.impressao) l.impressao = await calcularImpressao(l.selecao);
      const destino: Destino =
        l.destino.tipo === "cartao" && !l.destino.cartaoNome && l.selecao.cartaoNome
          ? { ...l.destino, cartaoNome: l.selecao.cartaoNome }
          : l.destino;
      const r = await servidor(() =>
        o.transporte.lote({
          op: "lote",
          destino,
          arquivos: l.itens.length,
          bytes: l.itens.reduce((s, it) => s + it.tamanho, 0),
          impressao: l.impressao!,
        }),
      );
      if (!r.ok) {
        if (r.erro === "sem_acesso" || r.erro === "senha") {
          l.estado = "pausado";
          entrar();
          return;
        }
        l.estado = "erro";
        l.erro = r.mensagem;
        if (r.erro === "sem_espaco" || r.erro === "limite_diario" || r.erro === "sem_google" || r.erro === "reconectar") aviso = r.mensagem;
        return;
      }
      if ("pergunta" in r) {
        l.estado = "pergunta";
        l.pergunta = { loteId: r.pergunta.loteId, rotulo: r.pergunta.rotulo };
        return;
      }
      l.loteId = r.loteId;
      l.rotulo = r.rotulo;
      l.caminho = r.caminho;
      l.pergunta = null;
      l.estado = pausaGeral ? "pausado" : "enviando";
      salvarRegistro();
    } catch (e) {
      l.estado = "erro";
      l.erro = e instanceof FalhaDeRede ? T.rede : T.falhou;
    } finally {
      l.preparando = false;
      emitir(true);
      bombear();
    }
  }

  function lotesAlvo(chave?: string): Lote[] {
    if (!chave) return lotes;
    const porLote = lotes.filter((l) => l.chave === chave);
    if (porLote.length) return porLote;
    return [];
  }

  function itemAlvo(chave: string): Item | null {
    for (const l of lotes) for (const it of l.itens) if (it.chave === chave) return it;
    return null;
  }

  /* ---------- API ---------- */

  const motor: Motor = {
    adicionar(selecao, destino) {
      ligar();
      const l: Lote = {
        chave: novaChave("l"),
        destino,
        selecao,
        impressao: null,
        loteId: null,
        rotulo: null,
        caminho: null,
        estado: "preparando",
        erro: null,
        pergunta: null,
        itens: [],
        fechando: false,
        preparando: false,
      };
      l.itens = selecao.arquivos.map(({ file, caminho }) => ({
        chave: novaChave("i"),
        lote: l,
        file,
        nome: file.name,
        caminho,
        tamanho: file.size,
        tipo: file.type || "application/octet-stream",
        modificado: Number(file.lastModified) || 0,
        envioId: null,
        sessao: null,
        pontoConfiavel: false,
        offset: 0,
        emVoo: 0,
        estado: "fila",
        nota: null,
        erro: null,
        recomecos: 0,
        copia: false,
        semAvanco: 0,
        iniciando: null,
        ctl: null,
        put: null,
        motivo: null,
        resync: false,
        ultimoProgresso: 0,
      }));
      lotes = [...lotes, l];
      aviso = null;
      if (!l.itens.length) {
        l.estado = "erro";
        l.erro = T.nada;
        emitir(true);
        return l.chave;
      }
      void prepararLote(l);
      return l.chave;
    },

    responder(chave, decisao) {
      const l = lotes.find((x) => x.chave === chave);
      if (!l || l.estado !== "pergunta" || l.destino.tipo !== "cartao") return;
      const alvo = l.pergunta;
      l.destino = { ...l.destino, decisao, ...(decisao === "continuar" && alvo ? { continuarLoteId: alvo.loteId } : {}) };
      l.pergunta = null;
      void prepararLote(l);
    },

    pausar(chave) {
      if (!chave) pausaGeral = true;
      const alvo = chave ? itemAlvo(chave) : null;
      const itens = alvo ? [alvo] : lotesAlvo(chave).flatMap((l) => l.itens);
      if (!alvo) for (const l of lotesAlvo(chave)) if (l.estado === "enviando") l.estado = "pausado";
      for (const it of itens) {
        if (it.estado === "fila") it.estado = "pausado";
        else if (rodando.has(it)) {
          it.motivo = "pausa";
          it.ctl?.abort();
        }
      }
      emitir(true);
    },

    continuar(chave) {
      if (!chave) {
        pausaGeral = false;
        aviso = null;
      }
      precisaEntrar = false;
      const alvo = chave ? itemAlvo(chave) : null;
      const alvos = alvo ? [alvo.lote] : lotesAlvo(chave);
      for (const l of alvos) {
        if (l.estado === "pausado") l.estado = l.loteId ? "enviando" : "preparando";
        if (!l.loteId && !l.preparando && l.estado === "preparando") void prepararLote(l);
        for (const it of alvo ? [alvo] : l.itens) if (it.estado === "pausado") it.estado = "fila";
      }
      bombear();
      emitir(true);
    },

    cancelar(chave) {
      const l = lotes.find((x) => x.chave === chave);
      if (!l) return;
      const envioIds: string[] = [];
      for (const it of l.itens) {
        if (FEITOS.has(it.estado) || it.estado === "cancelado") continue;
        if (rodando.has(it)) {
          it.motivo = "cancelar";
          it.ctl?.abort();
        }
        if (it.envioId) envioIds.push(it.envioId);
        it.estado = "cancelado";
        it.sessao = null;
      }
      l.estado = "cancelado";
      l.pergunta = null;
      emitir(true);
      const loteId = l.loteId;
      if (!loteId) return;
      void (async () => {
        try {
          for (let i = 0; i < envioIds.length; i += 50) {
            await servidor(() => o.transporte.cancelar({ op: "cancelar", envioIds: envioIds.slice(i, i + 50) }));
          }
          await servidor(() => o.transporte.fecharLote({ op: "fecharLote", loteId }));
        } catch {
          // o servidor concilia depois
        }
        esquecerRegistro(loteId);
        emitir(true);
      })();
    },

    tentarDeNovo(chave) {
      aviso = null;
      precisaEntrar = false;
      pausaGeral = false;
      const alvo = chave ? itemAlvo(chave) : null;
      const alvos = alvo ? [alvo.lote] : lotesAlvo(chave);
      for (const l of alvos) {
        if (l.estado === "erro" && !l.loteId) {
          void prepararLote(l);
          continue;
        }
        let reabriu = false;
        for (const it of alvo ? [alvo] : l.itens) {
          if (it.estado !== "erro" && it.estado !== "pausado") continue;
          it.estado = "fila";
          it.erro = null;
          it.nota = null;
          it.recomecos = 0;
          it.semAvanco = 0;
          if (!it.sessao) it.envioId = null;
          it.pontoConfiavel = false;
          reabriu = true;
        }
        if (reabriu && ["parcial", "erro", "pausado"].includes(l.estado)) l.estado = l.loteId ? "enviando" : "preparando";
      }
      bombear();
      emitir(true);
    },

    limparConcluidos() {
      lotes = lotes.filter((l) => !["concluido", "cancelado"].includes(l.estado));
      emitir(true);
    },

    assinar(fn) {
      ligar();
      ouvintes.add(fn);
      return () => {
        ouvintes.delete(fn);
      };
    },

    foto() {
      return fotoAtual;
    },

    destruir() {
      salvarRegistro();
      destruido = true;
      for (const it of rodando) {
        it.motivo = "destruir";
        it.ctl?.abort();
      }
      if (timerFoto) clearTimeout(timerFoto);
      timerFoto = null;
      if (tique) clearInterval(tique);
      tique = null;
      manterTelaAcesa(false);
      desligar();
    },
  };

  // `assinar` depois de um `destruir` (React em modo estrito monta duas vezes) religa o motor.
  const assinarOriginal = motor.assinar;
  motor.assinar = (fn) => {
    if (destruido) {
      destruido = false;
      for (const l of lotes) for (const it of l.itens) if (it.estado === "pausado" && it.motivo === "destruir") it.estado = "fila";
      queueMicrotask(bombear);
    }
    return assinarOriginal(fn);
  };
  return motor;
}
