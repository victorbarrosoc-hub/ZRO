import type { Metadata } from "next";
import { after } from "next/server";
import { AlertTriangle, ExternalLink, FolderTree, HardDrive, Users } from "lucide-react";
import { InfoList } from "@/components/painel/bits";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { bytesBR } from "@/lib/drive/bytes";
import { dadosDaConexao, statusDrive } from "@/lib/google/conexao";
import { caminhoDaPasta } from "@/lib/google/drive";
import { acessosDaEquipe } from "@/lib/services/drive-entregas";
import { conciliarParados, resumoDeEnvios } from "@/lib/services/drive-envios";
import { projetosAtivosSemPasta } from "@/lib/services/drive-pastas";
import { AjustesTabs } from "../ajustes-tabs";
import { TesteDeEnvio } from "./diagnostico";
import {
  AcessoEquipeForm,
  AvisoConectado,
  ConectarGoogle,
  CriarPastasAtivos,
  DesconectarGoogle,
  PastaRaizForm,
  TirarAcessoEquipe,
} from "./google-forms";

export const metadata: Metadata = { title: "Google Drive" };

const ERROS: Record<string, string> = {
  config: "Faltam as chaves do Google na Vercel.",
  sessao: "Entre de novo e conecte.",
  estado: "A conexão demorou demais. Tente de novo.",
  troca: "O Google recusou a conexão. Confira a chave na Vercel e tente de novo.",
  api: "A Google Drive API está desligada no projeto do Google Cloud. Ative em console.cloud.google.com/apis/library/drive.googleapis.com e conecte de novo.",
  negado: "O Google não autorizou.",
  sem_refresh: "O Google não mandou o acesso contínuo. Remova o app em myaccount.google.com/permissions e conecte de novo.",
  permissao: "Marque a permissão do Google Drive ao conectar.",
};

const LIMITE_DIA = 750 * 1000 ** 3;

function Aviso({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 border-warn/40 bg-[linear-gradient(180deg,rgb(217_164_65/0.10),rgb(217_164_65/0.03))] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <p className="text-[15px] text-white">{children}</p>
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </Card>
  );
}

export default async function GooglePage({ searchParams }: PageProps<"/painel/ajustes/google">) {
  await requireUser();
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  const nova = typeof sp.nova === "string" && /^[^@\s]{1,100}@[^@\s]{1,100}$/.test(sp.nova) ? sp.nova : null;
  const conectouAgora = sp.ok === "1";

  const [status, dados, resumo] = await Promise.all([statusDrive({ espaco: true }), dadosDaConexao(), resumoDeEnvios()]);
  const conectado = status.estado === "conectado";
  // Envios parados há mais de 2 h: confere no Google depois da resposta (sem cron).
  if (conectado) after(() => conciliarParados().then(() => undefined, () => undefined));
  const [equipe, semPasta, trilha] = await Promise.all([
    conectado ? acessosDaEquipe() : Promise.resolve([]),
    conectado ? projetosAtivosSemPasta() : Promise.resolve([]),
    conectado && status.raiz ? caminhoDaPasta(status.raiz.id).catch(() => null) : Promise.resolve(null),
  ]);

  const situacao =
    status.estado === "conectado" ? (
      <Badge tone="ok" dot>
        Conectado
      </Badge>
    ) : status.estado === "reconectar" ? (
      <Badge tone="warn" dot>
        Reconectar
      </Badge>
    ) : status.estado === "sem-config" ? (
      <Badge tone="warn">Sem as chaves</Badge>
    ) : (
      <Badge>Desconectado</Badge>
    );
  const conta = status.estado === "conectado" || status.estado === "reconectar" ? status.conta : null;
  const espaco =
    status.estado === "conectado" && status.espaco
      ? status.espaco.limite
        ? `${bytesBR(status.espaco.usado)} usados de ${bytesBR(status.espaco.limite)}`
        : "Espaço do Workspace"
      : "—";

  return (
    <div className="grid gap-8">
      <PageHeader label="Ajustes" title="Google Drive" />
      <AjustesTabs active="google" />
      {conectouAgora ? <AvisoConectado /> : null}

      {status.estado === "sem-config" ? <Aviso>Faltam {status.faltam.join(", ")} na Vercel.</Aviso> : null}
      {erro === "outra_conta" && nova ? (
        <Aviso acao={<ConectarGoogle rotulo={`Trocar para ${nova}`} trocar />}>
          Você entrou com {nova}, diferente da conta conectada ({dados?.conta ?? "—"}).
        </Aviso>
      ) : erro && ERROS[erro] ? (
        <Aviso>{ERROS[erro]}</Aviso>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        <div className="grid gap-4 xl:col-span-7">
          <Card>
            <CardHeader title="Conta Google" action={<HardDrive className="size-4 text-mute" aria-hidden />} />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={[
                  { label: "Situação", value: situacao },
                  { label: "Conta", value: conta ?? "—" },
                  { label: "Espaço", value: espaco },
                  { label: "Enviado nas últimas 24 h", value: `${bytesBR(resumo.bytes24h)} de ${bytesBR(LIMITE_DIA)}` },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
              {status.estado === "desconectado" ? <ConectarGoogle /> : null}
              {status.estado === "reconectar" ? <ConectarGoogle rotulo="Reconectar" /> : null}
              {status.estado === "conectado" || status.estado === "reconectar" ? <DesconectarGoogle enviando={resumo.emAndamento} /> : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Teste de envio direto" />
            <TesteDeEnvio raizId={conectado ? (status.raiz?.id ?? null) : null} ultimos={dados?.diagnosticos ?? []} />
          </Card>
        </div>

        <div className="grid gap-4 xl:col-span-5">
          <Card>
            <CardHeader title="Pasta raiz" action={<FolderTree className="size-4 text-mute" aria-hidden />} />
            <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
              <div className="min-w-0">
                <p className="text-[15px] text-light">{dados?.raizNome ?? "ZRO"}</p>
                <p className="mt-1 truncate font-mono text-[12px] text-mute">
                  {trilha ? trilha.map((t) => t.nome).join(" / ") : conectado ? "A pasta nasce no primeiro uso." : "—"}
                </p>
              </div>
              {conectado ? (
                <div className="flex flex-wrap gap-2">
                  {status.raiz ? (
                    <a href={status.raiz.url} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
                      <ExternalLink aria-hidden /> Abrir no Drive
                    </a>
                  ) : null}
                  <PastaRaizForm />
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Acesso da equipe" action={<Users className="size-4 text-mute" aria-hidden />} />
            <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
              {equipe.length ? (
                <ul className="grid">
                  {equipe.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                      <span className="min-w-0 truncate text-[14px] text-light">{a.email}</span>
                      <TirarAcessoEquipe id={a.id} email={a.email ?? ""} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-mute">Só a conta conectada edita a pasta raiz.</p>
              )}
              {conectado ? (
                <div>
                  <AcessoEquipeForm />
                </div>
              ) : null}
            </div>
          </Card>

          {conectado ? (
            <Card>
              <CardHeader title="Projetos sem pasta" />
              <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
                <p className="text-[14px] text-ash">
                  {semPasta.length === 0
                    ? "Todos os projetos ativos têm pasta no Drive."
                    : semPasta.length === 1
                      ? "1 projeto ativo sem pasta no Drive."
                      : `${semPasta.length} projetos ativos sem pasta no Drive.`}
                </p>
                {semPasta.length ? (
                  <div>
                    <CriarPastasAtivos total={semPasta.length} />
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
