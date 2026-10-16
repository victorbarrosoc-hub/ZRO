/**
 * Aba "Área do cliente" (docs/dev/drive.md §7.4): o link da área (senha opcional, limite por dia),
 * as entregas de cada projeto, o que o cliente mandou e a pasta dele no Drive.
 */
import Link from "next/link";
import { after } from "next/server";
import { ExternalLink, FolderOpen } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { bytesBR, GB } from "@/lib/drive/bytes";
import { dateBR, todayISO } from "@/lib/format";
import { statusDrive } from "@/lib/google/conexao";
import {
  detalheDoLote,
  drivePorProjeto,
  lotesDoCliente,
  pastasDoCliente,
  projetosDoCliente,
  quandoRelativo,
} from "@/lib/queries/drive-painel";
import { marcarLotesVistos } from "@/lib/services/drive-envios";
import { areaDoCliente, textoWhatsAppArea } from "@/lib/services/drive-links";
import { LiberarEntregas, RecolherEntregas } from "../../../projetos/[id]/_components/drive-dialogs";
import { AvisoGoogle, LoteLinha } from "../../../projetos/[id]/_tabs/drive-tab";
import { AcoesArea, CriarArea } from "../../area-dialogs";

type Cliente = { id: string; name: string; phone: string | null; email: string | null; contactName: string | null };

export async function ClientAreaTab({ client }: { client: Cliente }) {
  const user = await requireUser();
  const [status, area, projetos, lotes, pastas] = await Promise.all([
    statusDrive(),
    areaDoCliente(client.id, { criar: false, userId: user.id }),
    projetosDoCliente(client.id),
    lotesDoCliente(client.id),
    pastasDoCliente(client.id),
  ]);
  const drive = await drivePorProjeto(projetos.map((p) => p.id));
  const conectado = status.estado === "conectado";
  const novos = lotes.filter((l) => l.novo).map((l) => l.id);
  if (novos.length) after(() => marcarLotesVistos(novos).catch(() => undefined));

  const link = area.ok ? area.link : null;
  const ativo = link?.estado === "ativo" ? link : null;
  const textos = ativo?.url ? textoWhatsAppArea({ contato: client.contactName, cliente: client.name, url: ativo.url, temSenha: ativo.temSenha }) : null;
  const email = client.email?.trim() || null;

  return (
    <div className="grid grid-cols-1 gap-4">
      {status.estado !== "conectado" ? <AvisoGoogle estado={status.estado} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-7">
          <Card>
            <CardHeader
              title="Link da área"
              action={ativo ? <Badge tone={ativo.temSenha ? "light" : "neutral"}>{ativo.temSenha ? "Com senha" : "Sem senha"}</Badge> : null}
            />
            <div className="grid gap-4 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
              {ativo ? (
                <>
                  {ativo.url ? (
                    <p className="truncate rounded-xl border border-line bg-white/[0.02] px-3 py-2 font-mono text-[12px] text-ash" title={ativo.url}>
                      {ativo.url}
                    </p>
                  ) : null}
                  <AcoesArea
                    clientId={client.id}
                    linkId={ativo.id}
                    url={ativo.url}
                    texto={textos ? textos.join("\n\n") : null}
                    telefone={client.phone}
                    temSenha={ativo.temSenha}
                    limiteGB={ativo.limiteBytes != null ? Math.round((ativo.limiteBytes / GB) * 10) / 10 : null}
                  />
                  <p className="text-[13px] text-mute">
                    {ativo.limiteBytes != null ? `Até ${bytesBR(ativo.limiteBytes)} de envio por dia.` : "Envio sem limite por dia."}
                    {ativo.ultimoUsoEm ? ` Último uso ${quandoRelativo(ativo.ultimoUsoEm)}.` : " Ainda não foi usado."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[14px] text-ash">
                    {link?.estado === "desativado" ? "A área deste cliente está desativada." : "Este cliente ainda não tem área."}
                  </p>
                  <div>
                    <CriarArea clientId={client.id} rotulo={link ? "Criar área nova" : "Criar área do cliente"} />
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Enviado pelo cliente" />
            {lotes.length ? (
              <ul className="divide-y divide-line px-5 pt-1 pb-2 sm:px-6">
                {lotes.map((l) => (
                  <LoteLinha
                    key={l.id}
                    lote={l}
                    titulo={`${dateBR(todayISO(l.criadoEm)).slice(0, 5)} · ${l.assunto ?? l.rotulo}`}
                    detalhe={detalheDoLote(l, { quando: "nao" })}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nada enviado ainda.</p>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-span-5">
          <Card>
            <CardHeader title="Entregas" />
            {projetos.length ? (
              <ul className="divide-y divide-line px-5 pt-1 pb-2 sm:px-6">
                {projetos.map((p) => {
                  const d = drive.get(p.id);
                  const liberadas = d?.liberadasEm ?? null;
                  const semPasta = !d?.estado || d.contaAntiga;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0">
                        <Link href={`/painel/projetos/${p.id}?aba=drive`} className="block truncate text-[14px] text-light hover:underline">
                          {p.title}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-mute">
                          {liberadas
                            ? `Liberadas em ${dateBR(todayISO(liberadas)).slice(0, 5)}${d?.liberadasPor ? ` por ${d.liberadasPor}` : ""}`
                            : semPasta
                              ? "Sem pasta"
                              : "Não liberadas"}
                        </p>
                      </div>
                      {conectado ? (
                        liberadas ? (
                          <RecolherEntregas projectId={p.id} />
                        ) : (
                          <LiberarEntregas projectId={p.id} email={email} compacto />
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 pt-3 pb-5 text-[14px] text-mute sm:px-6">Nenhum projeto deste cliente.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Pasta do cliente" action={<FolderOpen className="size-4 text-mute" aria-hidden />} />
            <div className="flex flex-wrap gap-2 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
              {pastas.cliente ? (
                <a href={pastas.cliente} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", size: "sm", className: "h-10 sm:h-8" })}>
                  <ExternalLink aria-hidden /> Abrir no Drive
                </a>
              ) : null}
              {pastas.empresa ? (
                <a href={pastas.empresa} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 sm:h-8" })}>
                  <ExternalLink aria-hidden /> Arquivos da empresa
                </a>
              ) : null}
              {!pastas.cliente ? <p className="text-[14px] text-mute">A pasta nasce com o primeiro projeto ou envio.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
