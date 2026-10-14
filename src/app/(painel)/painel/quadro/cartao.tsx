"use client";

/* eslint-disable @next/next/no-img-element -- foto do freela, servida pela rota logada */
import { CalendarDays, Check, Clock, MessageSquare } from "lucide-react";
import { imageUrl } from "@/components/painel/avatar";
import { cn } from "@/lib/utils";
import { cc, useQ } from "./contexto";
import { COL, EM_TRABALHO, hoje, iniciais, rotuloDia, type Card } from "./metodo";

export function Avatar({ id }: { id?: string }) {
  const { m } = useQ();
  const p = m.pessoa(id);
  if (!p)
    return (
      <span className="q-av vazio" title="Sem responsável">
        +
      </span>
    );
  const foto = imageUrl(p.fotoId);
  return (
    <span className="q-av" title={p.nome}>
      {foto ? <img src={foto} alt="" loading="lazy" decoding="async" /> : iniciais(p.nome)}
    </span>
  );
}

/** Os botões do próximo passo (no card e na ficha). */
export function ProximoPasso({ c }: { c: Card }) {
  const { m, executar } = useQ();
  const px = m.proximo(c);
  if (!px) return null;
  return (
    <div className="q-prox" style={cc(c.coluna)}>
      {px.info ? <span className="info">{px.info}</span> : null}
      {px.bts.map(([a, r], i) => {
        const sec = i > 0 || !!px.info;
        return (
          <button
            key={a}
            type="button"
            className={sec ? "sec" : ""}
            data-acao="prox"
            data-passo={a}
            onClick={(e) => executar(c.id, a, e.currentTarget)}
          >
            {r}
            {sec ? "" : " →"}
          </button>
        );
      })}
    </div>
  );
}

export function Cartao({ c, comColuna }: { c: Card; comColuna?: boolean }) {
  const { m, ui } = useQ();
  const pz = c.prazo;
  const h = hoje();
  const trabalho = EM_TRABALHO.includes(c.coluna);
  const atrasado = !!pz && pz < h && trabalho;
  const ck = Array.isArray(c.checklist) ? c.checklist : [];
  const nMsg = Object.keys(c).filter((k) => k.startsWith("cm_")).length;
  const revisores = m.revisores();
  return (
    <article
      className={cn("q-card", c.importante && "importante", ui.arraste === c.id && "arrastando")}
      draggable
      tabIndex={0}
      data-card={c.id}
      style={cc(c.coluna)}
      aria-label={m.titulo(c)}
    >
      <div className="q-card-topo">
        <span className="q-cli">{m.cliente(m.interno(c) ? c.cliente || "casa" : c.cliente).nome}</span>
        <span>{m.formatos(c).join(" + ")}</span>
        {comColuna ? <span className="q-colb">{COL[c.coluna]?.nome ?? c.coluna}</span> : null}
      </div>
      <h3 className="q-card-tit">{c.tema}</h3>
      <div className="q-card-meta">
        {pz ? (
          <span className={cn("q-chip", atrasado ? "atrasado" : pz === h && trabalho && "hoje")} title="A equipe entrega até">
            <Clock size={11} aria-hidden />
            <em>Entrega</em> {rotuloDia(pz)}
            {c.prazoHora ? ` ${c.prazoHora}` : ""}
          </span>
        ) : null}
        {c.data && !m.interno(c) ? (
          <span className="q-chip" title="Vai ao ar">
            <CalendarDays size={11} aria-hidden />
            <em>No ar</em> {rotuloDia(c.data)}
            {c.hora ? ` ${c.hora}` : ""}
          </span>
        ) : null}
        {ck.length ? (
          <span className="q-chip">
            <Check size={11} aria-hidden /> {ck.filter((x) => x && x.ok).length}/{ck.length}
          </span>
        ) : null}
        {nMsg ? (
          <span className="q-chip">
            <MessageSquare size={11} aria-hidden /> {nMsg}
          </span>
        ) : null}
        <Avatar id={c.resp} />
      </div>
      {c.coluna === "revisao" && revisores.length ? (
        <span className="q-revisa">Revisa: {revisores.map((p) => p.nome.split(" ")[0]).join(", ")}</span>
      ) : null}
      <ProximoPasso c={c} />
    </article>
  );
}
