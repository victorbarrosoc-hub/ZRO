"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, Link2, MessageCircle, RefreshCw, Send } from "lucide-react";
import {
  desativarLinkDoCard,
  destinoLinkDoCard,
  estadoLinkDoCard,
  gerarLinkDoCard,
  trocarLinkDoCard,
  validadeLinkDoCard,
  type LinkDoCardTela,
} from "./link-card-actions";

/**
 * "Link para o freela" (aba Peça → Onde subir): o freela responsável sobe a peça final direto na pasta
 * do Drive, sem acesso ao Drive (docs/dev/drive.md §15). O estado vem sob demanda (Server Action), não
 * do cfg da Pauta; um cache por card serve a aba Peça e o "Mandar para o freela" ao mesmo tempo.
 */

export type ChaveDestino = "Master" | "Redes" | "Legendas" | "render";
type Estado = Extract<LinkDoCardTela, { ok: true }>;
type Entrada = { estado: Estado | null; carregando: boolean; em: number; erro: string | null };

const cache = new Map<string, Entrada>();
const ouvintes = new Set<() => void>();
let versao = 0;
const assinar = (fn: () => void) => {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
};
function guardar(cardId: string, e: Partial<Entrada>) {
  const antes = cache.get(cardId) ?? { estado: null, carregando: false, em: 0, erro: null };
  cache.set(cardId, { ...antes, ...e });
  versao++;
  ouvintes.forEach((f) => f());
}

async function carregar(cardId: string, forcar = false) {
  const e = cache.get(cardId);
  if (e?.carregando) return;
  if (!forcar && e && Date.now() - e.em < 20_000) return;
  guardar(cardId, { carregando: true });
  try {
    const r = await estadoLinkDoCard(cardId);
    guardar(cardId, { carregando: false, em: Date.now(), estado: r.ok ? r : null, erro: r.ok ? null : r.mensagem });
  } catch {
    guardar(cardId, { carregando: false, em: Date.now(), erro: "Sem conexão com o painel. Tente de novo." });
  }
}

/** O link do card (carrega quando `ativo`). */
export function useLinkDoCard(cardId: string, ativo: boolean) {
  useSyncExternalStore(assinar, () => versao, () => 0);
  useEffect(() => {
    if (ativo) void carregar(cardId);
  }, [cardId, ativo]);
  const e = cache.get(cardId);
  const link = e?.estado?.link ?? null;
  return { entrada: e ?? null, link, ativo: link?.estado === "ativo" && link.url ? link : null };
}

const dataBR = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" }) : "";
const isoNatal = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });

function Destinos({
  lista,
  valor,
  onEscolher,
}: {
  lista: { chave: ChaveDestino; rotulo: string }[];
  valor: ChaveDestino;
  onEscolher: (k: ChaveDestino) => void;
}) {
  return (
    <div className="q-chips" role="radiogroup" aria-label="Para onde vai">
      {lista.map((d) => (
        <button
          key={d.chave}
          type="button"
          role="radio"
          className={valor === d.chave ? "on" : ""}
          aria-checked={valor === d.chave}
          data-acao="destino-link"
          onClick={() => onEscolher(d.chave)}
        >
          {d.rotulo}
        </button>
      ))}
    </div>
  );
}

/**
 * O bloco do link dentro de "Onde subir". `secao` é a seção de 06 Entregas escolhida nos chips de
 * cima: é o destino padrão do link novo.
 */
export function LinkParaFreela({ cardId, secao }: { cardId: string; secao: "Master" | "Redes" | "Legendas" }) {
  const { entrada, link, ativo } = useLinkDoCard(cardId, true);
  const [painel, setPainel] = useState<null | "gerar" | "destino" | "trocar" | "desativar" | "validade">(null);
  const [destino, setDestino] = useState<ChaveDestino>(secao);
  const [ate, setAte] = useState("");
  const [indo, setIndo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const estado = entrada?.estado ?? null;
  const destinos = (estado?.destinos ?? []) as { chave: ChaveDestino; rotulo: string }[];

  async function fazer(fn: () => Promise<LinkDoCardTela>) {
    setIndo(true);
    setAviso(null);
    try {
      const r = await fn();
      if (r.ok) {
        guardar(cardId, { estado: r, em: Date.now(), erro: null });
        setPainel(null);
        setAviso(r.mensagem ?? null);
      } else setAviso(r.mensagem);
    } catch {
      setAviso("Sem conexão com o painel. Tente de novo.");
    } finally {
      setIndo(false);
    }
  }

  function copiar(url: string) {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1600);
      },
      () => setAviso("Não deu para copiar. Segure o link para copiar à mão."),
    );
  }

  const abrir = (p: typeof painel) => {
    setAviso(null);
    if (p === "gerar") setDestino(secao);
    if (p === "destino") setDestino((destinos.find((d) => d.rotulo === link?.destinoRotulo)?.chave ?? secao) as ChaveDestino);
    if (p === "validade") setAte(link?.expiraEm ? isoNatal(link.expiraEm) : "");
    setPainel((atual) => (atual === p ? null : p));
  };

  let corpo: React.ReactNode;
  if (!entrada || (entrada.carregando && !estado)) {
    corpo = (
      <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
        Conferindo o link…
      </p>
    );
  } else if (!estado && entrada.erro) {
    corpo = (
      <>
        <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
          {entrada.erro}
        </p>
        <div className="q-acoes">
          <button type="button" className="q-pil" data-acao="recarregar-link" onClick={() => void carregar(cardId, true)}>
            <RefreshCw size={13} aria-hidden /> Tentar de novo
          </button>
        </div>
      </>
    );
  } else if (ativo) {
    corpo = (
      <>
        <p style={{ margin: 0, fontSize: 13 }}>
          Vai para <b>{ativo.destinoRotulo ?? "a pasta do projeto"}</b>
          <span className="q-mut">{ativo.expiraEm ? ` · vale até ${dataBR(ativo.expiraEm)}` : " · sem data para expirar"}</span>
        </p>
        <p className="q-envio-url" data-campo="link-envio">
          {ativo.url}
        </p>
        <div className="q-acoes">
          <button type="button" className="q-pil prim" data-acao="copiar-link-envio" onClick={() => copiar(ativo.url!)}>
            {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
          </button>
          {estado?.whatsapp ? (
            <a className="q-pil" href={estado.whatsapp} target="_blank" rel="noopener noreferrer" data-acao="whatsapp-link-envio">
              <MessageCircle size={14} aria-hidden /> Mandar no WhatsApp
            </a>
          ) : null}
        </div>
        {!estado?.whatsapp ? (
          <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
            {estado?.freela ? `Sem WhatsApp no cadastro de ${estado.freela.nome.split(" ")[0]}.` : "O card não tem freela responsável. Copie o link e mande."}
          </p>
        ) : null}
        <div className="q-acoes">
          <button type="button" className="q-pil" data-acao="trocar-destino" aria-expanded={painel === "destino"} onClick={() => abrir("destino")}>
            Trocar destino
          </button>
          <button type="button" className="q-pil" data-acao="validade-link" aria-expanded={painel === "validade"} onClick={() => abrir("validade")}>
            Validade
          </button>
          <button type="button" className="q-pil" data-acao="trocar-link" aria-expanded={painel === "trocar"} onClick={() => abrir("trocar")}>
            <RefreshCw size={13} aria-hidden /> Trocar link
          </button>
          <button type="button" className="q-pil perigo" data-acao="desativar-link" aria-expanded={painel === "desativar"} onClick={() => abrir("desativar")}>
            Desativar
          </button>
        </div>
        {painel === "destino" ? (
          <div className="q-envio-painel">
            <p style={{ margin: 0, fontSize: 12.5 }}>Para onde a peça vai. O link continua o mesmo.</p>
            <Destinos lista={destinos} valor={destino} onEscolher={setDestino} />
            <div className="q-acoes">
              <button type="button" className="q-pil prim" disabled={indo} data-acao="salvar-destino" onClick={() => fazer(() => destinoLinkDoCard(cardId, destino))}>
                {indo ? "Salvando…" : "Salvar destino"}
              </button>
              <button type="button" className="q-pil" onClick={() => setPainel(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {painel === "validade" ? (
          <div className="q-envio-painel">
            <label className="q-campo">
              Vale até
              <input className="q-in" type="date" value={ate} min={isoNatal(new Date())} onChange={(e) => setAte(e.currentTarget.value)} />
            </label>
            <div className="q-acoes">
              <button type="button" className="q-pil prim" disabled={indo || !ate} data-acao="salvar-validade" onClick={() => fazer(() => validadeLinkDoCard(cardId, ate))}>
                {indo ? "Salvando…" : "Salvar"}
              </button>
              <button type="button" className="q-pil" onClick={() => setPainel(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {painel === "trocar" ? (
          <div className="q-envio-painel">
            <p style={{ margin: 0, fontSize: 12.5 }}>O link antigo para de funcionar. Envios já começados terminam.</p>
            <div className="q-acoes">
              <button type="button" className="q-pil prim" disabled={indo} data-acao="confirmar-trocar-link" onClick={() => fazer(() => trocarLinkDoCard(cardId))}>
                {indo ? "Trocando…" : "Trocar link"}
              </button>
              <button type="button" className="q-pil" onClick={() => setPainel(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {painel === "desativar" ? (
          <div className="q-envio-painel">
            <p style={{ margin: 0, fontSize: 12.5 }}>Desativar este link? O que já chegou fica no Drive e no card.</p>
            <div className="q-acoes">
              <button type="button" className="q-pil perigo" disabled={indo} data-acao="confirmar-desativar" onClick={() => fazer(() => desativarLinkDoCard(cardId))}>
                {indo ? "Desativando…" : "Desativar"}
              </button>
              <button type="button" className="q-pil" onClick={() => setPainel(null)}>
                Não
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  } else {
    const anterior = link ? (link.estado === "expirado" ? `O último link expirou em ${dataBR(link.expiraEm)}.` : "O último link foi desativado.") : null;
    corpo = (
      <>
        <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
          {anterior ? `${anterior} ` : ""}O freela sobe a peça direto na pasta, sem acesso ao Drive.
        </p>
        {painel === "gerar" ? (
          <div className="q-envio-painel">
            <p style={{ margin: 0, fontSize: 12.5 }}>Para onde a peça vai</p>
            <Destinos lista={destinos} valor={destino} onEscolher={setDestino} />
            <div className="q-acoes">
              <button type="button" className="q-pil prim" disabled={indo || !destinos.length} data-acao="gerar-link" onClick={() => fazer(() => gerarLinkDoCard(cardId, destino))}>
                <Send size={13} aria-hidden /> {indo ? "Gerando…" : "Gerar link"}
              </button>
              <button type="button" className="q-pil" onClick={() => setPainel(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="q-acoes">
            <button type="button" className="q-pil prim" data-acao="link-para-freela" onClick={() => abrir("gerar")}>
              <Link2 size={14} aria-hidden /> {link ? "Gerar link novo" : "Link para o freela"}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="q-envio" aria-busy={indo}>
      <p className="q-envio-tit">Link para o freela</p>
      {corpo}
      <p className="q-mut" role="status" aria-live="polite" style={{ margin: 0, fontSize: 12.5, minHeight: aviso ? undefined : 0 }}>
        {aviso ?? ""}
      </p>
    </div>
  );
}
