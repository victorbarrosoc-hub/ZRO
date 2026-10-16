"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock, Link2, MessageCircle, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProximoPasso } from "./cartao";
import { cc, useQ, type AbaFicha } from "./contexto";
import { COLUNAS, clone, linkSeguro, novoId, quando, type Card, type ColKey, type Mensagem, type Metodo, type Pessoa } from "./metodo";
import { CampoProjeto, PastasDaPeca } from "./pastas-peca";
import { PreviaLink } from "./previa-link";

/** Campos à espera de gravar ("card:campo" → timer). Fica fora da tela: fechar a ficha não perde o que foi digitado. */
const espera = new Map<string, ReturnType<typeof setTimeout>>();

function crescer(t: HTMLTextAreaElement) {
  const r = t.closest(".q-ficha-in");
  const s = r ? r.scrollTop : 0;
  t.style.height = "auto";
  t.style.height = t.scrollHeight + 2 + "px";
  if (r) r.scrollTop = s;
}

/**
 * Campo sem redesenho enquanto se digita: o valor do banco só entra quando o campo
 * não está em foco e não tem nada esperando para gravar (o cursor nunca pula).
 */
function useCampo<T extends HTMLInputElement | HTMLTextAreaElement>(id: string, k: string, valor: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el || espera.has(`${id}:${k}`)) return;
    if (el.value !== valor) el.value = valor;
    if (el instanceof HTMLTextAreaElement) crescer(el);
  });
  return ref;
}

/** Cada campo grava sozinho, um pouco depois de a pessoa parar de digitar. */
function useDigitar(id: string, k: string) {
  const { store } = useQ();
  return (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (el instanceof HTMLTextAreaElement) crescer(el);
    const chave = `${id}:${k}`;
    clearTimeout(espera.get(chave));
    espera.set(
      chave,
      setTimeout(() => {
        espera.delete(chave);
        store.mudar(id, { [k]: k === "tema" ? el.value.trim() || "Sem título" : el.value });
      }, 400),
    );
  };
}

function Texto({ c, k, rotulo, ph }: { c: Card; k: "briefing" | "texto" | "legenda"; rotulo: string; ph: string }) {
  const valor = String(c[k] ?? "");
  const ref = useCampo<HTMLTextAreaElement>(c.id, k, valor);
  const digitar = useDigitar(c.id, k);
  return (
    <div className="q-bloco">
      <h4>{rotulo}</h4>
      <textarea ref={ref} className="q-in" data-campo={k} rows={3} placeholder={ph} defaultValue={valor} onInput={(e) => digitar(e.currentTarget)} />
    </div>
  );
}

/** Data e hora: gravam na hora em que mudam. */
function Quando({ c, k, rotulo, tipo }: { c: Card; k: "prazo" | "prazoHora" | "data" | "hora"; rotulo: string; tipo: "date" | "time" }) {
  const { store, ui, up } = useQ();
  const valor = String(c[k] ?? "");
  const ref = useCampo<HTMLInputElement>(c.id, k, valor);
  return (
    <label className="q-campo">
      {rotulo}
      <input
        ref={ref}
        className={cn("q-in", ui.pede === k && "pede")}
        type={tipo}
        data-campo={k}
        defaultValue={valor}
        onChange={(e) => {
          store.mudar(c.id, { [k]: e.currentTarget.value });
          if (ui.pede === k) up({ pede: null });
        }}
      />
    </label>
  );
}

/** Item da checklist: tocar no texto (ou no lápis) edita; Enter ou sair do campo grava, Esc desiste. */
function ItemCk({ texto, onSalvar }: { texto: string; onSalvar: (t: string) => void }) {
  const [editando, setEditando] = useState(false);
  const feito = useRef(false);
  if (!editando)
    return (
      <>
        <button
          type="button"
          className="q-ck-txt"
          data-acao="ck-editar"
          onClick={() => {
            feito.current = false;
            setEditando(true);
          }}
        >
          {texto}
        </button>
        <button
          type="button"
          className="q-x"
          data-acao="ck-editar"
          aria-label="Editar item"
          onClick={() => {
            feito.current = false;
            setEditando(true);
          }}
        >
          <Pencil size={12} aria-hidden />
        </button>
      </>
    );
  const fim = (v: string | null) => {
    if (feito.current) return;
    feito.current = true;
    const t = (v ?? "").trim().slice(0, 300);
    if (v !== null && t) onSalvar(t);
    setEditando(false);
  };
  return (
    <input
      className="q-in q-ck-in"
      aria-label="Editar item da checklist"
      defaultValue={texto}
      maxLength={300}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          fim(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault(); // Esc aqui desiste da edição, não fecha a ficha
          fim(null);
        }
      }}
      onBlur={(e) => fim(e.currentTarget.value)}
    />
  );
}

const dataBR = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "");
const corta = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/** O card resumido para o freela: o que é, até quando, o que fazer e onde está o material. */
function mensagemFreela(m: Metodo, c: Card, p: Pessoa) {
  const l: string[] = [p.ola || `Oi, ${p.nome.split(" ")[0]}!`, "", `*${m.titulo(c)}*`];
  if (c.prazo) l.push(`Entrega: ${dataBR(c.prazo)}${c.prazoHora ? ` às ${c.prazoHora}` : ""}`);
  if (c.data && !m.interno(c)) l.push(`Vai ao ar: ${dataBR(c.data)}${c.hora ? ` às ${c.hora}` : ""}`);
  if (c.briefing?.trim()) l.push("", "*Briefing*", corta(c.briefing.trim(), 900));
  if (c.texto?.trim()) l.push("", "*Texto*", corta(c.texto.trim(), 600));
  const ck = (Array.isArray(c.checklist) ? c.checklist : []).filter((x) => x && !x.ok);
  if (ck.length) l.push("", "*Checklist*", ...ck.slice(0, 20).map((x) => `• ${x.t}`));
  const links = (Array.isArray(c.links) ? c.links : []).map((x) => linkSeguro(x.url)).filter(Boolean);
  if (links.length) l.push("", "*Links*", ...links.slice(0, 10));
  return l.join("\n");
}

/** "Mandar para o freela": abre o WhatsApp dele com o card e anota o envio na conversa. */
function MandarFreela({ c }: { c: Card }) {
  const { cfg, m, store } = useQ();
  const p = c.resp?.startsWith("f:") ? m.pessoa(c.resp) : null;
  if (!p) return null;
  const primeiro = p.nome.split(" ")[0];
  if (!p.whats)
    return (
      <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
        Sem WhatsApp no cadastro de {primeiro}. Cadastre em Freelas para mandar por aqui.
      </p>
    );
  return (
    <a
      className="q-pil prim q-wa"
      href={`https://wa.me/${p.whats}?text=${encodeURIComponent(mensagemFreela(m, c, p))}`}
      target="_blank"
      rel="noopener noreferrer"
      data-acao="mandar-freela"
      onClick={() => store.mudar(c.id, { ["cm_" + novoId()]: { por: cfg.eu, em: Date.now(), txt: `Mandei o card para ${primeiro} no WhatsApp.` } })}
    >
      <MessageCircle size={14} aria-hidden /> Mandar para o freela
    </a>
  );
}

export function Ficha() {
  const { ui, store } = useQ();
  // ao fechar, a ficha ainda aparece um instante, saindo de cena (ui.fichaSaindo)
  const c = store.achar(ui.ficha ?? ui.fichaSaindo);
  const visivel = !!c && !c.apagadoEm;
  const aberta = visivel && !!ui.ficha;
  return (
    <aside className={cn("qz-ficha", aberta && "aberta", visivel && !aberta && "saindo")} aria-label="Ficha do card">
      {visivel ? <FichaDentro key={c.id} c={c} /> : null}
    </aside>
  );
}

function FichaDentro({ c }: { c: Card }) {
  const { cfg, m, store, ui, up, fecharFicha } = useQ();
  const tema = useCampo<HTMLTextAreaElement>(c.id, "tema", c.tema);
  const digitarTema = useDigitar(c.id, "tema");
  const ck = Array.isArray(c.checklist) ? c.checklist : [];
  const links = Array.isArray(c.links) ? c.links : [];
  const msgs = Object.keys(c)
    .filter((k) => k.startsWith("cm_") && c[k])
    .map((k) => ({ k, ...(c[k] as Mensagem) }))
    .sort((a, b) => (+a.em || 0) - (+b.em || 0));
  const aba = ui.abaFicha;
  const interno = m.interno(c);
  const prefixo = cfg.nomePadrao && !interno ? `${m.cliente(c.cliente).nome} · ${m.formatos(c)[0]} ·` : "";
  const e = store.pend.get(c.id);
  const fmts = m.formatos(c);

  const mudar = (campos: Record<string, unknown>) => store.mudar(c.id, campos);
  function linha(ev: FormEvent<HTMLFormElement>, fn: (v: string, i: HTMLInputElement) => boolean | void) {
    ev.preventDefault();
    const f = ev.currentTarget;
    const i = f.querySelector("input")!;
    const v = (i.value || "").trim();
    if (!v) return;
    if (fn(v, i) === false) return;
    i.value = "";
    i.focus();
  }

  const abas: [AbaFicha, string, string][] = [
    ["conteudo", "Conteúdo", `${[c.briefing, c.texto, c.legenda].filter(Boolean).length}/3`],
    ["peca", "Peça", links.length ? `${links.length} ${links.length === 1 ? "link" : "links"}` : "nada"],
    ["detalhes", "Detalhes", ck.length ? `${ck.filter((x) => x.ok).length}/${ck.length}` : "—"],
  ];

  return (
    <div className="q-ficha-in" role="dialog" aria-label={m.titulo(c)}>
      <div className="q-ficha-topo">
        <select
          data-acao-mudar="coluna"
          aria-label="Coluna"
          style={cc(c.coluna)}
          value={c.coluna}
          onChange={(ev) => store.mover(c.id, ev.currentTarget.value as ColKey)}
        >
          {COLUNAS.map((x) => (
            <option key={x.k} value={x.k}>
              {x.nome}
            </option>
          ))}
        </select>
        <span className={cn("q-salvo", e?.erro && "erro")}>{!e ? "Tudo salvo" : e.erro ? "Não salvo — tentando de novo" : "Salvando…"}</span>
        <button type="button" className="q-fechar" data-acao="fechar-ficha" aria-label="Fechar" onClick={fecharFicha}>
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* Cliente à vista: card sem cliente ganha um direto; trocar de um cliente para outro pergunta antes */}
      <label className="q-campo q-cliente">
        Cliente
        <select
          className="q-in"
          data-acao-mudar="cliente"
          aria-label="Cliente do card"
          value={c.cliente || ""}
          onChange={(ev) => {
            const v = ev.currentTarget.value;
            if (v === (c.cliente || "")) return;
            // o projeto é do cliente: trocar de cliente volta o projeto para o automático
            if (!c.cliente) mudar({ cliente: v, projeto: null });
            else up({ troca: v });
          }}
        >
          {!c.cliente ? <option value="">Sem cliente: escolha…</option> : null}
          {cfg.clientes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
          {c.cliente && !cfg.clientes.some((x) => x.id === c.cliente) ? <option value={c.cliente}>{m.cliente(c.cliente).nome}</option> : null}
        </select>
      </label>

      <CampoProjeto c={c} />

      {ui.troca ? (
        <div className="q-troca">
          <p>
            Mover este card para <b>{m.cliente(ui.troca).nome}</b>? Ele sai de <b>{m.cliente(c.cliente).nome}</b>.
          </p>
          <div className="q-lin" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="q-pil prim"
              data-acao="troca-sim"
              onClick={() => {
                mudar({ cliente: ui.troca, trocouDe: c.cliente || null, trocouEm: Date.now(), projeto: null });
                up({ troca: null });
              }}
            >
              Mover para {m.cliente(ui.troca).nome}
            </button>
            <button type="button" className="q-pil" data-acao="troca-nao" onClick={() => up({ troca: null })}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {c.trocouDe ? (
        <p className="q-mut" style={{ margin: 0 }}>
          Veio de {m.cliente(c.trocouDe).nome}
          {c.trocouEm ? ` em ${quando(c.trocouEm)}` : ""}
        </p>
      ) : null}
      {prefixo ? (
        <p className="q-prefixo" style={{ margin: 0 }}>
          {prefixo}
        </p>
      ) : null}
      <textarea
        ref={tema}
        className="q-tit"
        data-campo="tema"
        rows={1}
        aria-label="Tema"
        maxLength={300}
        defaultValue={c.tema}
        onInput={(ev) => digitarTema(ev.currentTarget)}
      />
      <ProximoPasso c={c} />

      <div className="q-bloco" style={{ ["--borda-bloco" as string]: "var(--col-fazendo)" }}>
        <h4>
          <Clock size={13} aria-hidden /> Produção <span>quem faz e até quando</span>
        </h4>
        <label className="q-campo">
          Quem faz
          <select
            className="q-in"
            data-campo="resp"
            value={c.resp || ""}
            onChange={(ev) => {
              const v = ev.currentTarget.value;
              mudar({ resp: v });
              if (v && c.coluna === "pauta") store.mover(c.id, "afazer");
            }}
          >
            <option value="">Ninguém ainda</option>
            {cfg.pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
            {c.resp && !m.pessoa(c.resp) ? <option value={c.resp}>Pessoa removida</option> : null}
          </select>
        </label>
        <MandarFreela c={c} />
        <div className="q-grade2">
          <Quando c={c} k="prazo" rotulo="Entregar até" tipo="date" />
          <Quando c={c} k="prazoHora" rotulo="Hora" tipo="time" />
        </div>
      </div>
      {interno ? null : (
        <div className="q-bloco" style={{ ["--borda-bloco" as string]: "var(--q-acao)" }}>
          <h4>
            <CalendarDays size={13} aria-hidden /> Publicação <span>quando vai ao ar</span>
          </h4>
          <div className="q-grade2">
            <Quando c={c} k="data" rotulo="Vai ao ar em" tipo="date" />
            <Quando c={c} k="hora" rotulo="Às" tipo="time" />
          </div>
        </div>
      )}

      <div className="q-abas" role="tablist" aria-label="Partes do card">
        {abas.map(([k, n, x]) => (
          <button key={k} type="button" role="tab" className={aba === k ? "on" : ""} aria-selected={aba === k} data-acao="aba-ficha" onClick={() => up({ abaFicha: k })}>
            {n}
            <em>{x}</em>
          </button>
        ))}
      </div>

      <div key={aba} className="q-aba-conteudo">
      {aba === "conteudo" ? (
        <>
          <Texto c={c} k="briefing" rotulo="Briefing" ph="O que o card precisa dizer, para quem, com que objetivo" />
          <Texto c={c} k="texto" rotulo="Texto" ph="O texto da peça" />
          <Texto c={c} k="legenda" rotulo="Legenda" ph="O texto que vai publicado" />
        </>
      ) : null}

      {aba === "peca" ? <PastasDaPeca c={c} /> : null}
      {aba === "peca" ? (
        <div className="q-bloco">
          <h4>
            <Link2 size={13} aria-hidden /> Peça <span>{links.length || ""}</span>
          </h4>
          {links.map((l, i) => (
            <PreviaLink
              key={`${l.url}#${i}`}
              url={l.url}
              nome={l.nome}
              onTirar={() => {
                const n = clone(links);
                n.splice(i, 1);
                mudar({ links: n.length ? n : null });
              }}
            />
          ))}
          <form
            className="q-form-lin"
            data-form="link"
            autoComplete="off"
            onSubmit={(ev) =>
              linha(ev, (v, i) => {
                const u = linkSeguro(/^https?:\/\//i.test(v) ? v : "https://" + v);
                if (!u || !/^https?:\/\/[^\s/.]+\.[^\s]+/i.test(u)) {
                  i.setCustomValidity("Isso não parece um link");
                  i.reportValidity();
                  setTimeout(() => i.setCustomValidity(""), 1500);
                  return false;
                }
                mudar({ links: [...clone(links), { url: u, nome: u }] });
              })
            }
          >
            <input
              className="q-in"
              type="text"
              inputMode="url"
              placeholder="+ colar link da peça (Drive, YouTube, Vimeo, Frame.io, Dropbox…)"
              aria-label="Link da peça"
              onInput={(ev) => ev.currentTarget.setCustomValidity("")}
            />
          </form>
          <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
            A prévia aparece aqui: vídeo e áudio tocam, foto aparece, PSD e outros arquivos mostram o tipo. No Drive, o arquivo
            precisa estar compartilhado por link.
          </p>
        </div>
      ) : null}

      {aba === "detalhes" ? (
        <>
          <div className="q-bloco">
            <h4>
              Formato <span>pode marcar mais de um; o primeiro dá o nome</span>
            </h4>
            <div className="q-chips">
              {cfg.formatos.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={fmts.includes(f) ? "on" : ""}
                  data-acao="fmt"
                  aria-pressed={fmts.includes(f)}
                  onClick={() => {
                    const l = fmts.slice();
                    const i = l.indexOf(f);
                    if (i >= 0) {
                      if (l.length > 1) l.splice(i, 1);
                    } else l.push(f);
                    mudar({ formatos: l });
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="q-chips">
              <button
                type="button"
                className={c.importante ? "on" : ""}
                data-acao="importante"
                aria-pressed={!!c.importante}
                onClick={() => mudar({ importante: c.importante ? null : true })}
              >
                Importante
              </button>
            </div>
          </div>
          <div className="q-bloco">
            <h4>
              <Check size={13} aria-hidden /> Checklist <span>{ck.length ? `${ck.filter((x) => x.ok).length}/${ck.length}` : ""}</span>
            </h4>
            {ck.map((x, i) => (
              <div key={i} className={cn("q-ck", x.ok && "ok")}>
                <button
                  type="button"
                  className="tg"
                  data-acao="ck"
                  aria-label={x.ok ? "Desmarcar" : "Marcar"}
                  onClick={() => {
                    const l = clone(ck);
                    if (l[i]) {
                      l[i].ok = !l[i].ok;
                      mudar({ checklist: l });
                    }
                  }}
                >
                  {x.ok ? <Check size={12} aria-hidden /> : null}
                </button>
                <ItemCk
                  texto={x.t}
                  onSalvar={(t) => {
                    const l = clone(ck);
                    if (l[i] && l[i].t !== t) {
                      l[i].t = t;
                      mudar({ checklist: l });
                    }
                  }}
                />
                <button
                  type="button"
                  className="q-x"
                  data-acao="ck-x"
                  aria-label="Tirar item"
                  onClick={() => {
                    const l = clone(ck);
                    l.splice(i, 1);
                    mudar({ checklist: l.length ? l : null });
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <form
              className="q-form-lin"
              data-form="ck"
              autoComplete="off"
              onSubmit={(ev) => linha(ev, (v) => void mudar({ checklist: [...clone(ck), { t: v.slice(0, 300), ok: false }] }))}
            >
              <input className="q-in" type="text" placeholder="+ item da checklist" aria-label="Novo item da checklist" maxLength={300} />
            </form>
          </div>
        </>
      ) : null}

      </div>

      <div className="q-bloco">
        <h4>
          <MessageSquare size={13} aria-hidden /> Conversa do card
        </h4>
        <div className="q-msgs">
          {msgs.length ? (
            msgs.map((x) => (
              <div key={x.k} className="q-msg">
                <small>
                  {m.pessoa(x.por)?.nome || x.por || ""} · {quando(+x.em)}
                </small>
                <p>{x.txt}</p>
              </div>
            ))
          ) : (
            <p className="q-mut" style={{ margin: 0 }}>
              Ninguém escreveu ainda.
            </p>
          )}
        </div>
        {/* cada mensagem é um campo próprio do card (cm_<id>): duas pessoas escrevendo
            ao mesmo tempo nunca apagam a mensagem uma da outra */}
        <form
          className="q-form-lin"
          data-form="msg"
          autoComplete="off"
          onSubmit={(ev) => linha(ev, (v) => void mudar({ ["cm_" + novoId()]: { por: cfg.eu, em: Date.now(), txt: v.slice(0, 2000) } }))}
        >
          <input className="q-in" type="text" placeholder="Escreva para a equipe…" aria-label="Mensagem" maxLength={2000} />
          <button type="submit" className="q-pil prim">
            Enviar
          </button>
        </form>
      </div>

      <div className="q-pe">
        {ui.apagando ? (
          <>
            <span>Mandar para a lixeira?</span>
            <button type="button" className="q-pil" data-acao="apagar-nao" onClick={() => up({ apagando: false })}>
              Não
            </button>
            {/* apagar é LÁPIDE: o card fica guardado com a hora, e volta pela Lixeira */}
            <button
              type="button"
              className="q-pil perigo"
              data-acao="apagar-sim"
              onClick={() => {
                mudar({ apagadoEm: Date.now(), apagadoPor: cfg.eu });
                fecharFicha();
              }}
            >
              Sim, apagar
            </button>
          </>
        ) : (
          <button type="button" className="q-pil perigo" data-acao="apagar" onClick={() => up({ apagando: true })}>
            <Trash2 size={13} aria-hidden /> Apagar
          </button>
        )}
      </div>
    </div>
  );
}
