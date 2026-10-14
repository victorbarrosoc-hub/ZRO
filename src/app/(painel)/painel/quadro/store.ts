"use client";

/**
 * Estado do Quadro no navegador e a FILA de gravação, como na Maestro:
 * - grava por CAMPO; o que se escreve enquanto o banco responde fica para a
 *   próxima volta (a base é o que FOI enviado, não o card de agora);
 * - um card recusado não segura os outros;
 * - o que não chegou ao banco em 20 s aparece no aviso "não salvos", com o motivo;
 * - o que chega de outro aparelho não atropela o que este ainda não enviou.
 */
import { COL, PENDENTES, REENVIAR_A_CADA, clone, igual, novoId, type Card, type ColKey, type Config } from "./metodo";

/** O contrato da Maestro: carregar, criar, mudar (só os campos), ouvir. Erro = lança. */
export type Armazem = {
  carregar(): Promise<Card[]>;
  criar(card: Card): Promise<void>;
  mudar(id: string, campos: Record<string, unknown>): Promise<void>;
  ouvir(aoReceber: (cards: Card[]) => void): () => void;
};

/** O motivo da recusa, em português, para o aviso "não salvos". */
const MOTIVO: Record<string, string> = {
  sem_acesso: "a sessão expirou; entre de novo no painel em outra aba",
  formato: "o conteúdo veio num formato que o banco não aceita",
  id_existe: "já existe um card com esse número",
  nao_existe: "o card não existe no banco",
  card_grande_demais: "o card passou do tamanho máximo",
};

const ENDERECO = "/painel/quadro/banco";

/**
 * O Armazem da ZRO: o Postgres do painel, por um endereço fixo (banco/route.ts).
 * "Ouvir" é perguntar o que mudou a cada 4 s, com a aba à vista.
 */
export function armazemZro(org: string, cursorInicial: string): Armazem {
  let cursor = cursorInicial;
  // Cada gravação concluída muda a "geração". Uma leitura que começou antes dela
  // pode trazer o valor antigo: é descartada e a próxima volta lê de novo.
  let geracao = 0;

  async function chamar<T>(op: string, corpo: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(ENDERECO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, org, ...corpo }),
        cache: "no-store",
        redirect: "manual",
      });
    } catch {
      throw new Error("sem conexão com a internet");
    }
    if (res.type === "opaqueredirect" || res.status === 401) throw new Error(MOTIVO.sem_acesso);
    const r = (await res.json().catch(() => null)) as ({ ok: boolean; erro?: string } & T) | null;
    if (!r) throw new Error(`o servidor não respondeu direito (${res.status})`);
    if (!r.ok) throw new Error(MOTIVO[r.erro ?? ""] ?? r.erro ?? "erro");
    return r;
  }

  async function gravar(fn: () => Promise<unknown>) {
    try {
      await fn();
    } finally {
      geracao++;
    }
  }

  return {
    async carregar() {
      const r = await chamar<{ cards: Card[]; cursor: string }>("carregar", {});
      cursor = r.cursor;
      return r.cards;
    },
    criar: (card) => gravar(() => chamar("criar", { id: card.id, dados: card })),
    mudar: (id, campos) => gravar(() => chamar("mudar", { id, campos })),
    ouvir(aoReceber) {
      let parado = false;
      let indo = false;
      let t: ReturnType<typeof setTimeout> | undefined;
      const volta = async () => {
        clearTimeout(t);
        if (parado || indo) return;
        if (document.visibilityState === "visible") {
          indo = true;
          const g = geracao;
          try {
            const r = await chamar<{ cards: Card[]; cursor: string }>("desde", { cursor });
            if (g === geracao) {
              cursor = r.cursor;
              if (r.cards.length) aoReceber(r.cards);
            }
          } catch {
            // sem rede ou sessão: tenta na próxima volta
          } finally {
            indo = false;
          }
        }
        if (!parado) t = setTimeout(volta, 4000);
      };
      const aoVoltar = () => {
        if (document.visibilityState === "visible") void volta();
      };
      t = setTimeout(volta, 4000);
      document.addEventListener("visibilitychange", aoVoltar);
      return () => {
        parado = true;
        clearTimeout(t);
        document.removeEventListener("visibilitychange", aoVoltar);
      };
    },
  };
}

type Pend = { criar: boolean; campos: Record<string, unknown>; desde: number; erro?: string | null; vezes?: number };

export class QuadroStore {
  cards: Card[];
  pend = new Map<string, Pend>();
  versao = 0;
  ultimo = 0;
  private ouvintes = new Set<() => void>();
  private indo = false;
  private deNovo = false;
  private t: ReturnType<typeof setTimeout> | undefined;

  constructor(
    public cfg: Config,
    public armazem: Armazem,
    iniciais: Card[],
  ) {
    this.cards = clone(iniciais);
  }

  /* ---------- React ---------- */
  subscribe = (fn: () => void) => {
    this.ouvintes.add(fn);
    return () => {
      this.ouvintes.delete(fn);
    };
  };
  getVersao = () => this.versao;
  avisar() {
    this.versao++;
    this.ouvintes.forEach((f) => f());
  }

  /* ---------- leitura ---------- */
  vivos = () => this.cards.filter((c) => c && !c.apagadoEm);
  achar = (id: string | null | undefined) => (id ? (this.cards.find((c) => c && c.id === id) ?? null) : null);
  ordemNoFim(col: ColKey, exceto?: string) {
    let m = 0;
    for (const c of this.vivos()) if (c.coluna === col && c.id !== exceto) m = Math.max(m, +(c.ordem ?? 0) || 0);
    return m + 1;
  }

  /* ---------- gravar ---------- */
  criar(dados: { tema?: string; cliente?: string | null; formatos?: string[]; coluna?: string; resp?: string | null; prazo?: string }) {
    const col = (dados.coluna && dados.coluna in COL ? dados.coluna : dados.resp ? "afazer" : "pauta") as ColKey;
    const agora = Date.now();
    const c: Card = {
      id: novoId(),
      tema: String(dados.tema || "").trim() || "Sem título",
      coluna: col,
      ordem: this.ordemNoFim(col),
      colunaEm: agora,
      criadoEm: agora,
      criadoPor: this.cfg.eu,
      mod: agora,
    };
    if (dados.cliente) c.cliente = dados.cliente;
    if (Array.isArray(dados.formatos) && dados.formatos.length) c.formatos = dados.formatos.slice();
    if (dados.resp) c.resp = dados.resp;
    if (dados.prazo) c.prazo = dados.prazo;
    this.cards.push(c);
    this.pend.set(c.id, { criar: true, campos: {}, desde: Date.now() });
    this.agendar();
    this.avisar();
    return c;
  }

  mudar(id: string, campos: Record<string, unknown>) {
    const c = this.achar(id);
    if (!c) return null;
    const mud: Record<string, unknown> = {};
    for (const [k, v0] of Object.entries(campos)) {
      const v = v0 === "" || v0 === undefined ? null : v0;
      if (igual(c[k], v)) continue;
      mud[k] = v;
      if (v === null) delete c[k];
      else c[k] = clone(v);
    }
    if (!Object.keys(mud).length) return c;
    c.mod = mud.mod = Date.now();
    const e = this.pend.get(id) ?? { criar: false, campos: {}, desde: Date.now() };
    Object.assign(e.campos, clone(mud));
    this.pend.set(id, e);
    this.agendar();
    this.avisar();
    return c;
  }

  mover(id: string, col: ColKey, ordem?: number) {
    const c = this.achar(id);
    if (!c || !(col in COL)) return;
    const de = c.coluna;
    const campos: Record<string, unknown> = {
      coluna: col,
      ordem: typeof ordem === "number" ? ordem : de === col ? c.ordem : this.ordemNoFim(col, id),
    };
    if (de !== col) campos.colunaEm = Date.now();
    // quem fez e quando: ao sair do trabalho para revisão (ou concluir)
    if (PENDENTES.includes(de) && (col === "revisao" || col === "publicado") && c.resp) {
      campos.feitoEm = Date.now();
      campos.feitoPor = c.resp;
    } else if (PENDENTES.includes(col) && c.feitoEm) {
      campos.feitoEm = null;
      campos.feitoPor = null;
    }
    this.mudar(id, campos);
  }

  /* ---------- a fila ---------- */
  agendar() {
    clearTimeout(this.t);
    this.t = setTimeout(() => void this.enviar(), 250);
  }

  async enviar() {
    if (this.indo) {
      this.deNovo = true;
      return;
    }
    this.indo = true;
    this.ultimo = Date.now();
    for (const [id, e] of [...this.pend]) {
      const c = this.achar(id);
      if (!c) {
        this.pend.delete(id);
        continue;
      }
      const enviado = (e.criar ? clone(c) : clone(e.campos)) as Record<string, unknown>;
      try {
        if (e.criar) await this.armazem.criar(enviado as Card);
        else await this.armazem.mudar(id, enviado);
        const atual = this.pend.get(id);
        if (!atual) continue;
        if (e.criar) atual.criar = false;
        // tira só o que foi enviado e não mudou desde então
        for (const k of Object.keys(atual.campos)) if (k in enviado && igual(atual.campos[k], enviado[k])) delete atual.campos[k];
        if (!atual.criar && !Object.keys(atual.campos).length) this.pend.delete(id);
        else atual.erro = null;
      } catch (err) {
        e.erro = String((err as Error)?.message || err || "erro");
        e.vezes = (e.vezes || 0) + 1;
      }
    }
    this.indo = false;
    this.avisar();
    if (this.deNovo) {
      this.deNovo = false;
      this.agendar();
    }
  }

  /** O que chega de outro aparelho: os campos que este ainda não enviou ficam. */
  receber(lista: Card[]) {
    let mudou = false;
    for (const r of lista || []) {
      if (!r || !r.id) continue;
      const l = this.achar(r.id);
      const pend = this.pend.get(r.id);
      if (!l) {
        this.cards.push(clone(r));
        mudou = true;
        continue;
      }
      for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
        if (pend && (pend.criar || k in pend.campos)) continue;
        if (k in r) {
          if (!igual(l[k], r[k])) {
            l[k] = clone(r[k]);
            mudou = true;
          }
        } else {
          delete l[k];
          mudou = true;
        }
      }
    }
    if (mudou) this.avisar();
  }
}

/**
 * Um Quadro por aba, que sobrevive a ir e voltar entre as páginas do painel:
 * o que ainda não subiu continua na fila (e tentando) mesmo fora do Quadro.
 */
let unico: QuadroStore | null = null;

export function pegarStore(cfg: Config, iniciais: Card[], cursor: string) {
  if (unico && unico.cfg.eu === cfg.eu && unico.cfg.org === cfg.org) {
    unico.cfg = cfg;
    unico.receber(iniciais);
    return unico;
  }
  const s = new QuadroStore(cfg, armazemZro(cfg.org, cursor), iniciais);
  if (!unico) {
    // tenta de novo sozinha a cada 15 s e quando a rede volta; avisa antes de fechar a aba
    setInterval(() => {
      const u = unico;
      if (u && u.pend.size && Date.now() - u.ultimo > REENVIAR_A_CADA) void u.enviar();
    }, 3000);
    addEventListener("online", () => void unico?.enviar());
    addEventListener("beforeunload", (e) => {
      if (unico?.pend.size) e.preventDefault();
    });
  }
  unico = s;
  return s;
}
