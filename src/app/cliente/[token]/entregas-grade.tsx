"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Play } from "lucide-react";
import { Symbol } from "@/components/brand/logo";
import { LightPoint } from "@/components/brand/light-point";
import { Miniatura } from "@/components/previa/miniatura";
import { Player } from "@/components/previa/player";
import {
  Carregando,
  ehCelular,
  FotoZoom,
  Previa,
  SemPrevia,
  type ArquivoPrevia,
} from "@/components/previa/previa";
import { bytesBR } from "@/lib/drive/bytes";
import {
  duracaoBR,
  extensao,
  FOTO_DIRETA,
  linkNoDrive,
  linkPreviaDoDrive,
  pesadoDemais,
  tamanhoMiniatura,
  tipoDeMidia,
} from "@/lib/drive/midia";
import { cn } from "@/lib/utils";

/**
 * Entregas do cliente em miniaturas (docs/dev/drive.md §16): o cliente assiste antes de baixar, no link da ZRO.
 * Vídeo: direto do Google pela chave de API (o arquivo tem "qualquer pessoa com o link" depois de "Liberar
 * entregas"), no player da ZRO. Sem chave, com resourceKey, pesado demais para a rede ou travando: o player do
 * próprio Google Drive (a cópia leve dele) embutido. Nenhum token da conta da ZRO chega aqui.
 */

export type EntregaGrade = ArquivoPrevia & {
  /** "Master / 4K" (subpasta dentro da seção), quando tem. */
  sub: string | null;
  /** Endereço direto do Google com a chave de API (null = usa a prévia do Google Drive). */
  assistir: string | null;
};

const acao =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] transition-colors [&_svg]:size-4";

function tamanho(proporcao: string): React.CSSProperties {
  const [w, h] = proporcao.split("/").map((n) => Number(n.trim()));
  const r = w > 0 && h > 0 ? w / h : 16 / 9;
  return {
    aspectRatio: `${r}`,
    maxWidth: `calc(100cqh * ${r.toFixed(4)})`,
    maxHeight: "100cqh",
  };
}

function miniatura(token: string, id: string, px: number) {
  return `/cliente/${encodeURIComponent(token)}/miniatura/${encodeURIComponent(id)}?s=${tamanhoMiniatura(px)}`;
}

/** O player do próprio Google Drive. Não carregou em 15 s: o aviso com o botão. */
function PlayerDoDrive({
  a,
  poster,
  motivo,
  pesado,
}: {
  a: ArquivoPrevia;
  poster: string | null;
  motivo?: string;
  pesado: boolean;
}) {
  const [estado, setEstado] = useState<"carregando" | "ok" | "falhou">(
    "carregando",
  );
  useEffect(() => {
    const t = window.setTimeout(
      () => setEstado((e) => (e === "carregando" ? "falhou" : e)),
      15_000,
    );
    return () => window.clearTimeout(t);
  }, []);
  if (estado === "falhou") {
    return (
      <SemPrevia
        poster={poster}
        nome={a.nome}
        tipo={tipoDeMidia(a)}
        titulo={
          pesado
            ? "Vídeo pesado demais para tocar pela rede."
            : "A prévia não abriu aqui."
        }
        texto="Abra no Google Drive para assistir."
      >
        <a
          href={linkNoDrive(a.id)}
          target="_blank"
          rel="noreferrer"
          className={`${acao} bg-white font-medium text-void hover:bg-light`}
        >
          <ExternalLink aria-hidden /> Ver no Google Drive
        </a>
      </SemPrevia>
    );
  }
  const proporcao =
    a.midia.largura && a.midia.altura
      ? `${a.midia.largura} / ${a.midia.altura}`
      : "16 / 9";
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3">
      <div
        className="grid min-h-0 w-full flex-1 place-items-center"
        style={{ containerType: "size" }}
      >
        <div
          className="relative w-full overflow-hidden bg-black sm:rounded-[20px]"
          style={tamanho(proporcao)}
        >
          {estado === "carregando" ? (
            <span className="absolute inset-0">
              <Carregando />
            </span>
          ) : null}
          <iframe
            src={linkPreviaDoDrive(a.id)}
            title={a.nome}
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={() => setEstado("ok")}
            className="absolute inset-0 size-full border-0"
            data-drive-previa
          />
        </div>
      </div>
      <p className="px-4 text-center text-[12px] text-mute">
        {motivo ?? "Prévia pelo Google Drive."}
      </p>
    </div>
  );
}

function PalcoCliente({
  a,
  token,
  setZoom,
}: {
  a: EntregaGrade;
  token: string;
  setZoom: (z: boolean) => void;
}) {
  const tipo = tipoDeMidia(a);
  const poster = a.midia.miniatura ? miniatura(token, a.id, 1280) : null;
  const [celular] = useState(ehCelular);
  const [doDrive, setDoDrive] = useState<string | null>(null);

  if (tipo === "video" || tipo === "audio") {
    const pesado =
      tipo === "video" &&
      pesadoDemais(
        { tamanho: a.tamanho, duracaoMs: a.midia.duracaoMs },
        celular,
      );
    if (doDrive || pesado || !a.assistir) {
      const leve = pesado || doDrive === "lento";
      return (
        <PlayerDoDrive
          key={a.id}
          a={a}
          poster={poster}
          pesado={leve}
          motivo={
            leve
              ? "Arquivo pesado: tocando pela cópia leve do Google Drive."
              : undefined
          }
        />
      );
    }
    const proporcao =
      a.midia.largura && a.midia.altura
        ? `${a.midia.largura} / ${a.midia.altura}`
        : null;
    return (
      <div className="flex size-full items-center justify-center">
        <Player
          key={a.id}
          tipo={tipo}
          src={a.assistir}
          poster={poster}
          titulo={a.nome}
          proporcao={proporcao}
          onLento={() => setDoDrive("lento")}
          onFalha={() => setDoDrive("falha")}
          className={tipo === "video" ? "sm:rounded-[20px]" : "max-w-xl"}
        />
      </div>
    );
  }
  if (
    tipo === "imagem" ||
    ((tipo === "pdf" || tipo === "doc") && a.midia.miniatura)
  ) {
    const alta = a.midia.miniatura ? miniatura(token, a.id, 2000) : null;
    const original =
      tipo === "imagem" && a.assistir && FOTO_DIRETA.has(extensao(a.nome))
        ? a.assistir
        : null;
    const src = original ?? alta;
    if (src)
      return (
        <FotoZoom
          key={src}
          src={src}
          baixa={a.midia.miniatura ? miniatura(token, a.id, 640) : null}
          alt={a.nome}
          onZoom={setZoom}
        />
      );
  }
  return (
    <SemPrevia
      nome={a.nome}
      tipo={tipo}
      titulo="Sem prévia para este arquivo."
      texto="Baixe para abrir no seu computador."
    />
  );
}

export function GradeEntregas({
  token,
  grupos,
}: {
  token: string;
  grupos: { nome: string; itens: EntregaGrade[] }[];
}) {
  const todos = grupos.flatMap((g) => g.itens);
  const [aberto, setAberto] = useState<number | null>(null);

  return (
    <div className="mt-8 grid gap-10">
      {grupos.map((g) => (
        <div key={g.nome}>
          <p className="label mb-4 text-mute">{g.nome}</p>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-6 min-[420px]:grid-cols-2">
            {g.itens.map((e) => {
              const i = todos.indexOf(e);
              const tipo = tipoDeMidia(e);
              const midia = tipo === "video" || tipo === "audio";
              return (
                <li key={e.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setAberto(i)}
                    className="group relative block w-full overflow-hidden rounded-thumb border border-line text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    aria-label={`${midia ? "Assistir" : "Ver"} ${e.nome}`}
                  >
                    <Miniatura
                      src={
                        e.midia.miniatura ? miniatura(token, e.id, 640) : null
                      }
                      nome={e.nome}
                      tipo={tipo}
                      duracao={duracaoBR(e.midia.duracaoMs)}
                      className="aspect-video w-full transition-transform duration-700 ease-out-expo group-hover:scale-[1.02]"
                    />
                    {midia ? (
                      <span
                        className="pointer-events-none absolute inset-0 grid place-items-center opacity-90 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      >
                        <span className="grid size-12 place-items-center rounded-full bg-white/95 text-void shadow-[0_8px_30px_-6px_rgb(0_0_0/0.8)] transition-transform duration-500 ease-out-expo group-hover:scale-110">
                          <Play className="ml-0.5 size-5 fill-current" />
                        </span>
                      </span>
                    ) : null}
                  </button>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ui break-words text-light">{e.nome}</p>
                      <p className="mt-0.5 text-caption text-mute">
                        {[e.sub, e.tamanho != null ? bytesBR(e.tamanho) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {e.baixarUrl ? (
                      <a
                        href={e.baixarUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-light transition-colors hover:border-white/40 hover:bg-white/[0.04]"
                        aria-label={`Baixar ${e.nome}`}
                        title="Baixar"
                      >
                        <Download className="size-4" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {aberto != null && todos[aberto] ? (
        <Previa
          arquivos={todos}
          indice={aberto}
          onIndice={setAberto}
          onFechar={() => setAberto(null)}
          marca={
            <span className="relative grid size-8 place-items-center">
              <Symbol className="absolute inset-0 size-8 text-white/90" />
              <LightPoint size={2} />
            </span>
          }
          palco={(a, { setZoom }) => (
            <PalcoCliente
              a={a as EntregaGrade}
              token={token}
              setZoom={setZoom}
            />
          )}
          acoes={(a) => (
            <>
              {a.baixarUrl ? (
                <a
                  href={a.baixarUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    acao,
                    "flex-1 bg-white font-medium text-void hover:bg-light sm:flex-none",
                  )}
                >
                  <Download aria-hidden /> Baixar
                </a>
              ) : null}
              <a
                href={a.verUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  acao,
                  "border border-line-strong text-light hover:border-white/40 hover:bg-white/[0.04]",
                )}
              >
                <ExternalLink aria-hidden />{" "}
                <span className="max-sm:sr-only">Abrir no Google Drive</span>
              </a>
            </>
          )}
        />
      ) : null}
    </div>
  );
}
