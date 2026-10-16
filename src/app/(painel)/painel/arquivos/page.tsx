import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { AlertTriangle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { idDriveValido, limparControles } from "@/lib/drive/nomes";
import { statusDrive } from "@/lib/google/conexao";
import { arquivoOuNull, caminhoDaPasta, linkPasta, listarDrivesCompartilhados, listarPasta } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";
import { detalheDoLote, lotesRecentes, projetosComPasta } from "@/lib/queries/drive-painel";
import { conciliarParados, marcarLotesVistos } from "@/lib/services/drive-envios";
import { garantirRaiz } from "@/lib/services/drive-pastas";
import { LoteLinha } from "../projetos/[id]/_tabs/drive-tab";
import { FaixaFila, Fila, FilaProvider } from "./fila";
import { Navegador, Trilha, type ItemLista, type PastaAberta } from "./navegador";
import { COOKIE_VISTA } from "./vista";

export const metadata: Metadata = { title: "Arquivos" };

function Aviso({ texto, acao }: { texto: string; acao?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 border-warn/40 bg-[linear-gradient(180deg,rgb(217_164_65/0.10),rgb(217_164_65/0.03))] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <p className="text-[15px] text-white">{texto}</p>
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </Card>
  );
}

function mensagemGoogle(e: unknown): string {
  if (e instanceof GoogleError) {
    if (e.motivo === "reconectar") return "A conexão com o Google expirou.";
    if (e.motivo === "sem_permissao") return "A conta conectada não abre esta pasta.";
  }
  return "O Google não respondeu. Tente de novo em instantes.";
}

type Lista =
  | { tipo: "ok"; pasta: PastaAberta | null; trilha: { id: string; nome: string }[]; itens: ItemLista[]; proxima: string | null }
  | { tipo: "sumiu" }
  | { tipo: "erro"; mensagem: string };

/** A pasta pedida (validada; sem ela, a raiz ZRO) ou a lista dos drives compartilhados. */
async function carregar(pedida: string | null, pagina: string | null, drives: boolean): Promise<Lista> {
  try {
    if (drives) {
      const lista = await listarDrivesCompartilhados();
      const itens = lista.map((d) => ({
        id: d.id,
        nome: d.nome,
        pasta: true,
        tamanho: null,
        modificadoEm: null,
        verUrl: linkPasta(d.id),
        baixarUrl: null,
        tipo: "application/vnd.google-apps.folder",
        midia: { miniatura: false, duracaoMs: null, largura: null, altura: null },
      }));
      return { tipo: "ok", pasta: null, trilha: [], itens, proxima: null };
    }
    let pastaId = pedida;
    if (!pastaId) {
      try {
        pastaId = (await garantirRaiz()).raizId;
      } catch (e) {
        if (e instanceof GoogleError && e.motivo === "reconectar") throw e;
        pastaId = "root";
      }
    }
    const a = await arquivoOuNull(pastaId);
    if (!a || !a.pasta || a.lixeira) return { tipo: "sumiu" };
    const [trilha, lista] = await Promise.all([
      caminhoDaPasta(a.id).catch(() => [{ id: a.id, nome: a.nome || "Meu Drive" }]),
      listarPasta(a.id, pagina),
    ]);
    const nome = limparControles(trilha.at(-1)?.nome || a.nome || "Meu Drive").nome;
    return {
      tipo: "ok",
      pasta: { id: a.id, nome, url: a.verUrl || linkPasta(a.id), podeEnviar: a.podeAdicionar },
      trilha: trilha.map((t) => ({ id: t.id, nome: limparControles(t.nome).nome })),
      itens: lista.itens.map((i) => ({
        id: i.id,
        nome: limparControles(i.nome).nome, // nomes feitos fora da ZRO: sem caracteres de direção (golpe do "\u202E")
        pasta: i.pasta,
        tamanho: i.tamanho,
        modificadoEm: i.modificadoEm,
        verUrl: i.verUrl,
        baixarUrl: i.baixarUrl,
        tipo: i.tipo,
        midia: i.midia,
      })),
      proxima: lista.proxima,
    };
  } catch (e) {
    if (e instanceof GoogleError && (e.motivo === "nao_encontrado" || e.motivo === "pasta")) return { tipo: "sumiu" };
    return { tipo: "erro", mensagem: mensagemGoogle(e) };
  }
}

export default async function ArquivosPage({ searchParams }: PageProps<"/painel/arquivos">) {
  await requireUser();
  const sp = await searchParams;
  const pedida = typeof sp.pasta === "string" && idDriveValido(sp.pasta) ? sp.pasta : null;
  const pagina = typeof sp.pagina === "string" && /^[\w.~-]{1,600}$/.test(sp.pagina) ? sp.pagina : null;
  const drives = sp.drives === "1";
  const vista = (await cookies()).get(COOKIE_VISTA)?.value === "miniaturas" ? "miniaturas" : "lista";

  const status = await statusDrive();
  const header = <PageHeader label="Drive" title="Arquivos" />;

  if (status.estado !== "conectado") {
    const aviso =
      status.estado === "sem-config" ? (
        <Aviso texto="Faltam as chaves do Google na Vercel." acao={<ButtonLink href="/painel/ajustes/google" variant="secondary">Ver em Ajustes</ButtonLink>} />
      ) : status.estado === "reconectar" ? (
        <Aviso texto="A conexão com o Google expirou." acao={<ButtonLink href="/painel/ajustes/google" variant="primary">Reconectar</ButtonLink>} />
      ) : (
        <Aviso texto="Google Drive desconectado." acao={<ButtonLink href="/painel/ajustes/google" variant="primary">Conectar em Ajustes</ButtonLink>} />
      );
    return (
      <div className="grid gap-8">
        {header}
        {aviso}
      </div>
    );
  }

  const [lista, chegou, projetos] = await Promise.all([carregar(pedida, pagina, drives), lotesRecentes(), projetosComPasta()]);

  // Envios parados há mais de 2 h: confere no Google depois da resposta (sem cron). O que apareceu agora deixa de ser "novo".
  after(() => conciliarParados().then(() => undefined, () => undefined));
  const novos = chegou.filter((l) => l.novo).map((l) => l.id);
  if (novos.length) after(() => marcarLotesVistos(novos).catch(() => undefined));

  return (
    <FilaProvider>
      <div className="grid gap-8">
        {header}

        {chegou.length ? (
          <Card className="min-w-0">
            <CardHeader title="Chegou" description="Freelas e clientes, últimos 7 dias" />
            <ul className="divide-y divide-line px-5 pt-1 pb-2 sm:px-6">
              {chegou.map((l) => (
                <LoteLinha key={l.id} lote={l} detalhe={detalheDoLote(l)} mostrarNovo />
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
          <div className="min-w-0 xl:col-span-8">
            {lista.tipo === "ok" ? (
              <Navegador
                key={lista.pasta?.id ?? "drives"}
                pasta={lista.pasta}
                trilha={lista.trilha}
                itens={lista.itens}
                proxima={lista.proxima}
                pagina={pagina}
                drives={drives}
                projetos={projetos}
                vistaInicial={vista}
              />
            ) : (
              <Card className="min-w-0">
                <div className="grid gap-4 px-5 py-6 sm:px-6">
                  <Trilha trilha={[]} drives={false} />
                  {lista.tipo === "sumiu" ? (
                    <>
                      <p className="text-[15px] text-light">Esta pasta não existe mais no Drive.</p>
                      <div>
                        <ButtonLink href="/painel/arquivos" variant="secondary" size="sm">
                          Voltar para ZRO
                        </ButtonLink>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[15px] text-light">{lista.mensagem}</p>
                      <div className="flex flex-wrap gap-2">
                        <ButtonLink href={pedida ? `/painel/arquivos?pasta=${encodeURIComponent(pedida)}` : "/painel/arquivos"} variant="secondary" size="sm">
                          Tentar de novo
                        </ButtonLink>
                        <ButtonLink href="/painel/ajustes/google" variant="ghost" size="sm">
                          Ver em Ajustes
                        </ButtonLink>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
          <div className="min-w-0 xl:sticky xl:top-6 xl:col-span-4">
            <Fila />
          </div>
        </div>
        <FaixaFila />
      </div>
    </FilaProvider>
  );
}
