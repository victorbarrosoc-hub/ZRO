"use client";

/**
 * O Quadro: o kanban da Maestro com a cara da ZRO. Mesmo método, mesmo
 * comportamento do esqueleto (docs/quadro/quadro-kanban.html), quebrado em
 * peças: barra, colunas, card, ficha, faixa "Soltar em" e aviso "não salvos".
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Faixa, Lixeira, MenuPessoa, NaoSalvos } from "./avisos";
import { FILTRO_VAZIO, QCtx, type Alvo, type Q, type UI } from "./contexto";
import { Ficha } from "./ficha";
import { COL, COLUNAS, metodo, ordemEntre, type Card, type ColKey, type Config } from "./metodo";
import { pegarStore } from "./store";
import { Barra, VistaColunas, VistaPorPrazo, lerPrefs } from "./vistas";

const MQ = "(max-width: 760px)";
const nada = () => () => {};

function useMobile() {
  return useSyncExternalStore(
    (fn) => {
      const q = matchMedia(MQ);
      q.addEventListener("change", fn);
      return () => q.removeEventListener("change", fn);
    },
    () => matchMedia(MQ).matches,
    () => false,
  );
}

type Props = { cfg: Config; iniciais: Card[]; cursor: string };

export function QuadroApp(props: Props) {
  // As datas ("hoje", "amanhã") são as do aparelho: o Quadro só desenha no navegador.
  const noNavegador = useSyncExternalStore(nada, () => true, () => false);
  if (!noNavegador)
    return (
      <div className="qz">
        <Topo nLix={0} />
        <p className="q-vazio">Abrindo a pauta…</p>
      </div>
    );
  return <Quadro {...props} />;
}

function Topo({ nLix, abrir }: { nLix: number; abrir?: () => void }) {
  return (
    <header className="q-topo">
      <h1>Pauta</h1>
      <span className="q-esp" />
      <button type="button" className="q-pil" data-acao="lixeira" onClick={abrir}>
        Lixeira <span>{nLix ? String(nLix) : ""}</span>
      </button>
    </header>
  );
}

const alvoDe = (el: EventTarget | null) =>
  el instanceof Element ? el.closest<HTMLElement>("[data-soltar], [data-soltar-fim]") : null;

/** Os cards da coluna em volta do ponto y (sem o que está sendo arrastado). */
function vizinhos(corpo: HTMLElement, y: number, id: string | null) {
  const cards = [...corpo.querySelectorAll<HTMLElement>(".q-card")].filter((x) => x.dataset.card !== id);
  let i = cards.findIndex((x) => {
    const r = x.getBoundingClientRect();
    return y < r.top + r.height / 2;
  });
  if (i < 0) i = cards.length;
  return { antes: cards[i - 1] ?? null, depois: cards[i] ?? null };
}

const mesmoAlvo = (a: Alvo | null, b: Alvo | null) => JSON.stringify(a) === JSON.stringify(b);

type Toque = {
  x: number;
  y: number;
  em: number;
  card: HTMLElement | null;
  ativo: boolean;
  deslize: boolean;
  timer?: ReturnType<typeof setTimeout>;
  dx?: number;
  dy?: number;
  fantasma?: HTMLElement;
  alvo?: HTMLElement | null;
  ay?: number;
  /** Deslize: o eixo do gesto (decidido nos primeiros pixels) e a coluna que segue o dedo. */
  eixo?: "x" | "y";
  col?: HTMLElement | null;
};

/** Coluna que seguiu o dedo volta para o lugar (ou só limpa, se vai sumir). */
function soltarColuna(col: HTMLElement | null | undefined, animar: boolean) {
  if (!col) return;
  if (!animar) {
    col.style.transition = col.style.transform = col.style.opacity = "";
    return;
  }
  col.style.transition = "transform .28s cubic-bezier(.16,1,.3,1), opacity .28s ease";
  col.style.transform = "";
  col.style.opacity = "";
  setTimeout(() => (col.style.transition = ""), 300);
}

function Quadro({ cfg, iniciais, cursor }: Props) {
  const [store] = useState(() => pegarStore(cfg, iniciais, cursor));
  useSyncExternalStore(store.subscribe, store.getVersao, store.getVersao);
  const m = useMemo(() => metodo(cfg), [cfg]);
  const mobile = useMobile();
  const [ui, setUi] = useState<UI>(() => ({
    vista: "colunas",
    filtro: FILTRO_VAZIO,
    colMovel: "afazer",
    verMais: {},
    recolhidas: ["publicado"],
    ficha: null,
    abaFicha: "conteudo",
    baseAr: false,
    add: null,
    addN: 0,
    troca: null,
    apagando: false,
    lixeira: false,
    menu: null,
    arraste: null,
    alvo: null,
    pede: null,
    fichaSaindo: null,
    dirMovel: 1,
    ...lerPrefs(),
  }));

  // O que os ouvintes do documento (arrastar, toque, clique, Esc) precisam ler na hora.
  const uiRef = useRef(ui);
  const arraste = useRef<string | null>(null);
  const arrastou = useRef(0);
  const alvoAtual = useRef<Alvo | null>(null);
  useEffect(() => {
    uiRef.current = ui;
  });

  const q = useMemo<Q>(() => {
    const up: Q["up"] = (p) => setUi((u) => ({ ...u, ...(typeof p === "function" ? p(u) : p) }));
    const abrirFicha: Q["abrirFicha"] = (id, campoFoco) => {
      up({ ficha: id, fichaSaindo: null, troca: null, apagando: false, pede: campoFoco ?? null });
      if (campoFoco)
        setTimeout(() => {
          const el = document.querySelector<HTMLElement>(`.qz-ficha [data-campo="${campoFoco}"]`);
          if (el) {
            el.focus();
            el.scrollIntoView({ block: "center" });
          }
        }, 30);
    };
    const fecharFicha = () => {
      setUi((u) => (u.ficha ? { ...u, ficha: null, pede: null, fichaSaindo: u.ficha } : u));
      setTimeout(() => setUi((u) => (u.fichaSaindo && !u.ficha ? { ...u, fichaSaindo: null } : u)), 200);
    };
    const executar: Q["executar"] = (id, acao, bt) => {
      const c = store.achar(id);
      if (!c) return;
      if (acao === "atribuir") {
        const r = bt.getBoundingClientRect();
        up({ menu: { id, left: r.left, top: r.top, bottom: r.bottom } });
        return;
      }
      if (acao === "agendar" && !c.data && !m.interno(c)) {
        abrirFicha(id, "data");
        return;
      }
      const destino = acao === "devolver" || acao === "ajuste" ? "fazendo" : acao === "agendar" ? "agendado" : acao;
      if (!(destino in COL)) return;
      store.mover(id, destino as ColKey);
    };
    return { store, cfg, m, ui, mobile, up, abrirFicha, fecharFicha, executar };
  }, [store, cfg, m, ui, mobile]);

  const qRef = useRef(q);
  useEffect(() => {
    qRef.current = q;
  });

  // ouvir o banco, e deixar o Quadro à mão para a plataforma (e para as provas)
  useEffect(() => {
    const parar = store.armazem.ouvir((l) => store.receber(l));
    (window as unknown as { Quadro?: unknown }).Quadro = { store, cfg };
    return parar;
  }, [store, cfg]);

  // no celular, a aba da coluna à vista fica centralizada
  useEffect(() => {
    if (!mobile) return;
    document.querySelector(".q-aba-col.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [ui.colMovel, mobile]);

  /* ---------------- arrastar, tocar, clicar, teclar ---------------- */
  useEffect(() => {
    const up = (p: Partial<UI>) => qRef.current.up(p);
    const marcar = (alvo: Alvo | null) => {
      if (mesmoAlvo(alvo, alvoAtual.current)) return;
      alvoAtual.current = alvo;
      up({ alvo });
    };
    const marcarAlvo = (el: HTMLElement, y: number) => {
      const fim = el.dataset.soltarFim as ColKey | undefined;
      if (fim) return marcar({ fim, faixa: el.classList.contains("q-faixa-bt") });
      const v = vizinhos(el, y, arraste.current);
      marcar({ col: el.dataset.soltar as ColKey, antes: v.depois?.dataset.card ?? null });
    };
    const soltar = (el: HTMLElement, y: number) => {
      const id = arraste.current;
      if (!id) return;
      const { store } = qRef.current;
      if (el.dataset.soltarFim) store.mover(id, el.dataset.soltarFim as ColKey);
      else {
        const v = vizinhos(el, y, id);
        const a = v.antes ? store.achar(v.antes.dataset.card) : null;
        const b = v.depois ? store.achar(v.depois.dataset.card) : null;
        store.mover(id, el.dataset.soltar as ColKey, ordemEntre(a, b));
      }
      arrastou.current = Date.now();
    };
    const fimArraste = () => {
      arraste.current = null;
      alvoAtual.current = null;
      up({ arraste: null, alvo: null });
    };

    // computador: arrastar de verdade (e a faixa com as oito colunas embaixo)
    const dragstart = (e: DragEvent) => {
      const card = e.target instanceof Element ? e.target.closest<HTMLElement>(".q-card") : null;
      if (!card || !e.dataTransfer) return;
      arraste.current = card.dataset.card ?? null;
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", arraste.current ?? "");
      } catch {}
      setTimeout(() => up({ arraste: arraste.current }), 0);
    };
    const dragover = (e: DragEvent) => {
      if (!arraste.current) return;
      const a = alvoDe(e.target);
      if (!a) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      marcarAlvo(a, e.clientY);
    };
    const drop = (e: DragEvent) => {
      if (!arraste.current) return;
      const a = alvoDe(e.target);
      if (!a) return;
      e.preventDefault();
      soltar(a, e.clientY);
      // o card mudou de coluna e saiu da página: o "dragend" dele não chega mais aqui
      fimArraste();
    };
    const dragend = () => {
      if (arraste.current) fimArraste();
    };

    // celular: segurar o card, arrastar até a faixa; deslizar para o lado troca de coluna
    let toque: Toque | null = null;
    const touchstart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        toque = null;
        return;
      }
      const t = e.touches[0];
      const alvo = e.target instanceof Element ? e.target : null;
      const card = alvo?.closest<HTMLElement>(".q-card") ?? null;
      const naFicha = !!alvo?.closest(".qz-ficha, .qz-painel, .qz-menu-pos, input, textarea, select");
      // segurar para arrastar não começa num botão; deslizar para o lado pode (o toque que anda não vira clique)
      const noBotao = !!alvo?.closest("button");
      const u = uiRef.current;
      const mob = matchMedia(MQ).matches;
      toque = {
        x: t.clientX,
        y: t.clientY,
        em: Date.now(),
        card: naFicha || noBotao ? null : card,
        ativo: false,
        deslize: !naFicha && mob && u.vista === "colunas" && !!alvo?.closest(".q-quadro"),
      };
      const tq = toque;
      if (tq.card)
        tq.timer = setTimeout(() => {
          if (toque !== tq || !tq.card) return;
          tq.ativo = true;
          arraste.current = tq.card.dataset.card ?? null;
          const r = tq.card.getBoundingClientRect();
          const g = tq.card.cloneNode(true) as HTMLElement;
          g.classList.add("q-fantasma");
          g.style.width = r.width + "px";
          g.style.left = r.left + "px";
          g.style.top = r.top + "px";
          tq.dx = tq.x - r.left;
          tq.dy = tq.y - r.top;
          tq.fantasma = g;
          (document.querySelector(".qz") ?? document.body).appendChild(g);
          up({ arraste: arraste.current });
          try {
            navigator.vibrate?.(10);
          } catch {}
        }, 380);
    };
    const touchmove = (e: TouchEvent) => {
      if (!toque) return;
      const t = e.touches[0];
      if (!toque.ativo) {
        const dx = t.clientX - toque.x;
        const dy = t.clientY - toque.y;
        if (Math.hypot(dx, dy) > 10) clearTimeout(toque.timer);
        if (!toque.eixo && Math.hypot(dx, dy) > 8) toque.eixo = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        // deslize para o lado: a coluna acompanha o dedo (com resistência na primeira e na última)
        if (toque.deslize && toque.eixo === "x") {
          e.preventDefault();
          toque.col ??= document.querySelector<HTMLElement>(".q-col.on");
          const ks = COLUNAS.map((c) => c.k);
          const i = ks.indexOf(uiRef.current.colMovel);
          const borda = (i === 0 && dx > 0) || (i === ks.length - 1 && dx < 0);
          const d = borda ? dx * 0.25 : dx;
          if (toque.col) {
            toque.col.style.transition = "none";
            toque.col.style.transform = `translateX(${d}px)`;
            toque.col.style.opacity = String(1 - Math.min(Math.abs(d) / 520, 0.4));
          }
        }
        return;
      }
      e.preventDefault();
      if (toque.fantasma) {
        toque.fantasma.style.left = t.clientX - (toque.dx ?? 0) + "px";
        toque.fantasma.style.top = t.clientY - (toque.dy ?? 0) + "px";
      }
      const a = alvoDe(document.elementFromPoint(t.clientX, t.clientY));
      toque.alvo = a;
      toque.ay = t.clientY;
      if (a) marcarAlvo(a, t.clientY);
      else marcar(null);
    };
    const touchend = (e: TouchEvent) => {
      if (!toque) return;
      clearTimeout(toque.timer);
      const t = e.changedTouches[0];
      const tq = toque;
      toque = null;
      if (tq.ativo) {
        e.preventDefault();
        tq.fantasma?.remove();
        if (tq.alvo) soltar(tq.alvo, tq.ay ?? 0);
        arrastou.current = Date.now();
        fimArraste();
        return;
      }
      if (tq.deslize) {
        const dx = t.clientX - tq.x;
        const dy = t.clientY - tq.y;
        const rapido = Date.now() - tq.em < 300 && Math.abs(dx) > 30;
        let trocou = false;
        if ((Math.abs(dx) > 60 || rapido) && Math.abs(dy) < Math.abs(dx) * 0.6) {
          const ks = COLUNAS.map((c) => c.k);
          const i = ks.indexOf(uiRef.current.colMovel);
          const j = Math.max(0, Math.min(ks.length - 1, i + (dx < 0 ? 1 : -1)));
          if (j !== i) {
            trocou = true;
            up({ colMovel: ks[j], dirMovel: dx < 0 ? 1 : -1 });
          }
        }
        // trocou: a coluna velha some e a nova entra deslizando; senão a coluna volta para o lugar
        soltarColuna(tq.col, !trocou);
      }
    };
    const touchcancel = () => {
      soltarColuna(toque?.col, true);
      toque?.fantasma?.remove();
      if (toque?.ativo) fimArraste();
      toque = null;
    };

    // cliques fora: fecham o menu e a ficha; clique no card abre a ficha
    const click = (e: MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const { up: upQ, abrirFicha, fecharFicha } = qRef.current;
      const u = uiRef.current;
      const a = t.closest<HTMLElement>("[data-acao]");
      if (u.menu && !t.closest(".qz-menu-pos") && !(a && a.dataset.passo === "atribuir")) upQ({ menu: null });
      if (a) return;
      const card = t.closest<HTMLElement>(".q-card");
      if (card && Date.now() - arrastou.current > 400 && card.dataset.card) abrirFicha(card.dataset.card);
      else if (u.ficha && !card && !t.closest(".qz-ficha, .qz-painel, .qz-nao-salvos, .qz-menu-pos")) fecharFicha();
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // um campo já usou a tecla (ex.: Esc na edição da checklist)
      const u = uiRef.current;
      const { abrirFicha, fecharFicha } = qRef.current;
      if (e.key === "Escape") {
        if (u.menu) return up({ menu: null });
        if (u.lixeira) return up({ lixeira: false });
        if (u.add) return up({ add: null });
        if (u.ficha) return fecharFicha();
      }
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (e.key === "Enter" && t?.classList.contains("q-card") && t.dataset.card) abrirFicha(t.dataset.card);
    };

    document.addEventListener("dragstart", dragstart);
    document.addEventListener("dragover", dragover);
    document.addEventListener("drop", drop);
    document.addEventListener("dragend", dragend);
    document.addEventListener("touchstart", touchstart, { passive: true });
    document.addEventListener("touchmove", touchmove, { passive: false });
    document.addEventListener("touchend", touchend);
    document.addEventListener("touchcancel", touchcancel);
    document.addEventListener("click", click);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("dragstart", dragstart);
      document.removeEventListener("dragover", dragover);
      document.removeEventListener("drop", drop);
      document.removeEventListener("dragend", dragend);
      document.removeEventListener("touchstart", touchstart);
      document.removeEventListener("touchmove", touchmove);
      document.removeEventListener("touchend", touchend);
      document.removeEventListener("touchcancel", touchcancel);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", keydown);
      touchcancel();
    };
  }, []);

  const nLix = store.cards.filter((c) => c.apagadoEm && !c.varridoEm).length;
  return (
    <QCtx.Provider value={q}>
      <div className="qz">
        <Topo nLix={nLix} abrir={() => q.up({ lixeira: true })} />
        <div className="q-area" aria-live="polite">
          <Barra />
          {ui.vista === "prazo" ? <VistaPorPrazo /> : <VistaColunas />}
        </div>
        <Ficha />
        <Faixa />
        <MenuPessoa />
        <Lixeira />
        <NaoSalvos />
      </div>
    </QCtx.Provider>
  );
}
