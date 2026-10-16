"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FolderOpen, Upload } from "lucide-react";
import { useQ } from "./contexto";
import type { Card, Config, PastaPauta, ProjetoPauta } from "./metodo";

/**
 * O projeto do card e as pastas onde a peça final sobe (aba "Peça").
 * Card sem projeto escolhido usa o único projeto ativo do cliente, sem gravar nada.
 */

const NENHUM = "nenhum";
const SECOES = ["Master", "Redes", "Legendas"] as const;
/** Formatos que vão para 06 Entregas/Redes; o resto vai para Master. */
const DE_REDES = new Set(["Post", "Carrossel", "Reels", "Story", "Shorts", "Foto"]);

/** Projetos que servem para o cliente do card (Interno ou sem cliente: todos). */
function projetosDoCliente(cfg: Config, c: Card): ProjetoPauta[] {
  const todos = cfg.projetos ?? [];
  const daCasa = !c.cliente || cfg.clientes.find((x) => x.id === c.cliente)?.interno;
  return daCasa ? todos : todos.filter((p) => p.cliente === c.cliente);
}

export function projetoDoCard(cfg: Config, c: Card): { projeto: ProjetoPauta | null; automatico: boolean } {
  if (c.projeto === NENHUM) return { projeto: null, automatico: false };
  if (c.projeto) return { projeto: cfg.projetos?.find((p) => p.id === c.projeto) ?? null, automatico: false };
  const daCasa = !c.cliente || cfg.clientes.find((x) => x.id === c.cliente)?.interno;
  if (daCasa) return { projeto: null, automatico: false };
  const ativos = projetosDoCliente(cfg, c).filter((p) => p.ativo);
  return ativos.length === 1 ? { projeto: ativos[0], automatico: true } : { projeto: null, automatico: false };
}

/** Campo "Projeto" logo abaixo do cliente. */
export function CampoProjeto({ c }: { c: Card }) {
  const { cfg, store } = useQ();
  if (!cfg.projetos) return null;
  const { projeto, automatico } = projetoDoCard(cfg, c);
  const lista = projetosDoCliente(cfg, c)
    .filter((p) => p.ativo || p.id === c.projeto)
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  const escolhido = c.projeto && c.projeto !== NENHUM ? cfg.projetos.find((p) => p.id === c.projeto) : null;
  if (escolhido && !lista.some((p) => p.id === escolhido.id)) lista.push(escolhido);
  const valor = c.projeto === NENHUM ? NENHUM : (projeto?.id ?? "");
  return (
    <label className="q-campo q-cliente">
      <span>
        Projeto{automatico ? <span className="q-mut"> · o único ativo do cliente</span> : null}
      </span>
      <select
        className="q-in"
        data-acao-mudar="projeto"
        aria-label="Projeto do card"
        value={valor}
        onChange={(ev) => store.mudar(c.id, { projeto: ev.currentTarget.value || null })}
      >
        {valor === "" ? <option value="">{lista.length ? "Escolha o projeto…" : "Nenhum projeto ativo deste cliente"}</option> : null}
        <option value={NENHUM}>Sem projeto</option>
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {p.titulo}
            {p.ativo ? "" : " (encerrado)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function secaoSugerida(c: Card): (typeof SECOES)[number] {
  const primeiro = Array.isArray(c.formatos) ? c.formatos[0] : undefined;
  return primeiro && DE_REDES.has(primeiro) ? "Redes" : "Master";
}

function Pasta({ pasta, nome, nota }: { pasta: PastaPauta; nome: string; nota: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{nome}</p>
        <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
          {nota}
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <a className="q-pil prim" href={`/painel/arquivos?pasta=${encodeURIComponent(pasta.id)}`} data-acao="enviar-peca">
          <Upload size={14} aria-hidden /> Enviar aqui
        </a>
        <a className="q-pil" href={pasta.url} target="_blank" rel="noopener noreferrer" data-acao="abrir-pasta">
          <ExternalLink size={14} aria-hidden /> Abrir no Drive
        </a>
        <button
          type="button"
          className="q-pil"
          data-acao="copiar-pasta"
          onClick={() =>
            navigator.clipboard.writeText(pasta.url).then(
              () => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1600);
              },
              () => {},
            )
          }
        >
          {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}

/** Bloco "Onde subir", no topo da aba Peça. */
export function PastasDaPeca({ c }: { c: Card }) {
  const { cfg } = useQ();
  const [secao, setSecao] = useState<(typeof SECOES)[number]>(() => secaoSugerida(c));
  if (!cfg.projetos) return null;
  const { projeto } = projetoDoCard(cfg, c);

  let corpo: React.ReactNode;
  if (!projeto) {
    corpo = (
      <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
        Escolha o projeto do card, logo abaixo do cliente, para ver as pastas do Drive.
      </p>
    );
  } else if (!projeto.pastas || (!projeto.pastas.entregas && !projeto.pastas.render)) {
    corpo = (
      <>
        <p className="q-mut" style={{ margin: 0, fontSize: 12.5 }}>
          {projeto.titulo} ainda não tem pasta no Drive.
        </p>
        <div>
          <a className="q-pil" href={`/painel/projetos/${encodeURIComponent(projeto.id)}?aba=drive`}>
            <FolderOpen size={14} aria-hidden /> Criar pastas no projeto
          </a>
        </div>
      </>
    );
  } else {
    const entrega = projeto.pastas.secoes[secao] ?? projeto.pastas.entregas;
    corpo = (
      <>
        {entrega ? (
          <>
            <div className="q-chips" role="group" aria-label="Seção de 06 Entregas">
              {SECOES.map((s) => (
                <button key={s} type="button" className={secao === s ? "on" : ""} aria-pressed={secao === s} data-acao="secao-entrega" onClick={() => setSecao(s)}>
                  {s}
                </button>
              ))}
            </div>
            <Pasta
              pasta={entrega}
              nome={`06 Entregas / ${projeto.pastas.secoes[secao] ? secao : ""}`.replace(/ \/ $/, "")}
              nota={
                projeto.entregasLiberadas
                  ? "A versão final. As entregas estão liberadas: o cliente vê na hora o que entrar aqui."
                  : "A versão final. O cliente vê quando as entregas forem liberadas no projeto."
              }
            />
          </>
        ) : null}
        {projeto.pastas.render ? (
          <Pasta pasta={projeto.pastas.render} nome="05 Render" nota="Só a equipe vê. Cortes e versões antes da entrega." />
        ) : null}
      </>
    );
  }

  return (
    <div className="q-bloco" style={{ ["--borda-bloco" as string]: "var(--col-aprovado)" }}>
      <h4>
        <FolderOpen size={13} aria-hidden /> Onde subir <span>{projeto ? projeto.titulo : "a peça final"}</span>
      </h4>
      {corpo}
    </div>
  );
}
