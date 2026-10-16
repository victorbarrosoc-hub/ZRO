"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Link2 } from "lucide-react";
import { Player, type FalhaPlayer } from "@/components/previa/player";
import { Carregando, ehCelular, FotoZoom, Previa, SemPrevia, type ArquivoPrevia } from "@/components/previa/previa";
import { Button, buttonClasses } from "@/components/ui/button";
import { bytesBR } from "@/lib/drive/bytes";
import {
  DOWNLOAD_GRANDE,
  extensao,
  FOTO_DIRETA,
  FOTO_DIRETA_MAX,
  linkNoDrive,
  pesadoDemais,
  podeTocar,
  precisaDeProxy,
  tamanhoMiniatura,
  tipoDeMidia,
} from "@/lib/drive/midia";
import { baixarPeloStream, buscarPeloStream, porQueFalhou, prepararStream, QUADRO, urlDeStream } from "@/lib/drive/navegador/stream";

/**
 * Prévia no painel (docs/dev/drive.md §16): vídeo e áudio pelo service worker de /painel/stream/ (direto do
 * Google, com Range: nada passa pela Vercel), foto grande com zoom, proxy de câmera para os brutos e o aviso
 * de vídeo pesado demais para a rede (com "Ver no Google Drive"). Baixar: no computador, o link do Google; no
 * celular, pelo stream (aviso acima de 1 GB).
 */

export function miniaturaDoPainel(id: string, px: number): string {
  return `/painel/arquivos/miniatura/${encodeURIComponent(id)}?s=${tamanhoMiniatura(px)}`;
}

type Proxy = Pick<ArquivoPrevia, "id" | "nome" | "tipo" | "tamanho" | "midia">;
type Motivo = "formato" | "sessao" | "reconectar" | "sumiu" | "rede" | "sem_sw";

const TEXTO: Record<Motivo, { titulo: string; texto?: string }> = {
  formato: { titulo: "Este formato não toca no navegador.", texto: "Baixe para ver no seu programa, ou abra no Google Drive." },
  sessao: { titulo: "Sua sessão expirou.", texto: "Entre de novo para ver a prévia." },
  reconectar: { titulo: "A conexão com o Google expirou.", texto: "Reconecte em Ajustes → Google Drive." },
  sumiu: { titulo: "Este arquivo não abre mais no Drive.", texto: "Ele pode ter sido movido ou apagado." },
  rede: { titulo: "Não deu para carregar a prévia.", texto: "Confira a internet e tente de novo." },
  sem_sw: { titulo: "A prévia não abriu neste navegador.", texto: "Abra no Google Drive ou baixe o arquivo." },
};

const linkDrive = (id: string, rotulo = "Ver no Google Drive") => (
  <a href={linkNoDrive(id)} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "primary", size: "md" })}>
    <ExternalLink aria-hidden /> {rotulo}
  </a>
);

function PalcoMidia({ a, poster }: { a: ArquivoPrevia; poster: string | null }) {
  const tipo = tipoDeMidia(a) as "video" | "audio";
  const [sw, setSw] = useState<boolean | undefined>(undefined);
  const [falha, setFalha] = useState<Motivo | null>(null);
  const [proxy, setProxy] = useState<Proxy | null | undefined>(undefined); // undefined = ainda não procurou
  const [falhaProxy, setFalhaProxy] = useState(false);
  const [lento, setLento] = useState(false);
  const [forcar, setForcar] = useState(false);
  const [celular] = useState(ehCelular);

  const pesado = tipo === "video" && pesadoDemais({ tamanho: a.tamanho, duracaoMs: a.midia.duracaoMs }, celular);
  const querProxy = tipo === "video" && (precisaDeProxy(a, falha === "formato") || pesado);

  useEffect(() => {
    let vivo = true;
    prepararStream().then((ok) => vivo && setSw(ok));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!querProxy || proxy !== undefined) return;
    let vivo = true;
    fetch(`/painel/arquivos/proxy/${encodeURIComponent(a.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok: boolean; proxy: Proxy | null }) => vivo && setProxy(j.ok ? j.proxy : null))
      .catch(() => vivo && setProxy(null));
    return () => {
      vivo = false;
    };
  }, [querProxy, proxy, a.id]);

  const aoFalhar = async (f: FalhaPlayer) => {
    if (f.semServiceWorker) return setFalha("sem_sw");
    // 3 = decodificar, 4 = formato: pergunta ao SW se o arquivo responde (então é o formato).
    setFalha(f.codigo === 3 || f.codigo === 4 ? await porQueFalhou(a) : "rede");
  };

  if (sw === undefined || (querProxy && proxy === undefined)) return <Carregando />;

  if (proxy && !falhaProxy) {
    const vm = proxy.midia.largura && proxy.midia.altura ? `${proxy.midia.largura} / ${proxy.midia.altura}` : a.midia.largura && a.midia.altura ? `${a.midia.largura} / ${a.midia.altura}` : null;
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3">
        <div className="grid min-h-0 w-full flex-1 place-items-center" style={{ containerType: "size" }}>
          <Player
            key={proxy.id}
            tipo="video"
            src={urlDeStream(proxy)}
            quadro={QUADRO}
            poster={poster}
            titulo={`${a.nome} (proxy)`}
            proporcao={vm}
            selo="Proxy"
            vigiar={false}
            onFalha={() => setFalhaProxy(true)}
            className="sm:rounded-[20px]"
          />
        </div>
        <p className="px-4 text-center text-[13px] text-ash">Prévia em baixa resolução. O Baixar traz o original.</p>
      </div>
    );
  }

  if (!sw) return <SemPrevia poster={poster} nome={a.nome} tipo={tipo} {...TEXTO.sem_sw}>{linkDrive(a.id)}</SemPrevia>;

  if ((pesado && !forcar) || lento) {
    return (
      <SemPrevia poster={poster} nome={a.nome} tipo={tipo} titulo="Vídeo pesado demais para tocar pela rede." texto="O Google Drive toca uma cópia leve.">
        {linkDrive(a.id)}
        <Button
          variant="secondary"
          onClick={() => {
            setLento(false);
            setForcar(true);
          }}
        >
          Tentar mesmo assim
        </Button>
      </SemPrevia>
    );
  }

  if (falha || podeTocar(a) === "nao") {
    const m = falha ?? "formato";
    return (
      <SemPrevia poster={poster} nome={a.nome} tipo={tipo} {...TEXTO[m]}>
        {m === "formato" || m === "sem_sw" ? linkDrive(a.id, "Abrir no Google Drive") : null}
      </SemPrevia>
    );
  }

  const proporcao = a.midia.largura && a.midia.altura ? `${a.midia.largura} / ${a.midia.altura}` : null;
  return (
    <div className="flex size-full items-center justify-center">
      <Player
        key={forcar ? `${a.id}:forcado` : a.id}
        tipo={tipo}
        src={urlDeStream(a)}
        quadro={QUADRO}
        poster={poster}
        titulo={a.nome}
        proporcao={proporcao}
        vigiar={!forcar}
        onFalha={aoFalhar}
        onLento={() => setLento(true)}
        className={tipo === "video" ? "sm:rounded-[20px]" : "max-w-xl"}
      />
    </div>
  );
}

function PalcoFoto({ a, setZoom }: { a: ArquivoPrevia; setZoom: (z: boolean) => void }) {
  const { id, nome, tipo, tamanho } = a;
  const alta = a.midia.miniatura ? miniaturaDoPainel(a.id, 2000) : null;
  const baixa = a.midia.miniatura ? miniaturaDoPainel(a.id, 640) : null;
  const direta = FOTO_DIRETA.has(extensao(a.nome)) && (a.tamanho ?? 0) <= FOTO_DIRETA_MAX;
  const [original, setOriginal] = useState<string | null>(null);
  const [erroAlta, setErroAlta] = useState(false);
  const [semOriginal, setSemOriginal] = useState(!direta);

  // O arquivo em si (JPG/PNG/WebP), pelo service worker, depois da miniatura alta.
  useEffect(() => {
    if (!direta) return;
    let vivo = true;
    let url: string | null = null;
    buscarPeloStream(urlDeStream({ id, nome, tipo, tamanho }), { cache: "no-store" })
      .then(async (r) => {
        if (!r?.ok) throw new Error("sem");
        const b = await r.blob();
        if (!vivo) return;
        url = URL.createObjectURL(b);
        setOriginal(url);
      })
      .catch(() => vivo && setSemOriginal(true));
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, nome, tipo, tamanho, direta]);

  const src = original ?? (alta && !erroAlta ? alta : null);
  if (!src) {
    if (!semOriginal) return <Carregando />;
    return <SemPrevia nome={a.nome} tipo="imagem" titulo="Sem prévia desta foto aqui." texto="Baixe para ver no tamanho original." />;
  }
  return <FotoZoom key={src} src={src} baixa={original ? alta : baixa} alt={a.nome} onZoom={setZoom} onErro={() => (original ? setOriginal(null) : setErroAlta(true))} />;
}

function PalcoPainel({ a, setZoom }: { a: ArquivoPrevia; setZoom: (z: boolean) => void }) {
  const tipo = tipoDeMidia(a);
  const poster = a.midia.miniatura ? miniaturaDoPainel(a.id, 1280) : null;
  if (tipo === "video" || tipo === "audio") return <PalcoMidia a={a} poster={poster} />;
  if (tipo === "imagem") return <PalcoFoto a={a} setZoom={setZoom} />;
  if ((tipo === "pdf" || tipo === "doc") && a.midia.miniatura) {
    return <FotoZoom src={miniaturaDoPainel(a.id, 2000)} baixa={miniaturaDoPainel(a.id, 640)} alt={a.nome} onZoom={setZoom} />;
  }
  return (
    <SemPrevia nome={a.nome} tipo={tipo} titulo="Sem prévia para este tipo de arquivo." texto="Baixe ou abra no Google Drive.">
      {linkDrive(a.id, "Abrir no Google Drive")}
    </SemPrevia>
  );
}

export function PreviaPainel({
  arquivos,
  indice,
  onIndice,
  onFechar,
}: {
  arquivos: ArquivoPrevia[];
  indice: number;
  onIndice: (i: number) => void;
  onFechar: () => void;
}) {
  const [confirmar, setConfirmar] = useState<ArquivoPrevia | null>(null);

  const baixarNoCelular = async (a: ArquivoPrevia) => {
    setConfirmar(null);
    if (await prepararStream()) {
      baixarPeloStream(a);
      toast.success("Baixando. No iPhone, fica em Arquivos → Downloads.");
    } else if (a.baixarUrl) window.open(a.baixarUrl, "_blank", "noopener");
  };

  const copiar = async (a: ArquivoPrevia) => {
    try {
      await navigator.clipboard.writeText(a.verUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não deu para copiar. Abra no Drive e copie por lá.");
    }
  };

  const acoes = (a: ArquivoPrevia) => (
    <>
      {a.baixarUrl ? (
        <>
          <a
            href={a.baixarUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "primary", size: "md", className: "hidden flex-1 md:inline-flex md:flex-none" })}
          >
            <Download aria-hidden /> Baixar
          </a>
          <Button
            variant="primary"
            className="h-11 flex-1 md:hidden"
            onClick={() => ((a.tamanho ?? 0) > DOWNLOAD_GRANDE ? setConfirmar(a) : baixarNoCelular(a))}
          >
            <Download aria-hidden /> Baixar
          </Button>
        </>
      ) : null}
      <a href={a.verUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", size: "md", className: "h-11 md:h-10" })}>
        <ExternalLink aria-hidden /> <span className="max-sm:sr-only">Abrir no Drive</span>
      </a>
      <Button variant="ghost" className="h-11 md:h-10" onClick={() => copiar(a)}>
        <Link2 aria-hidden /> <span className="max-sm:sr-only">Copiar link</span>
      </Button>
    </>
  );

  return (
    <Previa
      arquivos={arquivos}
      indice={indice}
      onIndice={onIndice}
      onFechar={onFechar}
      acoes={acoes}
      palco={(a, { setZoom }) => <PalcoPainel a={a} setZoom={setZoom} />}
      sobreposicao={
        confirmar ? (
          <div className="absolute inset-0 z-50 grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center" role="alertdialog" aria-labelledby="baixar-grande">
            <div className="w-full max-w-sm rounded-[24px] border border-line-strong bg-ink p-5">
              <p id="baixar-grande" className="text-[17px] font-medium text-white">
                Arquivo grande: {bytesBR(confirmar.tamanho)}
              </p>
              <p className="mt-2 text-[14px] text-ash">No celular, a tela precisa ficar aberta até terminar. No computador é mais rápido.</p>
              <div className="mt-5 grid gap-2">
                <Button variant="primary" className="h-11" onClick={() => baixarNoCelular(confirmar)}>
                  <Download aria-hidden /> Baixar mesmo assim
                </Button>
                <Button variant="ghost" className="h-11" onClick={() => setConfirmar(null)}>
                  Agora não
                </Button>
              </div>
            </div>
          </div>
        ) : null
      }
    />
  );
}
