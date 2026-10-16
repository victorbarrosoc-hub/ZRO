/**
 * Aba "Drive" do projeto (docs/dev/drive.md §7.2): a pasta do projeto no Google Drive, o link de envio
 * de cada diária com os rolos que chegaram, as entregas para o cliente e o que o cliente mandou.
 * Os bytes nunca passam pela ZRO: daqui só saem links do próprio Google.
 */
import Link from "next/link";
import { after } from "next/server";
import { Building2, Camera, ExternalLink, FolderOpen, Mic, Upload } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { dateBR, todayISO } from "@/lib/format";
import { statusDrive } from "@/lib/google/conexao";
import {
  contatoDoCliente,
  detalheDoLote,
  diaMes,
  diariasComEnvio,
  drivePorProjeto,
  lotesDoProjeto,
  tituloDoLote,
  type DiariaComEnvio,
  type LoteResumo,
} from "@/lib/queries/drive-painel";
import type { ProjectDetail } from "@/lib/queries/projects";
import { compartilhamentosDoProjeto, type CompartilhamentoDTO } from "@/lib/services/drive-entregas";
import { conciliarParados, marcarLotesVistos } from "@/lib/services/drive-envios";
import { areaDoCliente, textoWhatsAppDiaria, type LinkDTO } from "@/lib/services/drive-links";
import { pastasDoProjeto, type DriveProjetoDTO } from "@/lib/services/drive-pastas";
import { cn } from "@/lib/utils";
import {
  AcoesLinkDiaria,
  Andamento,
  ApagarPasta,
  AtualizaEnquantoCria,
  CopiarBotao,
  GerarLinkDiaria,
  LiberarEntregas,
  PastasBotao,
  RecolherEntregas,
} from "../_components/drive-dialogs";

const DIA_MS = 24 * 60 * 60_000;

/* ============================== Peças reaproveitadas (Arquivos e CRM) ============================== */

const ICONES = { video: Camera, audio: Mic, cliente: Building2, painel: Upload } as const;

/** Uma linha do que chegou: ícone pela origem, título, detalhe, situação e "Abrir no Drive". */
export function LoteLinha({
  lote,
  detalhe,
  titulo,
  mostrarNovo = false,
}: {
  lote: LoteResumo;
  detalhe: string;
  titulo?: string;
  mostrarNovo?: boolean;
}) {
  const Icone = ICONES[lote.tipo];
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-line text-ash">
        <Icone className="size-4" aria-hidden />
        {mostrarNovo && lote.novo ? (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-ink bg-white" aria-label="Novo" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-light">{titulo ?? tituloDoLote(lote)}</p>
        <p className="mt-0.5 text-[12px] text-mute">{detalhe}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <Badge tone={lote.situacao.tom}>{lote.situacao.texto}</Badge>
        <a
          href={lote.pastaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-ash transition-colors hover:bg-white/[0.06] hover:text-light sm:h-8"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Abrir
        </a>
      </div>
    </li>
  );
}

/** Aviso de Google fora (sem as chaves, desconectado, reconectar). */
export function AvisoGoogle({ estado }: { estado: "sem-config" | "desconectado" | "reconectar" }) {
  const texto =
    estado === "sem-config"
      ? "Faltam as chaves do Google na Vercel."
      : estado === "reconectar"
        ? "A conexão com o Google expirou."
        : "Conecte o Google Drive em Ajustes.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/35 bg-warn/[0.06] px-4 py-3">
      <p className="text-[14px] text-light">{texto}</p>
      <ButtonLink href="/painel/ajustes/google" variant="secondary" size="sm" className="h-10 sm:h-8">
        {estado === "reconectar" ? "Reconectar" : "Ver em Ajustes"}
      </ButtonLink>
    </div>
  );
}

/* ============================== Aba ============================== */

export async function ProjectDriveTab({ project }: { project: ProjectDetail }) {
  const user = await requireUser();
  const [status, dp, lotes, contato, info, compartilhamentos] = await Promise.all([
    statusDrive(),
    pastasDoProjeto(project.id),
    lotesDoProjeto(project.id),
    contatoDoCliente(project.clientId),
    drivePorProjeto([project.id]),
    compartilhamentosDoProjeto(project.id),
  ]);
  const conectado = status.estado === "conectado";
  const [diarias, area] = await Promise.all([
    diariasComEnvio(project.id, lotes),
    project.clientId ? areaDoCliente(project.clientId, { criar: false, userId: user.id }) : Promise.resolve(null),
  ]);

  // Envios parados há mais de 2 h: confere no Google depois da resposta. O que apareceu agora deixa de ser "novo".
  if (conectado) after(() => conciliarParados().then(() => undefined, () => undefined));
  const novos = lotes.filter((l) => l.novo).map((l) => l.id);
  if (novos.length) after(() => marcarLotesVistos(novos).catch(() => undefined));

  const doCliente = lotes.filter((l) => l.origem === "cliente");
  const liberacao = info.get(project.id);
  const linkArea = area?.ok && area.link?.estado === "ativo" ? area.link : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      {status.estado !== "conectado" ? <AvisoGoogle estado={status.estado} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
        <div className="min-w-0">
          <PastaDoProjeto projectId={project.id} dp={dp} conectado={conectado} />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-2">
          <Card className="min-w-0">
            <CardHeader title="Material das diárias" />
            {diarias.length ? (
              <ul className="mt-2 divide-y divide-line">
                {diarias.map((d) => (
                  <DiariaLinha key={d.eventId} d={d} projeto={project.title} conectado={conectado} />
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">
                Nenhuma diária neste projeto.{" "}
                <Link
                  href={`/painel/projetos/${project.id}?aba=agenda`}
                  className="text-light underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
                >
                  Marcar na agenda
                </Link>
              </p>
            )}
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <EntregasCard
              projectId={project.id}
              temCliente={Boolean(project.clientId)}
              email={contato?.email?.trim() || null}
              liberadasEm={liberacao?.liberadasEm ?? null}
              liberadasPor={liberacao?.liberadasPor ?? null}
              compartilhamentos={compartilhamentos}
              linkArea={linkArea}
              conectado={conectado}
            />
            <Card>
              <CardHeader title="Do cliente" />
              {doCliente.length ? (
                <ul className="divide-y divide-line px-5 pt-1 pb-2 sm:px-6">
                  {doCliente.map((l) => (
                    <LoteLinha key={l.id} lote={l} detalhe={detalheDoLote(l, { semProjeto: true, quando: "data" })} />
                  ))}
                </ul>
              ) : (
                <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nada enviado pelo cliente ainda.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== Pasta do projeto ============================== */

function PastaDoProjeto({ projectId, dp, conectado }: { projectId: string; dp: DriveProjetoDTO | null; conectado: boolean }) {
  return (
    <Card>
      <CardHeader title="Pasta do projeto" action={<FolderOpen className="size-4 text-mute" aria-hidden />} />
      <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
        {!dp ? (
          conectado ? (
            <>
              <p className="text-[14px] text-ash">Este projeto ainda não tem pasta no Drive.</p>
              <div>
                <PastasBotao projectId={projectId} rotulo="Criar pastas no Drive" />
              </div>
            </>
          ) : (
            <p className="text-[14px] text-mute">Conecte o Google Drive em Ajustes.</p>
          )
        ) : (
          <>
            {dp.contaAntiga ? (
              <div className="grid gap-3">
                <p className="text-[14px] text-warn">As pastas estão na conta antiga ({dp.conta}).</p>
                {conectado ? (
                  <div>
                    <PastasBotao projectId={projectId} modo="contaAtual" rotulo="Criar na conta atual" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {dp.estado === "criando" && !dp.contaAntiga ? (
              <div>
                <Andamento texto="Criando as pastas no Drive" />
                <AtualizaEnquantoCria />
              </div>
            ) : null}

            {(dp.estado === "incompleta" || dp.estado === "erro") && !dp.contaAntiga ? (
              <div className="grid gap-3">
                <p className="text-[14px] text-warn" role="alert">
                  {dp.erro ?? (dp.estado === "erro" ? "Não deu para criar as pastas." : "Faltam pastas no Drive.")}
                </p>
                {conectado ? (
                  <div className="flex flex-wrap gap-2">
                    <PastasBotao projectId={projectId} rotulo="Tentar de novo" />
                    {dp.estado === "incompleta" ? <PastasBotao projectId={projectId} modo="verificar" rotulo="Recriar o que falta" variant="ghost" /> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {dp.caminho ? <p className="font-mono text-[12px] break-words text-mute">{dp.caminho}</p> : null}
            {dp.deLink ? <p className="text-[13px] text-mute">Usando a pasta do link do projeto.</p> : null}

            {dp.pastaId ? (
              <div className="flex flex-wrap gap-2">
                {dp.pastaUrl ? (
                  <a href={dp.pastaUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", size: "sm", className: "h-10 sm:h-8" })}>
                    <ExternalLink aria-hidden /> Abrir no Drive
                  </a>
                ) : null}
                {!dp.contaAntiga && conectado ? (
                  <ButtonLink href={`/painel/arquivos?pasta=${encodeURIComponent(dp.pastaId)}`} variant="primary" size="sm" className="h-10 sm:h-8">
                    <Upload aria-hidden /> Enviar arquivos
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}

            {dp.pastas.some((p) => p.id) ? (
              <ul className="grid">
                {dp.pastas.map((p) => {
                  const sub = p.chave.includes("/");
                  return (
                    <li key={p.chave} className={cn("border-b border-line last:border-b-0", sub && "pl-5")}>
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "flex min-h-10 items-center justify-between gap-3 py-1.5 transition-colors hover:text-white",
                            sub ? "text-[13px] text-ash" : "text-[14px] text-light",
                          )}
                        >
                          <span className="truncate">{p.nome}</span>
                          <ExternalLink className="size-3.5 shrink-0 text-mute" aria-hidden />
                        </a>
                      ) : (
                        <span className={cn("flex min-h-10 items-center justify-between gap-3 py-1.5 text-mute", sub ? "text-[13px]" : "text-[14px]")}>
                          <span className="truncate">{p.nome}</span>
                          <span className="text-[12px]">falta</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {!dp.contaAntiga && conectado && dp.estado !== "criando" && (dp.estado === "pronta" || (dp.pastaId && !dp.deLink)) ? (
              <div className="flex flex-wrap gap-2">
                {dp.estado === "pronta" ? <PastasBotao projectId={projectId} modo="verificar" rotulo="Recriar o que falta" variant="ghost" /> : null}
                {dp.pastaId && !dp.deLink ? <ApagarPasta projectId={projectId} /> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

/* ============================== Diárias ============================== */

function situacaoDoLink(link: LinkDTO | null, agora = Date.now()): { texto: string; tom: "ok" | "warn" | "neutral" } {
  if (!link) return { texto: "Sem link", tom: "neutral" };
  if (link.estado === "desativado") return { texto: "Desativado", tom: "neutral" };
  if (link.estado === "expirado") return { texto: "Expirado", tom: "warn" };
  if (link.expiraEm) {
    const falta = link.expiraEm.getTime() - agora;
    if (falta <= 3 * DIA_MS) {
      const dias = Math.ceil(falta / DIA_MS);
      return { texto: dias <= 1 && todayISO(link.expiraEm) === todayISO() ? "Expira hoje" : dias <= 1 ? "Expira amanhã" : `Expira em ${dias} dias`, tom: "warn" };
    }
  }
  return { texto: "Ativo", tom: "ok" };
}

function DiariaLinha({ d, projeto, conectado }: { d: DiariaComEnvio; projeto: string; conectado: boolean }) {
  const link = d.link;
  const s = situacaoDoLink(link);
  const ativo = link?.estado === "ativo" ? link : null;
  const texto = ativo?.url ? textoWhatsAppDiaria({ data: d.data, projeto, url: ativo.url }) : null;
  return (
    <li className="grid gap-3 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-light">
            {diaMes(d.data)}
            {d.numero != null ? ` · Diária ${String(d.numero).padStart(2, "0")}` : ""}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-mute">{[d.titulo, d.local].filter(Boolean).join(" · ")}</p>
        </div>
        <Badge tone={s.tom}>{s.texto}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ativo ? (
          <AcoesLinkDiaria linkId={ativo.id} url={ativo.url} texto={texto} expiraEm={ativo.expiraEm ? todayISO(ativo.expiraEm) : null} />
        ) : conectado ? (
          <GerarLinkDiaria eventId={d.eventId} rotulo={link ? "Gerar link novo" : "Gerar link"} />
        ) : (
          <p className="text-[13px] text-mute">Conecte o Drive em Ajustes para gerar o link.</p>
        )}
      </div>
      {link?.estado === "ativo" && link.expiraEm ? (
        <p className="-mt-1 text-[12px] text-mute">Vale até {dateBR(todayISO(link.expiraEm))}.</p>
      ) : null}

      {d.rolos.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line px-3 sm:px-4">
          {d.rolos.map((l) => (
            <LoteLinha key={l.id} lote={l} detalhe={detalheDoLote(l, { semProjeto: true, semDiaria: true, quando: "data" })} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-mute">Nada recebido ainda.</p>
      )}
    </li>
  );
}

/* ============================== Entregas ============================== */

function maisRecente(lista: CompartilhamentoDTO[]): number {
  return lista.reduce((m, c) => Math.max(m, c.criadoEm.getTime()), 0);
}

function EntregasCard({
  projectId,
  temCliente,
  email,
  liberadasEm,
  liberadasPor,
  compartilhamentos,
  linkArea,
  conectado,
}: {
  projectId: string;
  temCliente: boolean;
  email: string | null;
  liberadasEm: Date | null;
  liberadasPor: string | null;
  compartilhamentos: CompartilhamentoDTO[];
  linkArea: LinkDTO | null;
  conectado: boolean;
}) {
  const ativos = compartilhamentos.filter((c) => c.motivo === "entregas" && !c.revogadoEm);
  const publicoOk = ativos.filter((c) => c.tipo === "anyone" && !c.erro);
  const publicoErro = ativos.filter((c) => c.tipo === "anyone" && c.erro);
  const bloqueio = !liberadasEm && maisRecente(publicoErro) > maisRecente(publicoOk) ? publicoErro[0]?.erro : null;
  const avisados = ativos.filter((c) => c.tipo === "user" && c.avisouPorEmail && !c.erro && c.email);
  const emailFalhou = ativos.find((c) => c.tipo === "user" && c.erro && c.email && !avisados.some((a) => a.email === c.email));

  return (
    <Card>
      <CardHeader title="Entregas para o cliente" />
      <div className="grid gap-3 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
        {!temCliente ? (
          <p className="text-[14px] text-mute">Projeto sem cliente.</p>
        ) : liberadasEm ? (
          <>
            <p className="text-[14px] text-light">
              Liberadas em {dateBR(todayISO(liberadasEm)).slice(0, 5)}
              {liberadasPor ? ` por ${liberadasPor}` : ""}
            </p>
            {avisados.map((a) => (
              <p key={a.id} className="-mt-2 text-[13px] text-mute">
                {a.email} avisado pelo Google
              </p>
            ))}
            {emailFalhou ? (
              <p className="text-[13px] text-warn">
                Não deu para avisar {emailFalhou.email}. {emailFalhou.erro}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {linkArea?.url ? <CopiarBotao texto={linkArea.url} rotulo="Copiar link da área" /> : null}
              {conectado ? <RecolherEntregas projectId={projectId} /> : null}
            </div>
          </>
        ) : (
          <>
            <p className="text-[14px] text-ash">O cliente ainda não vê as entregas.</p>
            {bloqueio ? (
              <p className="text-[13px] text-warn" role="alert">
                {bloqueio}
              </p>
            ) : null}
            {conectado ? (
              <div>
                <LiberarEntregas projectId={projectId} email={email} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
