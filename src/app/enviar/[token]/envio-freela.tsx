"use client";

import { Check, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Aviso,
  AvisosDaFila,
  LOTES_FINAIS,
  LotePublico,
  arquivosBR,
  estilos,
  porcento,
  textoIgnorados,
} from "@/components/envio/fila-publica";
import { Seletor, useEhIOS, useSemSolturaFora } from "@/components/envio/seletor";
import { bytesBR } from "@/lib/drive/bytes";
import { FONTES, acharFonte } from "@/lib/drive/estrutura";
import type { LoteFila } from "@/lib/drive/navegador/motor";
import { impressao as calcularImpressao, type Selecao } from "@/lib/drive/navegador/selecao";
import { transporteDaRota } from "@/lib/drive/navegador/transporte";
import { useMotor } from "@/lib/drive/navegador/use-motor";
import { textoLimiteLink, type Destino, type FonteChave } from "@/lib/drive/protocolo";
import type { DadosDiaria } from "@/lib/services/drive-publico";
import { cn } from "@/lib/utils";

/**
 * O fluxo do freela (docs/dev/drive.md §8.2): quem é, qual câmera, o cartão, o resumo e o envio.
 * Cada cartão é um lote; o número do rolo vem do servidor. Um envio que parou (conexão, recarga)
 * continua quando a pessoa escolhe o mesmo cartão: o servidor devolve o mesmo rolo e o ponto de cada
 * arquivo. O aparelho guarda só quem e qual câmera de cada rolo, para preencher de novo.
 */

type Pessoa = { tipo: "id"; id: string; rotulo: string } | { tipo: "nome" };
type Escolha = { pessoa: { freelancerId: string } | { nome: string }; rotulo: string; fonte: FonteChave; gravador: string | null };

/* ---------- o que o aparelho lembra de cada rolo (só quem e a câmera; nunca arquivo nem sessão) ---------- */

const chaveLocal = (linkId: string) => `zro.enviar.v1.${linkId}`;

function lerEscolhas(linkId: string): Record<string, Escolha & { em: number }> {
  try {
    const bruto = localStorage.getItem(chaveLocal(linkId));
    const v = bruto ? (JSON.parse(bruto) as Record<string, Escolha & { em: number }>) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function guardarEscolha(linkId: string, loteId: string, e: Escolha) {
  try {
    const todas = lerEscolhas(linkId);
    todas[loteId] = { ...e, em: Date.now() };
    const recentes = Object.entries(todas)
      .sort((a, b) => b[1].em - a[1].em)
      .slice(0, 30);
    localStorage.setItem(chaveLocal(linkId), JSON.stringify(Object.fromEntries(recentes)));
  } catch {
    // sem armazenamento: a retomada continua valendo pelo mesmo cartão
  }
}

/** "A003 · Câm A · …" → "A003" (áudio não tem rolo). */
function roloDe(rotulo: string | null | undefined): string | null {
  const primeiro = (rotulo ?? "").split(" · ")[0]?.trim() ?? "";
  return /^[A-Z]\d{3,}$/.test(primeiro) ? primeiro : null;
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

/* ============================== Tela ============================== */

export function EnvioFreela({ token, linkId, diaria }: { token: string; linkId: string; diaria: DadosDiaria }) {
  const [transporte] = useState(() => transporteDaRota(`/enviar/${encodeURIComponent(token)}/api`));
  const { motor, foto } = useMotor({ transporte, escopo: `enviar:${linkId}`, voz: "publico" });
  useSemSolturaFora();
  const ios = useEhIOS();
  const idGravadores = useId();

  const semLista = diaria.pessoas.length === 0;
  const [pessoaEscolhida, setPessoa] = useState<Pessoa | null>(null);
  const pessoa: Pessoa | null = semLista ? { tipo: "nome" } : pessoaEscolhida;
  const [nome, setNome] = useState("");
  const [fonte, setFonte] = useState<FonteChave | null>(null);
  const [gravador, setGravador] = useState("");
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [marca, setMarca] = useState<{ s: Selecao; h: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [outro, setOutro] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [dispensados, setDispensados] = useState<string[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const guardados = useRef(new Set<string>());

  // Quando o servidor devolve o número do lote, o aparelho anota quem e qual câmera (para a retomada).
  useEffect(() => {
    for (const l of foto.lotes) {
      const e = escolhas[l.chave];
      if (!l.loteId || !e || guardados.current.has(l.loteId)) continue;
      guardados.current.add(l.loteId);
      guardarEscolha(linkId, l.loteId, e);
    }
  }, [foto.lotes, escolhas, linkId]);

  const visiveis = foto.lotes.filter((l) => !ocultos.includes(l.chave));
  const emAndamento = foto.lotes.some((l) => !LOTES_FINAIS.has(l.estado));
  const mostrarFormulario = !emAndamento && (outro || visiveis.length === 0);
  const retomaveis = foto.retomaveis.filter((s) => !dispensados.includes(s.loteId));
  const impressaoAtual = marca && marca.s === selecao ? marca.h : null;
  const retomando = impressaoAtual ? foto.retomaveis.find((s) => s.impressao === impressaoAtual) : undefined;
  const rotuloPessoa = pessoa?.tipo === "id" ? pessoa.rotulo : nome.trim();
  const f = acharFonte(fonte);

  function escolher(s: Selecao) {
    setErro(null);
    if (!s.arquivos.length) {
      setSelecao(null);
      setErro("Nada para enviar: só havia arquivos do sistema.");
      return;
    }
    setSelecao(s);
    calcularImpressao(s)
      .then((h) => setMarca({ s, h }))
      .catch(() => {});
  }

  function comecar() {
    if (!pessoa) return setErro("Toque no seu nome para continuar.");
    const nomeLimpo = nome.trim();
    if (pessoa.tipo === "nome" && nomeLimpo.length < 2) return setErro("Digite o seu nome.");
    if (!fonte) return setErro("Escolha a câmera deste cartão.");
    const gravadorLimpo = gravador.trim();
    if (fonte === "gravador" && gravadorLimpo.length < 2) return setErro("Diga qual é o gravador.");
    if (!selecao?.arquivos.length) return setErro("Escolha o cartão.");
    const quem = pessoa.tipo === "id" ? { freelancerId: pessoa.id } : { nome: nomeLimpo };
    const destino: Destino = {
      tipo: "cartao",
      fonte,
      pessoa: quem,
      ...(fonte === "gravador" ? { gravador: gravadorLimpo } : {}),
    };
    const chave = motor.adicionar(selecao, destino);
    setEscolhas((e) => ({
      ...e,
      [chave]: { pessoa: quem, rotulo: rotuloPessoa, fonte, gravador: fonte === "gravador" ? gravadorLimpo : null },
    }));
    setSelecao(null);
    setErro(null);
    setOutro(false);
  }

  function novoCartao() {
    motor.limparConcluidos();
    setOcultos((o) => [...o, ...foto.lotes.filter((l) => l.estado === "erro" || l.estado === "cancelado").map((l) => l.chave)]);
    setSelecao(null);
    setErro(null);
    setOutro(true);
  }

  /** Retomável: preenche quem e a câmera daquele rolo e leva até o cartão. */
  function continuarRolo(loteId: string) {
    const e = lerEscolhas(linkId)[loteId];
    if (e) {
      if ("freelancerId" in e.pessoa) {
        const id = e.pessoa.freelancerId;
        const p = diaria.pessoas.find((x) => x.id === id);
        if (p) setPessoa({ tipo: "id", id: p.id, rotulo: p.rotulo });
      } else {
        setPessoa({ tipo: "nome" });
        setNome(e.pessoa.nome);
      }
      setFonte(e.fonte);
      setGravador(e.gravador ?? "");
    }
    novoCartao();
    requestAnimationFrame(() => document.getElementById("cartao")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function tituloDo(l: LoteFila): string {
    const rolo = roloDe(l.rotulo);
    if (rolo) return `Rolo ${rolo}`;
    const e = escolhas[l.chave];
    if (e?.fonte === "gravador") return e.gravador ? `Áudio · ${e.gravador}` : "Áudio";
    return e ? (acharFonte(e.fonte)?.rotulo ?? "Cartão") : "Cartão";
  }

  function concluidoDo(l: LoteFila, ultimo: boolean) {
    const e = escolhas[l.chave];
    const rolo = roloDe(l.rotulo);
    const n = l.recebidos;
    const audio = e?.fonte === "gravador" || !rolo;
    return (
      <div className="grid gap-5">
        <h2 className="flex items-center gap-4 text-h2 text-white">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-void" aria-hidden>
            <Check className="size-5" />
          </span>
          {audio ? "Áudio recebido." : `Rolo ${rolo} recebido.`}
        </h2>
        <p className="max-w-xl text-body-lg text-ash">
          {audio
            ? `${arquivosBR(n)}${e?.gravador ? ` do ${e.gravador}` : ""} ${plural(n, "conferido", "conferidos")} no Drive. Guarde o cartão até a ZRO confirmar.`
            : `${arquivosBR(n)} ${plural(n, "conferido", "conferidos")} no Drive, com o tamanho exato. Guarde o cartão até a ZRO confirmar.`}
        </p>
        {ultimo && !mostrarFormulario ? (
          <div>
            <button type="button" className={estilos.principal} onClick={novoCartao}>
              Enviar outro cartão
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function perguntaDo(l: LoteFila) {
    const rolo = l.pergunta?.rotulo ?? "";
    return (
      <div className="grid gap-5">
        <p className="max-w-xl text-body-lg text-light">
          Este cartão já subiu como rolo {rolo}. Os arquivos novos entram no {rolo}?
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className={estilos.principal} onClick={() => motor.responder(l.chave, "continuar")}>
            Entrar no {rolo}
          </button>
          <button type="button" className={estilos.secundario} onClick={() => motor.responder(l.chave, "novo")}>
            Rolo novo
          </button>
        </div>
      </div>
    );
  }

  const bytesSelecao = selecao ? selecao.arquivos.reduce((s, a) => s + a.file.size, 0) : 0;
  const cabem = diaria.limite ? Math.max(0, diaria.limite.bytes - diaria.limite.usados) : null;
  const passaDoLimite = diaria.limite && cabem != null && bytesSelecao > cabem;

  let destinoTexto: string | null = null;
  if (selecao && f && rotuloPessoa) {
    if (f.chave === "gravador") destinoTexto = gravador.trim() ? `Vai para a pasta do ${gravador.trim()} · ${rotuloPessoa}.` : "Vai para a pasta do gravador.";
    else if (retomando) {
      const rolo = roloDe(retomando.rotulo);
      destinoTexto = rolo ? `Continua o rolo ${rolo} de onde parou.` : "Continua o envio de onde parou.";
    } else destinoTexto = `Vai para ${f.rotulo} · ${rotuloPessoa}, num rolo novo.`;
  }

  return (
    <div className="mt-12 grid gap-10 sm:mt-16">
      {retomaveis.length > 0 && mostrarFormulario ? (
        <div className="grid gap-3">
          {retomaveis.map((s) => {
            const rolo = roloDe(s.rotulo);
            const gravadorSalvo = s.rotulo.split(" · ")[0]?.trim();
            const quem = rolo ? `O rolo ${rolo}` : gravadorSalvo ? `O envio do ${gravadorSalvo}` : "Um envio";
            return (
              <Aviso
                key={s.loteId}
                acao={
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={estilos.secundario} onClick={() => continuarRolo(s.loteId)}>
                      <RotateCcw aria-hidden />
                      Continuar
                    </button>
                    <button type="button" className={estilos.discreto} onClick={() => setDispensados((d) => [...d, s.loteId])}>
                      Dispensar
                    </button>
                  </div>
                }
              >
                {quem} parou em {porcento(s.enviados, s.bytes)}%. Escolha o mesmo cartão para continuar.
              </Aviso>
            );
          })}
        </div>
      ) : null}

      <AvisosDaFila foto={foto} motor={motor} />
      {foto.precisaEntrar ? (
        <Aviso
          acao={
            <button type="button" className={estilos.secundario} onClick={() => motor.continuar()}>
              Continuar
            </button>
          }
        >
          A conexão com a ZRO caiu. Toque em Continuar. Se não voltar, recarregue a página e escolha o mesmo cartão.
        </Aviso>
      ) : null}

      {visiveis.map((l, i) => (
        <div key={l.chave} className="motion-safe:animate-[sheet-in_500ms_cubic-bezier(0.16,1,0.3,1)_backwards]">
          <LotePublico
            motor={motor}
            foto={foto}
            lote={l}
            titulo={tituloDo(l)}
            concluido={concluidoDo(l, i === visiveis.length - 1)}
            pergunta={perguntaDo(l)}
            ios={ios}
            aoEscolherDeNovo={mostrarFormulario ? undefined : novoCartao}
            rotuloEscolherDeNovo="Enviar outro cartão"
          />
        </div>
      ))}

      {mostrarFormulario ? (
        <div className={cn("grid gap-12", visiveis.length ? "border-t border-line pt-10" : "")}>
          {/* 01 · Quem é você */}
          <fieldset className="grid gap-4">
            <legend className="label mb-5 text-mute">01 · Quem é você</legend>
            {semLista ? null : (
              <div role="radiogroup" aria-label="Quem é você" className="grid gap-3 sm:grid-cols-2">
                {diaria.pessoas.map((p) => (
                  <Opcao
                    key={p.id}
                    marcada={pessoa?.tipo === "id" && pessoa.id === p.id}
                    titulo={p.rotulo}
                    dica={p.funcao}
                    onClick={() => {
                      setPessoa({ tipo: "id", id: p.id, rotulo: p.rotulo });
                      setErro(null);
                    }}
                  />
                ))}
                <Opcao
                  marcada={pessoa?.tipo === "nome"}
                  titulo="Não estou na lista"
                  onClick={() => {
                    setPessoa({ tipo: "nome" });
                    setErro(null);
                  }}
                />
              </div>
            )}
            {pessoa?.tipo === "nome" ? (
              <Campo
                rotulo="Seu nome"
                value={nome}
                onChange={(v) => {
                  setNome(v);
                  setErro(null);
                }}
                autoComplete="name"
                maxLength={60}
                placeholder="Nome e sobrenome"
              />
            ) : null}
          </fieldset>

          {/* 02 · Qual câmera */}
          <fieldset className="grid gap-4">
            <legend className="label mb-5 text-mute">02 · Qual câmera</legend>
            <div role="radiogroup" aria-label="Qual câmera" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FONTES.map((x) => (
                <button
                  key={x.chave}
                  type="button"
                  role="radio"
                  aria-checked={fonte === x.chave}
                  onClick={() => {
                    setFonte(x.chave);
                    setErro(null);
                  }}
                  className={cn(
                    "inline-flex h-14 items-center justify-center rounded-full border px-5 text-base transition-[background-color,border-color,color] duration-200",
                    fonte === x.chave ? "border-white bg-white text-void" : "border-line-strong text-light hover:border-white/40 hover:bg-white/[0.04]",
                  )}
                >
                  {x.rotulo}
                </button>
              ))}
            </div>
            {fonte === "gravador" ? (
              <>
                <Campo
                  rotulo="Qual gravador?"
                  value={gravador}
                  onChange={(v) => {
                    setGravador(v);
                    setErro(null);
                  }}
                  placeholder="Zoom F6"
                  maxLength={40}
                  list={idGravadores}
                  autoComplete="off"
                />
                <datalist id={idGravadores}>
                  {diaria.gravadores.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </>
            ) : null}
          </fieldset>

          {/* 03 · O cartão */}
          <fieldset id="cartao" className="grid scroll-mt-8 gap-4">
            <legend className="label mb-5 text-mute">03 · O cartão</legend>
            {selecao ? (
              <div className="rounded-media border border-line-strong bg-white/[0.02] p-6 sm:p-8">
                <p className="text-h3 text-white">
                  {arquivosBR(selecao.arquivos.length)} · {bytesBR(bytesSelecao)}
                </p>
                {selecao.cartaoNome ? <p className="mt-1 text-caption text-mute">Cartão {selecao.cartaoNome}</p> : null}
                {destinoTexto ? <p className="mt-4 text-ui text-ash">{destinoTexto}</p> : null}
                {selecao.ignorados.length ? <p className="mt-3 text-caption text-mute">{textoIgnorados(selecao.ignorados.length)}</p> : null}
                {passaDoLimite && diaria.limite ? (
                  <p className="mt-3 text-ui text-light">{textoLimiteLink(bytesBR(diaria.limite.bytes), bytesBR(cabem))}</p>
                ) : null}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button type="button" className={estilos.principal} onClick={comecar}>
                    Começar envio
                  </button>
                  <button
                    type="button"
                    className={estilos.secundario}
                    onClick={() => {
                      setSelecao(null);
                      setErro(null);
                    }}
                  >
                    Trocar o cartão
                  </button>
                </div>
              </div>
            ) : (
              <Seletor
                principal="pasta"
                rotuloPasta="Escolher o cartão"
                rotuloArquivos="Escolher arquivos"
                textoSoltar="Ou arraste o cartão para cá."
                notaCelular={
                  ios
                    ? "No celular, mande arquivos soltos. O cartão inteiro vai pelo computador. Escolha pelo app Arquivos para mandar o vídeo original."
                    : "No celular, mande arquivos soltos. O cartão inteiro vai pelo computador."
                }
                tirarRaiz
                onEscolher={escolher}
              />
            )}
            <p className="min-h-6 text-sm text-danger" role="alert" aria-live="polite">
              {erro ?? ""}
            </p>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

/* ============================== Peças ============================== */

function Opcao({ marcada, titulo, dica, onClick }: { marcada: boolean; titulo: string; dica?: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center justify-between gap-4 rounded-media border px-5 py-3 text-left transition-[background-color,border-color,box-shadow] duration-300",
        marcada
          ? "border-white bg-white text-void shadow-[0_0_48px_rgb(255_255_255/0.18)]"
          : "border-line-strong bg-white/[0.02] text-light hover:border-white/40 hover:bg-white/[0.05]",
      )}
    >
      <span className="min-w-0">
        <span className="block text-base font-medium">{titulo}</span>
        {dica ? <span className={cn("mt-0.5 block text-caption", marcada ? "text-void/60" : "text-mute")}>{dica}</span> : null}
      </span>
      <span
        className={cn("grid size-6 shrink-0 place-items-center rounded-full border", marcada ? "border-void bg-void text-white" : "border-white/25")}
        aria-hidden
      >
        {marcada ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  );
}

function Campo({
  rotulo,
  value,
  onChange,
  ...props
}: { rotulo: string; value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-caption text-ash">
        {rotulo}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full rounded-field border border-line-strong bg-white/[0.03] px-4 text-base text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
        {...props}
      />
    </div>
  );
}
