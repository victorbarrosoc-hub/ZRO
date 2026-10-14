"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./cartao";
import { cc, useQ } from "./contexto";
import { COLUNAS, NAO_SALVO_APOS, quando } from "./metodo";

/* ---------------- a faixa "Soltar em" (arrastar) ---------------- */
export function Faixa() {
  const { ui } = useQ();
  const alvo = ui.alvo && "fim" in ui.alvo && ui.alvo.faixa ? ui.alvo.fim : null;
  if (!ui.arraste) return <div className="qz-faixa" hidden />;
  return (
    <div className="qz-faixa">
      <b>Soltar em</b>
      <div className="q-faixa-lin">
        {COLUNAS.map((c) => (
          <button key={c.k} type="button" className={cn("q-faixa-bt", alvo === c.k && "alvo")} data-soltar-fim={c.k} style={cc(c.k)}>
            {c.nome}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- menu "Atribuir" ---------------- */
export function MenuPessoa() {
  const { cfg, store, ui, up } = useQ();
  const ref = useRef<HTMLDivElement>(null);
  const menu = ui.menu;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !menu) return;
    const w = 220;
    const h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(menu.left, innerWidth - w - 8)) + "px";
    el.style.top = (menu.bottom + 6 + 200 > innerHeight ? Math.max(8, menu.top - 6 - h) : menu.bottom + 6) + "px";
    el.querySelector("button")?.focus();
  }, [menu]);
  if (!menu) return <div className="qz-menu-pos" />;
  return (
    <div className="qz-menu-pos" ref={ref}>
      <div className="q-menu" role="menu" aria-label="Quem faz">
        {cfg.pessoas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="menuitem"
            data-acao="dar"
            onClick={() => {
              const x = store.achar(menu.id);
              if (x) {
                store.mudar(menu.id, { resp: p.id });
                if (x.coluna === "pauta") store.mover(menu.id, "afazer");
              }
              up({ menu: null });
            }}
          >
            <Avatar id={p.id} /> {p.nome}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- lixeira ---------------- */
export function Lixeira() {
  const { m, store, ui, up } = useQ();
  if (!ui.lixeira) return <div className="qz-painel" hidden />;
  const l = store.cards.filter((c) => c.apagadoEm && !c.varridoEm).sort((a, b) => (b.apagadoEm ?? 0) - (a.apagadoEm ?? 0));
  return (
    <div className="qz-painel">
      <div className="q-painel-in" role="dialog" aria-label="Lixeira">
        <h3>Lixeira</h3>
        {l.length ? (
          l.map((c) => (
            <div key={c.id} className="q-lix">
              <span>
                {m.titulo(c)}
                <br />
                <small>apagado {quando(c.apagadoEm)}</small>
              </span>
              <button type="button" className="q-pil" data-acao="restaurar" onClick={() => store.mudar(c.id, { apagadoEm: null, apagadoPor: null })}>
                Restaurar
              </button>
              <button type="button" className="q-pil perigo" data-acao="varrer" onClick={() => store.mudar(c.id, { varridoEm: Date.now() })}>
                Apagar de vez
              </button>
            </div>
          ))
        ) : (
          <p className="q-mut">A lixeira está vazia.</p>
        )}
        <div>
          <button type="button" className="q-pil" data-acao="fechar-painel" onClick={() => up({ lixeira: false })}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- "não salvos": o que não chegou ao banco nunca é silencioso ---------------- */
export function NaoSalvos() {
  const { m, store } = useQ();
  const [aberto, setAberto] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);
  const l = [...store.pend]
    .filter(([, e]) => agora - e.desde > NAO_SALVO_APOS)
    .map(([id, e]) => ({ c: store.achar(id), e }))
    .filter((x) => x.c);
  if (!l.length) return <div className="qz-nao-salvos" />;
  const n = l.length;
  return (
    <div className="qz-nao-salvos">
      <button type="button" className="q-ns-pil" data-acao="ns-abre" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        ⚠ {n === 1 ? "1 card não salvo" : `${n} cards não salvos`}
      </button>
      {aberto ? (
        <div className="q-ns-painel" role="dialog" aria-label="Cards não salvos">
          <b>{n === 1 ? "Este card ainda não está" : "Estes cards ainda não estão"} no banco: só neste aparelho</b>
          <ul>
            {l.map((x) => (
              <li key={x.c!.id}>
                <span className="q-ns-nome">{m.titulo(x.c!)}</span>
                <small>
                  {x.e.criar ? "criado" : "mudado"} · {x.e.erro ? `o banco recusou: ${x.e.erro}` : "ainda tentando enviar"}
                </small>
              </li>
            ))}
          </ul>
          <small>Não feche esta aba até {n === 1 ? "ele subir" : "eles subirem"}. A tentativa se repete sozinha.</small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="q-pil prim" data-acao="ns-tentar" onClick={() => void store.enviar()}>
              Tentar de novo agora
            </button>
            <button type="button" className="q-pil" data-acao="ns-abre" onClick={() => setAberto(false)}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
