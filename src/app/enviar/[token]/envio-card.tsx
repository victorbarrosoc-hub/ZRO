"use client";

import { Check, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
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
import type { LoteFila } from "@/lib/drive/navegador/motor";
import { impressao as calcularImpressao, type Selecao } from "@/lib/drive/navegador/selecao";
import { transporteDaRota } from "@/lib/drive/navegador/transporte";
import { useMotor } from "@/lib/drive/navegador/use-motor";
import type { Destino } from "@/lib/drive/protocolo";
import type { DadosCard } from "@/lib/services/drive-publico";
import { cn } from "@/lib/utils";

/**
 * O link de um card da Pauta (docs/dev/drive.md §15): o freela sobe a peça final direto na pasta do
 * link (06 Entregas/<seção> ou 05 Render), com o nome original. Sem rolo e sem pergunta de cartão.
 * A mesma engrenagem do envio da diária: do navegador direto para o Google, retomável, com progresso.
 */

type Quem = { tipo: "responsavel" } | { tipo: "nome" };

export function EnvioCard({ token, linkId, card }: { token: string; linkId: string; card: DadosCard }) {
  const [transporte] = useState(() => transporteDaRota(`/enviar/${encodeURIComponent(token)}/api`));
  const { motor, foto } = useMotor({ transporte, escopo: `enviar:${linkId}`, voz: "publico" });
  useSemSolturaFora();
  const ios = useEhIOS();

  const [quem, setQuem] = useState<Quem>(card.responsavel ? { tipo: "responsavel" } : { tipo: "nome" });
  const [nome, setNome] = useState("");
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [marca, setMarca] = useState<{ s: Selecao; h: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [outro, setOutro] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [dispensados, setDispensados] = useState<string[]>([]);

  const visiveis = foto.lotes.filter((l) => !ocultos.includes(l.chave));
  const emAndamento = foto.lotes.some((l) => !LOTES_FINAIS.has(l.estado));
  const mostrarFormulario = !emAndamento && (outro || visiveis.length === 0);
  const retomaveis = foto.retomaveis.filter((s) => !dispensados.includes(s.loteId));
  const impressaoAtual = marca && marca.s === selecao ? marca.h : null;
  const retomando = impressaoAtual ? foto.retomaveis.find((s) => s.impressao === impressaoAtual) : undefined;

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
    const nomeLimpo = nome.trim();
    if (quem.tipo === "nome" && nomeLimpo.length < 2) return setErro("Digite o seu nome.");
    if (!selecao?.arquivos.length) return setErro("Escolha os arquivos.");
    const pessoa = quem.tipo === "responsavel" && card.responsavel ? { freelancerId: card.responsavel.id } : { nome: nomeLimpo };
    const destino: Destino = { tipo: "card", pessoa };
    motor.adicionar(selecao, destino);
    setSelecao(null);
    setErro(null);
    setOutro(false);
  }

  function enviarMais() {
    motor.limparConcluidos();
    setOcultos((o) => [...o, ...foto.lotes.filter((l) => l.estado === "erro" || l.estado === "cancelado").map((l) => l.chave)]);
    setSelecao(null);
    setErro(null);
    setOutro(true);
  }

  function concluidoDo(l: LoteFila, ultimo: boolean) {
    const n = l.recebidos;
    return (
      <div className="grid gap-5">
        <h2 className="flex items-center gap-4 text-h2 text-white">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-void" aria-hidden>
            <Check className="size-5" />
          </span>
          Peça recebida.
        </h2>
        <p className="max-w-xl text-body-lg text-ash">
          {arquivosBR(n)} em {card.destino}, {n === 1 ? "conferido" : "conferidos"} no Drive com o tamanho exato. A ZRO já vê no card.
        </p>
        {ultimo && !mostrarFormulario ? (
          <div>
            <button type="button" className={estilos.principal} onClick={enviarMais}>
              Enviar mais arquivos
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const bytesSelecao = selecao ? selecao.arquivos.reduce((s, a) => s + a.file.size, 0) : 0;
  const destinoTexto = retomando ? "Continua o envio de onde parou." : `${selecao && selecao.arquivos.length === 1 ? "Vai" : "Vão"} para ${card.destino}, com o nome original.`;

  return (
    <div className="mt-12 grid gap-10 sm:mt-16">
      <div className="grid gap-2 rounded-media border border-line-strong bg-white/[0.02] p-6 sm:p-8">
        <p className="label text-mute">O card</p>
        <p className="text-h3 break-words text-white">{card.titulo}</p>
        <p className="text-ui text-ash">Vai para {card.destino}.</p>
      </div>

      {retomaveis.length > 0 && mostrarFormulario ? (
        <div className="grid gap-3">
          {retomaveis.map((s) => (
            <Aviso
              key={s.loteId}
              acao={
                <button type="button" className={estilos.discreto} onClick={() => setDispensados((d) => [...d, s.loteId])}>
                  Dispensar
                </button>
              }
            >
              Um envio parou em {porcento(s.enviados, s.bytes)}%. Escolha os mesmos arquivos para continuar.
            </Aviso>
          ))}
        </div>
      ) : null}

      <AvisosDaFila foto={foto} motor={motor} />
      {foto.precisaEntrar ? (
        <Aviso
          acao={
            <button type="button" className={estilos.secundario} onClick={() => motor.continuar()}>
              <RotateCcw aria-hidden />
              Continuar
            </button>
          }
        >
          A conexão com a ZRO caiu. Toque em Continuar. Se não voltar, recarregue a página e escolha os mesmos arquivos.
        </Aviso>
      ) : null}

      {visiveis.map((l, i) => (
        <div key={l.chave} className="motion-safe:animate-[sheet-in_500ms_cubic-bezier(0.16,1,0.3,1)_backwards]">
          <LotePublico
            motor={motor}
            foto={foto}
            lote={l}
            titulo="Peça final"
            concluido={concluidoDo(l, i === visiveis.length - 1)}
            ios={ios}
            aoEscolherDeNovo={mostrarFormulario ? undefined : enviarMais}
            rotuloEscolherDeNovo="Enviar mais arquivos"
          />
        </div>
      ))}

      {mostrarFormulario ? (
        <div className={cn("grid gap-12", visiveis.length ? "border-t border-line pt-10" : "")}>
          {/* 01 · Quem envia */}
          <fieldset className="grid gap-4">
            <legend className="label mb-5 text-mute">01 · Quem envia</legend>
            {card.responsavel ? (
              <div role="radiogroup" aria-label="Quem envia" className="grid gap-3 sm:grid-cols-2">
                <Opcao
                  marcada={quem.tipo === "responsavel"}
                  titulo={card.responsavel.rotulo}
                  dica="Responsável pelo card"
                  onClick={() => {
                    setQuem({ tipo: "responsavel" });
                    setErro(null);
                  }}
                />
                <Opcao
                  marcada={quem.tipo === "nome"}
                  titulo="Outra pessoa"
                  onClick={() => {
                    setQuem({ tipo: "nome" });
                    setErro(null);
                  }}
                />
              </div>
            ) : null}
            {quem.tipo === "nome" ? (
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

          {/* 02 · Os arquivos */}
          <fieldset className="grid gap-4">
            <legend className="label mb-5 text-mute">02 · Os arquivos</legend>
            {selecao ? (
              <div className="rounded-media border border-line-strong bg-white/[0.02] p-6 sm:p-8">
                <p className="text-h3 text-white">
                  {arquivosBR(selecao.arquivos.length)} · {bytesBR(bytesSelecao)}
                </p>
                <p className="mt-4 text-ui text-ash">{destinoTexto}</p>
                {selecao.ignorados.length ? <p className="mt-3 text-caption text-mute">{textoIgnorados(selecao.ignorados.length)}</p> : null}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button type="button" className={estilos.principal} onClick={comecar}>
                    Começar envio
                  </button>
                  <button
                    type="button"
                    className={estilos.secundarioGrande}
                    onClick={() => {
                      setSelecao(null);
                      setErro(null);
                    }}
                  >
                    Trocar os arquivos
                  </button>
                </div>
              </div>
            ) : (
              <Seletor
                principal="arquivos"
                rotuloArquivos="Escolher arquivos"
                rotuloPasta="Escolher pasta"
                textoSoltar="Ou arraste os arquivos para cá."
                notaCelular={ios ? "Escolha pelo app Arquivos para mandar o vídeo original, sem compressão." : undefined}
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
