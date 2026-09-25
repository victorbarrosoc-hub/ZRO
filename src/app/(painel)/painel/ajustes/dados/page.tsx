import type { Metadata } from "next";
import { Database, Download, ShieldCheck } from "lucide-react";
import { InfoList } from "@/components/painel/bits";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { databaseConfig, databaseLabel } from "@/lib/db/config";
import { databaseSummary } from "@/lib/db/summary";
import { dateTimeBR } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import { AjustesTabs } from "../ajustes-tabs";

export const metadata: Metadata = { title: "Dados e backup" };

const ENVIRONMENT: Record<string, string> = {
  production: "Site oficial",
  preview: "Prévia de teste",
  development: "Desenvolvimento",
};

export default async function DadosPage() {
  await requireUser();
  const summary = await databaseSummary(db);
  const { url } = databaseConfig();
  const environment = ENVIRONMENT[process.env.VERCEL_ENV ?? ""] ?? "Computador (local)";

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Ajustes"
        title="Dados e backup"
        description="Qual banco guarda o CRM, os orçamentos e o financeiro, e uma cópia de tudo para guardar."
      />
      <AjustesTabs active="dados" />

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        <div className="grid gap-4 xl:col-span-7">
          <Card>
            <CardHeader
              title="Onde os dados estão"
              description={`A área interna só funciona em ${SITE_URL.replace(/^https?:\/\//, "")}. Prévias da Vercel mandam para lá.`}
              action={<Database className="size-4 text-mute" aria-hidden />}
            />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={[
                  { label: "Você está no", value: environment },
                  { label: "Banco de dados", value: databaseLabel(url) },
                  {
                    label: "Identidade do banco",
                    value: summary.identity ? <span className="font-mono">{summary.identity.id.slice(0, 8)}</span> : "—",
                  },
                  { label: "Criado em", value: summary.firstSetupAt ? dateTimeBR(summary.firstSetupAt) : "—" },
                  {
                    label: "Publicações neste banco",
                    value: summary.identity?.deploys?.length ? (
                      <span className="tabular-nums">
                        {summary.identity.deploys.length} · última <span className="font-mono">{summary.identity.deploys.at(-1)!.slice(0, 7)}</span>
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />
            </div>
            <p className="border-t border-line px-5 py-4 text-[13px] text-mute sm:px-6">
              A identidade não muda de um dia para o outro. Se um dia ela mudar, ou os números de &ldquo;O que tem no
              banco&rdquo; zerarem, o site passou a ler outro banco: os dados não foram apagados. Avise quem cuida do sistema.
            </p>
          </Card>
        </div>

        <div className="grid gap-4 xl:col-span-5">
          <Card>
            <CardHeader title="O que tem no banco" />
            <div className="px-5 pb-2 sm:px-6">
              <InfoList
                items={summary.counts.map((c) => ({
                  label: c.label.charAt(0).toUpperCase() + c.label.slice(1),
                  value: <span className="tabular-nums">{c.value}</span>,
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Backup"
              description="Um arquivo com tudo: leads, clientes, orçamentos, projetos, agenda, freelas e financeiro. Senhas não entram."
              action={<ShieldCheck className="size-4 text-mute" aria-hidden />}
            />
            <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
              <a href="/painel/ajustes/dados/backup" className={buttonClasses({ variant: "primary" })}>
                <Download aria-hidden /> Baixar backup (.json)
              </a>
              <p className="mt-3 text-[13px] text-mute">Vale baixar um por semana e guardar no Google Drive.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
