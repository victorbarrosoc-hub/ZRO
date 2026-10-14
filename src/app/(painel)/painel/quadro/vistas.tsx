"use client";

import { Fragment, type FormEvent } from "react";
import { ChevronRight, Clock, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Cartao } from "./cartao";
import { FILTRO_VAZIO, cc, useQ, type UI } from "./contexto";
import {
  COL,
  COLUNAS,
  EM_TRABALHO,
  LIMITE,
  PRAZOS,
  gruposPrazo,
  ordenar,
  passaData,
  passaPessoaCliente,
  type Card,
  type ColKey,
  type Filtro,
} from "./metodo";

const GRUPO_DATA = { Ordem: "Ver todos, em ordem de prazo", Entrega: "Entrega da equipe", Postagem: "Postagem (vai ao ar)" } as const;

export const filtrosLigados = (ui: UI) =>
  (["pessoa", "cliente", "data"] as const).filter((k) => ui.filtro[k] !== "todos" && !(k === "data" && ui.vista === "prazo")).length;

const quantosVer = (ui: UI, k: string) => ui.verMais[k] || LIMITE;
/** Em tela mais estreita, as colunas vão em duas fileiras: o trabalho da equipe em cima, cliente e publicação embaixo. */
const LINHAS = [COLUNAS.slice(0, 4), COLUNAS.slice(4)];

/* ---------------- barra: COMO ver | o que FILTRA ---------------- */
export function Barra() {
  const { cfg, m, store, ui, up, mobile } = useQ();
  const f = ui.filtro;
  const nl = filtrosLigados(ui);
  const mudarFiltro = (k: keyof Filtro, v: string) => up((u) => ({ filtro: { ...u.filtro, [k]: v }, verMais: {} }));
  // no celular o rótulo sai: a primeira opção diz o que o filtro é
  const pesP: [string, string][] = [
    ["todos", mobile ? "Pessoas" : "Todas"],
    ["meus", "Só os meus"],
    ["ninguem", "Sem responsável"],
    ...cfg.pessoas.map((p) => [p.id, p.nome] as [string, string]),
  ];
  const cliP: [string, string][] = [["todos", mobile ? "Clientes" : "Todos"], ...cfg.clientes.map((c) => [c.id, c.nome] as [string, string])];
  const base = ui.vista === "prazo" ? [] : store.vivos().filter((c) => passaPessoaCliente(cfg, c, f));
  const vista = (k: UI["vista"], t: string, Ic: typeof Clock) => (
    <button
      type="button"
      role="tab"
      aria-selected={ui.vista === k}
      className={ui.vista === k ? "on" : ""}
      data-acao="vista"
      onClick={() =>
        up((u) => {
          gravarPrefs(k, u.recolhidas);
          return { vista: k };
        })
      }
    >
      <Ic size={13} aria-hidden />
      <span>{t}</span>
    </button>
  );
  return (
    <div className="q-barra">
      <div className="q-vista" role="tablist" aria-label="Como ver os cards">
        {vista("colunas", "Colunas", Columns3)}
        {vista("prazo", "Por prazo", Clock)}
      </div>
      <div className="q-filtros" role="group" aria-label="Filtros">
        <SelFiltro rotulo="Pessoa" valor={f.pessoa} ops={pesP} onChange={(v) => mudarFiltro("pessoa", v)} />
        <SelFiltro rotulo="Cliente" valor={f.cliente} ops={cliP} onChange={(v) => mudarFiltro("cliente", v)} />
        {ui.vista !== "prazo" ? (
          <label className={cn("q-filtro", f.data !== "todos" && "ligado")}>
            <span>Data</span>
            <select data-filtro="data" aria-label="Filtrar por data" value={f.data} onChange={(e) => mudarFiltro("data", e.target.value)}>
              <option value="todos">{mobile ? "Datas" : "Qualquer data"}</option>
              {(["Ordem", "Entrega", "Postagem"] as const).map((g) => (
                <optgroup key={g} label={GRUPO_DATA[g]}>
                  {PRAZOS.filter((x) => x[2] === g).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                      {k.startsWith("ord-") ? "" : ` (${base.filter((c) => passaData(m, c, k)).length})`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : null}
        {nl ? (
          <button type="button" className="q-limpar" data-acao="limpar" onClick={() => up({ filtro: FILTRO_VAZIO })}>
            Limpar filtros ({nl})
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SelFiltro({ rotulo, valor, ops, onChange }: { rotulo: string; valor: string; ops: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className={cn("q-filtro", valor !== "todos" && "ligado")}>
      <span>{rotulo}</span>
      <select data-filtro={rotulo.toLowerCase()} aria-label={`Filtrar por ${rotulo.toLowerCase()}`} value={valor} onChange={(e) => onChange(e.target.value)}>
        {ops.map(([k, n]) => (
          <option key={k} value={k}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

const PREFS = "zro-quadro:prefs";
export function lerPrefs(): Partial<Pick<UI, "vista" | "recolhidas">> {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
    const r: Partial<Pick<UI, "vista" | "recolhidas">> = {};
    if (p.vista === "prazo" || p.vista === "colunas") r.vista = p.vista;
    if (Array.isArray(p.recolhidas)) r.recolhidas = p.recolhidas.filter((k: unknown) => typeof k === "string");
    return r;
  } catch {
    return {};
  }
}
function gravarPrefs(vista: UI["vista"], recolhidas: string[]) {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ vista, recolhidas }));
  } catch {
    // sem armazenamento no navegador: a preferência vale só agora
  }
}

/* ---------------- "Mostrar mais" ---------------- */
function Mais({ chave, total }: { chave: string; total: number }) {
  const { ui, up } = useQ();
  const ver = quantosVer(ui, chave);
  const resta = total - ver;
  return (
    <>
      {resta > 0 ? (
        <button
          type="button"
          className="q-mais"
          data-acao="mais"
          onClick={() => up((u) => ({ verMais: { ...u.verMais, [chave]: quantosVer(u, chave) + LIMITE } }))}
        >
          Mostrar mais {Math.min(LIMITE, resta)} <span>· {resta} {resta === 1 ? "escondido" : "escondidos"}</span>
        </button>
      ) : null}
      {ver > LIMITE ? (
        <button
          type="button"
          className="q-mais"
          data-acao="menos"
          onClick={() =>
            up((u) => {
              const v = { ...u.verMais };
              delete v[chave];
              return { verMais: v };
            })
          }
        >
          Mostrar só {LIMITE}
        </button>
      ) : null}
    </>
  );
}

/* ---------------- "+ Adicionar" ---------------- */
function FormAdd({ k }: { k: ColKey }) {
  const { cfg, store, ui, up } = useQ();
  if (ui.add !== k)
    return (
      <button type="button" className="q-add-bt" data-acao="add" onClick={() => up({ add: k })}>
        + Adicionar
      </button>
    );
  const cliIni = ui.filtro.cliente !== "todos" ? ui.filtro.cliente : "";
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const el = f.elements as unknown as { tema: HTMLInputElement; cliente: HTMLSelectElement; formato: HTMLSelectElement };
    const tema = el.tema.value.trim();
    if (!tema) {
      el.tema.focus();
      return;
    }
    const fp = ui.filtro.pessoa;
    store.criar({
      tema,
      cliente: el.cliente.value || null,
      formatos: [el.formato.value],
      coluna: k,
      resp: fp === "meus" ? cfg.eu : cfg.pessoas.some((p) => p.id === fp) ? fp : null,
    });
    up((u) => ({ addN: u.addN + 1 })); // o campo fica aberto para o próximo
  }
  return (
    <form key={ui.addN} className="q-add" data-form="add" autoComplete="off" onSubmit={enviar}>
      <input type="text" name="tema" placeholder="Tema do card" aria-label="Tema do card" maxLength={300} autoFocus />
      <div className="q-lin">
        <select name="cliente" aria-label="Cliente" defaultValue={cliIni}>
          <option value="">Cliente…</option>
          {cfg.clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select name="formato" aria-label="Formato">
          {cfg.formatos.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <p className="q-prev">Enter cria. O nome fica “Cliente · Formato · Tema”.</p>
      <div className="q-lin">
        <button type="submit" className="q-pil prim">
          Criar
        </button>
        <button type="button" className="q-pil" data-acao="add-fechar" onClick={() => up({ add: null })}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ---------------- colunas ---------------- */
export function VistaColunas() {
  const { cfg, m, store, ui, up, mobile } = useQ();
  const por = Object.fromEntries(COLUNAS.map((c) => [c.k, [] as Card[]])) as Record<ColKey, Card[]>;
  for (const c of store.vivos())
    if (passaPessoaCliente(cfg, c, ui.filtro) && passaData(m, c, ui.filtro.data)) (por[c.coluna] || por.pauta).push(c);
  for (const k in por) ordenar(por[k as ColKey], k, ui.filtro.data);
  const colMovel = COL[ui.colMovel] ? ui.colMovel : "afazer";
  const recolhida = (k: string) => !mobile && ui.recolhidas.includes(k);
  const recolher = (k: string) =>
    up((u) => {
      const r = u.recolhidas.includes(k) ? u.recolhidas.filter((x) => x !== k) : [...u.recolhidas, k];
      gravarPrefs(u.vista, r);
      return { recolhidas: r };
    });
  const alvo = ui.alvo && "col" in ui.alvo ? ui.alvo : null;
  const lugar = <div className="q-lugar" aria-hidden />;
  return (
    <>
      <div className="q-abas-col" role="tablist" aria-label="Colunas">
        {COLUNAS.map((c) => (
          <button
            key={c.k}
            type="button"
            role="tab"
            className={cn("q-aba-col", colMovel === c.k && "on")}
            aria-selected={colMovel === c.k}
            data-acao="col-movel"
            style={cc(c.k)}
            onClick={() => up({ colMovel: c.k })}
          >
            {c.nome} <span>{por[c.k].length}</span>
          </button>
        ))}
      </div>
      <p className="q-desc-m">{COL[colMovel].desc}</p>
      <div className="q-quadro" data-colmovel={colMovel}>
        {LINHAS.map((linha, li) => (
          <div key={li} className="q-linha">
            {linha.map((c) => {
          const l = por[c.k];
          const ver = quantosVer(ui, c.k);
          const on = colMovel === c.k ? " on" : "";
          if (recolhida(c.k))
            return (
              <section key={c.k} className={`q-col recolhida${on}`} data-col={c.k} style={cc(c.k)}>
                <button
                  type="button"
                  className="q-faixa-rec"
                  data-acao="recolher"
                  data-soltar-fim={c.k}
                  aria-label={`Abrir a coluna ${c.nome} (${l.length})`}
                  onClick={() => recolher(c.k)}
                >
                  <b>{c.nome}</b>
                  <span>{l.length}</span>
                </button>
              </section>
            );
          const visiveis = l.slice(0, ver);
          const aqui = alvo && alvo.col === c.k ? alvo : null;
          return (
            <section key={c.k} className={`q-col${on}`} data-col={c.k} style={cc(c.k)}>
              <header className="q-col-hd">
                <i />
                <b>{c.nome}</b>
                <span>{l.length}</span>
                <button
                  type="button"
                  className="q-recolhe"
                  data-acao="recolher"
                  aria-label={`Recolher a coluna ${c.nome}`}
                  onClick={() => recolher(c.k)}
                >
                  <ChevronRight size={12} aria-hidden />
                </button>
              </header>
              <p className="q-col-desc">{c.desc}</p>
              <div className="q-col-corpo" data-soltar={c.k}>
                {visiveis.map((x) => (
                  <Fragment key={x.id}>
                    {aqui && aqui.antes === x.id ? lugar : null}
                    <Cartao c={x} />
                  </Fragment>
                ))}
                {!visiveis.length ? <p className="q-vazio">{c.k === "pauta" ? "Tudo distribuído." : "Nada aqui."}</p> : null}
                {aqui && (aqui.antes === null || !visiveis.some((x) => x.id === aqui.antes)) ? lugar : null}
                <Mais chave={c.k} total={l.length} />
              </div>
              <FormAdd k={c.k} />
            </section>
          );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- por prazo ---------------- */
/** Os mesmos cards em faixas de tempo. "Entrega da equipe" mostra só o que ainda é trabalho da casa. */
export function VistaPorPrazo() {
  const { cfg, m, store, ui, up } = useQ();
  const ar = ui.baseAr;
  const base = store.vivos().filter((c) => passaPessoaCliente(cfg, c, ui.filtro));
  const itens = ar ? base.filter((c) => !m.interno(c) && c.coluna !== "publicado") : base.filter((c) => EM_TRABALHO.includes(c.coluna));
  const fora = base.length - itens.length;
  const secoes = gruposPrazo(itens, ar).filter((x) => x.l.length);
  return (
    <>
      <div className="q-pzbase" role="tablist" aria-label="Qual data">
        <button type="button" role="tab" className={!ar ? "on" : ""} aria-selected={!ar} data-acao="pz-base" onClick={() => up({ baseAr: false })}>
          Entrega da equipe
        </button>
        <button type="button" role="tab" className={ar ? "on" : ""} aria-selected={ar} data-acao="pz-base" onClick={() => up({ baseAr: true })}>
          Vai ao ar
        </button>
        <span className="q-mut">
          {itens.length} {itens.length === 1 ? "card" : "cards"}
          {fora ? ` · ${fora} ${ar ? "já no ar ou internos" : "já saíram da equipe"}` : ""}
        </span>
      </div>
      <div className="q-porprazo">
        {secoes.length ? (
          secoes.map((x) => {
            const k = `pz-${x.k}`;
            return (
              <section key={x.k} className={`q-pz q-pz-${x.k}`} data-pz={x.k}>
                <header className="q-pz-hd">
                  <b>{x.n}</b>
                  <span>{x.l.length}</span>
                </header>
                <div className="q-pz-grade">
                  {x.l.slice(0, quantosVer(ui, k)).map((c) => (
                    <Cartao key={c.id} c={c} comColuna />
                  ))}
                </div>
                <Mais chave={k} total={x.l.length} />
              </section>
            );
          })
        ) : (
          <p className="q-vazio">
            {ar ? "Nenhum card esperando para ir ao ar" : "Nada por fazer"}
            {filtrosLigados(ui) ? " com esses filtros" : ""}.
          </p>
        )}
      </div>
    </>
  );
}
