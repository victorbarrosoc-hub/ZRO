"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ChevronRight, Download, Ellipsis, ExternalLink, Folder, FolderUp, HardDrive, LayoutGrid, List, Upload } from "lucide-react";
import { IconeDoTipo, Miniatura } from "@/components/previa/miniatura";
import type { ArquivoPrevia } from "@/components/previa/previa";
import { Button, buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlay";
import { Card, EmptyState } from "@/components/ui/surface";
import { bytesBR } from "@/lib/drive/bytes";
import { duracaoBR, tipoDeMidia, type InfoMidia } from "@/lib/drive/midia";
import { deInput, deSoltura, podeEscolherPasta, type Selecao } from "@/lib/drive/navegador/selecao";
import { cn } from "@/lib/utils";
import { NovaPasta } from "./arquivos-dialogs";
import { useEhIOS, useFila } from "./fila";
import { miniaturaDoPainel, PreviaPainel } from "./previa-painel";
import { COOKIE_VISTA, type Vista } from "./vista";

/**
 * Navegador do Drive da ZRO (docs/dev/drive.md §7.1): trilha, barra de ações, pastas primeiro e
 * arquivos com Baixar (link do próprio Google) e Abrir. Arrastar arquivos ou pastas sobre a lista
 * manda para a pasta aberta. A lista vem do servidor; a fila mora no FilaProvider.
 */

export type ItemLista = {
  id: string;
  nome: string;
  pasta: boolean;
  tamanho: number | null;
  modificadoEm: string | null;
  verUrl: string;
  baixarUrl: string | null;
  tipo: string;
  midia: InfoMidia;
};


export type PastaAberta = { id: string; nome: string; url: string; podeEnviar: boolean };

const semAssinatura = () => () => {};
const dataBR = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" });

function lembrarVista(v: Vista) {
  document.cookie = `${COOKIE_VISTA}=${v}; path=/painel; max-age=31536000; samesite=lax`;
}

function hrefPasta(id: string) {
  return `/painel/arquivos?pasta=${encodeURIComponent(id)}`;
}

export function Trilha({ trilha, drives }: { trilha: { id: string; nome: string }[]; drives: boolean }) {
  return (
    <nav aria-label="Caminho da pasta" className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
      {drives ? (
        <>
          <Link href="/painel/arquivos?pasta=root" className="rounded-full px-2 py-1 text-mute hover:bg-white/[0.06] hover:text-light">
            Meu Drive
          </Link>
          <ChevronRight className="size-3.5 text-mute" aria-hidden />
          <span className="px-2 py-1 text-light" aria-current="page">
            Drives compartilhados
          </span>
        </>
      ) : (
        <>
          {trilha.map((t, i) => {
            const ultimo = i === trilha.length - 1;
            return (
              <span key={t.id} className="flex min-w-0 items-center gap-x-1">
                {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-mute" aria-hidden /> : null}
                {ultimo ? (
                  <span className="truncate px-2 py-1 text-light" aria-current="page">
                    {t.nome}
                  </span>
                ) : (
                  <Link href={hrefPasta(t.id)} className="truncate rounded-full px-2 py-1 text-mute hover:bg-white/[0.06] hover:text-light">
                    {t.nome}
                  </Link>
                )}
              </span>
            );
          })}
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <Link href="/painel/arquivos?drives=1" className="rounded-full px-2 py-1 text-mute hover:bg-white/[0.06] hover:text-light">
            Drives compartilhados
          </Link>
        </>
      )}
    </nav>
  );
}

export function Navegador({
  pasta,
  trilha,
  itens,
  proxima,
  pagina,
  drives,
  projetos,
  vistaInicial,
}: {
  pasta: PastaAberta | null; // null = lista dos drives compartilhados
  trilha: { id: string; nome: string }[];
  itens: ItemLista[];
  proxima: string | null;
  pagina: string | null;
  drives: boolean;
  projetos: { projectId: string; rotulo: string; pastaId: string }[];
  vistaInicial: Vista;
}) {
  const router = useRouter();
  const { enviar } = useFila();
  const ios = useEhIOS();
  const comPasta = useSyncExternalStore(semAssinatura, podeEscolherPasta, () => false);
  const arquivosRef = useRef<HTMLInputElement>(null);
  const pastaRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(0);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [aberto, setAberto] = useState<number | null>(null);

  function trocarVista(v: Vista) {
    setVista(v);
    lembrarVista(v);
  }

  const podeEnviar = Boolean(pasta?.podeEnviar);
  const pastaAtual = pasta ? { id: pasta.id, nome: pasta.nome } : null;

  function mandar(selecao: Selecao) {
    if (!pastaAtual) return;
    if (!selecao.arquivos.length && !selecao.ignorados.length) return;
    enviar(selecao, pastaAtual);
  }

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.currentTarget.files;
    if (files?.length) mandar(deInput(files));
    e.currentTarget.value = "";
  }

  const temArquivos = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const pastas = itens.filter((i) => i.pasta);
  const arquivos = itens.filter((i) => !i.pasta);
  const previas: ArquivoPrevia[] = arquivos.map((a) => ({
    id: a.id,
    nome: a.nome,
    tipo: a.tipo,
    tamanho: a.tamanho,
    modificadoEm: a.modificadoEm,
    midia: a.midia,
    verUrl: a.verUrl,
    baixarUrl: a.baixarUrl,
  }));

  return (
    <Card className="min-w-0">
      <div className="grid gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <Trilha trilha={trilha} drives={drives} />

        {pasta ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" className="h-10 sm:h-9" disabled={!podeEnviar} onClick={() => arquivosRef.current?.click()}>
              <Upload aria-hidden /> Enviar arquivos
            </Button>
            {comPasta ? (
              <Button variant="secondary" size="sm" className="h-10 sm:h-9" disabled={!podeEnviar} onClick={() => pastaRef.current?.click()}>
                <FolderUp aria-hidden /> Enviar pasta
              </Button>
            ) : null}
            {podeEnviar ? <NovaPasta paiId={pasta.id} paiNome={pasta.nome} /> : null}
            <a href={pasta.url} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 sm:h-9" })}>
              <ExternalLink aria-hidden /> Abrir no Drive
            </a>
            {projetos.length ? (
              <div className="w-full sm:ml-auto sm:w-64">
                <label htmlFor="ir-projeto" className="sr-only">
                  Ir para o projeto
                </label>
                <Select
                  id="ir-projeto"
                  value=""
                  onChange={(e) => {
                    const id = e.currentTarget.value;
                    if (id) router.push(hrefPasta(id));
                  }}
                  className="h-10 text-[14px]"
                >
                  <option value="">Ir para o projeto</option>
                  {projetos.map((p) => (
                    <option key={p.projectId} value={p.pastaId}>
                      {p.rotulo}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <input ref={arquivosRef} type="file" multiple hidden onChange={aoEscolher} />
            {comPasta ? (
              <input
                ref={(el) => {
                  pastaRef.current = el;
                  el?.setAttribute("webkitdirectory", "");
                }}
                type="file"
                multiple
                hidden
                onChange={aoEscolher}
              />
            ) : null}
          </div>
        ) : null}
        {itens.length && !drives ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-mute">
              {[pastas.length ? `${pastas.length} ${pastas.length === 1 ? "pasta" : "pastas"}` : null, arquivos.length ? `${arquivos.length} ${arquivos.length === 1 ? "arquivo" : "arquivos"}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div role="group" aria-label="Como mostrar" className="flex rounded-full border border-line p-0.5">
              {(
                [
                  ["lista", "Lista", List],
                  ["miniaturas", "Miniaturas", LayoutGrid],
                ] as const
              ).map(([v, rotulo, Icone]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vista === v}
                  onClick={() => trocarVista(v)}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors [&_svg]:size-4",
                    vista === v ? "bg-white text-void" : "text-ash hover:text-light",
                  )}
                >
                  <Icone aria-hidden /> {rotulo}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {pasta && !podeEnviar ? <p className="text-[13px] text-mute">A conta conectada não pode enviar para esta pasta.</p> : null}
        {pasta && podeEnviar && ios ? <p className="text-[13px] text-mute">Escolha pelo app Arquivos para mandar o vídeo original.</p> : null}
      </div>

      <div
        className="relative mt-4 border-t border-line"
        onDragEnter={(e) => {
          if (!podeEnviar || !temArquivos(e)) return;
          e.preventDefault();
          setArrastando((n) => n + 1);
        }}
        onDragOver={(e) => {
          if (!podeEnviar || !temArquivos(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          if (podeEnviar) setArrastando((n) => Math.max(0, n - 1));
        }}
        onDrop={(e) => {
          if (!podeEnviar) return;
          e.preventDefault();
          setArrastando(0);
          // deSoltura lê os itens antes do primeiro await (o DataTransfer some depois).
          deSoltura(e.dataTransfer).then(mandar, () => toast.error("Não deu para ler o que foi solto. Tente pelo botão Enviar."));
        }}
      >
        {arrastando > 0 && pasta ? (
          <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-2xl border border-dashed border-white/40 bg-void/80 backdrop-blur-sm">
            <p className="flex items-center gap-2 text-[15px] text-white">
              <Upload className="size-4" aria-hidden /> Solte para enviar para {pasta.nome}
            </p>
          </div>
        ) : null}

        {!itens.length ? (
          drives ? (
            <EmptyState title="Nenhum drive compartilhado." />
          ) : (
            <EmptyState
              title="Pasta vazia."
              action={
                podeEnviar ? (
                  <Button variant="primary" size="sm" onClick={() => arquivosRef.current?.click()}>
                    <Upload aria-hidden /> Enviar arquivos
                  </Button>
                ) : undefined
              }
            />
          )
        ) : vista === "miniaturas" && !drives ? (
          <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 lg:grid-cols-4">
            {pastas.map((p) => (
              <li key={p.id}>
                <Link
                  href={hrefPasta(p.id)}
                  className="group flex h-full flex-col overflow-hidden rounded-thumb border border-line bg-white/[0.02] transition-colors hover:border-white/25"
                >
                  <span className="grid aspect-[4/3] place-items-center bg-graphite">
                    <IconeDoTipo tipo="pasta" nome={p.nome} />
                  </span>
                  <span className="truncate px-3 py-2.5 text-[13px] text-light" title={p.nome}>
                    {p.nome}
                  </span>
                </Link>
              </li>
            ))}
            {arquivos.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setAberto(i)}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-thumb border border-line bg-white/[0.02] text-left transition-colors hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                  aria-label={`Ver ${a.nome}`}
                >
                  <Miniatura
                    src={a.midia.miniatura ? miniaturaDoPainel(a.id, 640) : null}
                    nome={a.nome}
                    tipo={tipoDeMidia(a)}
                    duracao={duracaoBR(a.midia.duracaoMs)}
                    className="aspect-[4/3] w-full transition-transform duration-500 ease-out-expo"
                  />
                  <span className="grid gap-0.5 px-3 py-2.5">
                    <span className="truncate text-[13px] text-light" title={a.nome}>
                      {a.nome}
                    </span>
                    <span className="text-[11px] text-mute">{a.tamanho != null ? bytesBR(a.tamanho) : "Google Docs"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-line">
            {pastas.map((p) => (
              <li key={p.id}>
                <Link
                  href={hrefPasta(p.id)}
                  className="flex min-h-12 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.03] sm:px-6"
                >
                  {drives ? <HardDrive className="size-4 shrink-0 text-ash" aria-hidden /> : <Folder className="size-4 shrink-0 text-ash" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-[14px] text-light">{p.nome}</span>
                  {p.modificadoEm ? <span className="hidden shrink-0 text-[12px] text-mute sm:inline">{dataBR.format(new Date(p.modificadoEm))}</span> : null}
                  <ChevronRight className="size-4 shrink-0 text-mute" aria-hidden />
                </Link>
              </li>
            ))}
            {arquivos.map((a, i) => (
              <ArquivoLinha key={a.id} a={a} onAbrir={() => setAberto(i)} />
            ))}
          </ul>
        )}

        {pagina || proxima ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 sm:px-6">
            {pagina && pasta ? (
              <Link href={hrefPasta(pasta.id)} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Primeira página
              </Link>
            ) : (
              <span />
            )}
            {proxima && pasta ? (
              <Link
                href={`${hrefPasta(pasta.id)}&pagina=${encodeURIComponent(proxima)}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Mostrar mais
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {aberto != null && previas[aberto] ? (
        <PreviaPainel arquivos={previas} indice={aberto} onIndice={setAberto} onFechar={() => setAberto(null)} />
      ) : null}
    </Card>
  );
}

function ArquivoLinha({ a, onAbrir }: { a: ItemLista; onAbrir: () => void }) {
  const meta = [
    a.tamanho != null ? bytesBR(a.tamanho) : null,
    duracaoBR(a.midia.duracaoMs),
    a.modificadoEm ? dataBR.format(new Date(a.modificadoEm)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex min-h-12 items-center gap-3 px-5 py-2 sm:px-6">
      <button type="button" onClick={onAbrir} className="group flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Ver ${a.nome}`}>
        <Miniatura
          src={a.midia.miniatura ? miniaturaDoPainel(a.id, 160) : null}
          nome={a.nome}
          tipo={tipoDeMidia(a)}
          className="size-10 shrink-0 rounded-[10px] [&_.label]:hidden [&_svg]:size-4"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-light group-hover:text-white" title={a.nome}>
            {a.nome}
          </span>
          {meta ? <span className="block text-[12px] text-mute">{meta}</span> : null}
        </span>
      </button>
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {a.baixarUrl ? (
          <a href={a.baixarUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            <Download aria-hidden /> Baixar
          </a>
        ) : null}
        <a href={a.verUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <ExternalLink aria-hidden /> Abrir
        </a>
      </div>
      <div className="sm:hidden">
        <Menu modal={false}>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`Ações: ${a.nome}`}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.08] hover:text-light",
                "data-[state=open]:bg-white/[0.08] data-[state=open]:text-light",
              )}
            >
              <Ellipsis className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            {a.baixarUrl ? (
              <MenuItem asChild>
                <a href={a.baixarUrl} target="_blank" rel="noreferrer">
                  <Download /> Baixar
                </a>
              </MenuItem>
            ) : null}
            <MenuItem asChild>
              <a href={a.verUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Abrir
              </a>
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}
