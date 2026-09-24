import type { Metadata } from "next";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { countDemoData } from "@/lib/queries/admin-content";
import { getSetting } from "@/lib/settings";
import { AjustesTabs } from "./ajustes-tabs";
import { CompanyForm, DeleteDemoButton, QuoteDefaultsForm, TaxesForm, WhatsappForm } from "./settings-forms";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  await requireUser();
  const [company, whatsapp, taxes, quote, demo] = await Promise.all([
    getSetting("company"),
    getSetting("whatsapp"),
    getSetting("taxes"),
    getSetting("quote"),
    countDemoData(),
  ]);
  const noWhatsapp = !whatsapp.number;

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Ajustes"
        title="Empresa e site"
        description="Dados da empresa, WhatsApp comercial, impostos e padrões dos orçamentos."
      />
      <AjustesTabs active="geral" />

      {noWhatsapp ? (
        <Card className="flex flex-col gap-4 border-warn/40 bg-[linear-gradient(180deg,rgb(217_164_65/0.10),rgb(217_164_65/0.03))] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="text-[15px] font-medium text-white">O site ainda não tem WhatsApp comercial.</p>
              <p className="mt-1 max-w-2xl text-[14px] text-ash">
                Quem pede orçamento pelo site termina a conversa sem o botão do WhatsApp: só aparece a opção de e-mail.
              </p>
            </div>
          </div>
          <a
            href="#whatsapp"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-void transition-colors hover:bg-light"
          >
            Cadastrar número
          </a>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        <div className="grid gap-4 xl:col-span-7">
          <Card id="whatsapp" className={noWhatsapp ? "scroll-mt-24 border-warn/40" : "scroll-mt-24"}>
            <CardHeader
              title="WhatsApp comercial"
              description="Para onde o funil do site manda os pedidos de orçamento, com a mensagem pronta. Também aparece no rodapé."
              action={<MessageCircle className="size-4 text-mute" aria-hidden />}
            />
            <WhatsappForm number={whatsapp.number} />
          </Card>

          <Card>
            <CardHeader title="Empresa" description="Rodapé do site, página de privacidade e propostas." />
            <CompanyForm company={company} />
          </Card>
        </div>

        <div className="grid gap-4 xl:col-span-5">
          <Card>
            <CardHeader title="Impostos" description="Confirme com o contador." />
            <TaxesForm rate={taxes.rate} />
          </Card>

          <Card>
            <CardHeader title="Orçamentos" description="O que todo orçamento novo já traz preenchido." />
            <QuoteDefaultsForm quote={quote} />
          </Card>

          {demo.total > 0 ? (
            <Card className="border-danger/25">
              <CardHeader
                title="Dados de exemplo"
                description="Projetos, leads, clientes, freelas, orçamentos e lançamentos fictícios, para a área interna não abrir vazia."
              />
              <div className="grid gap-4 p-5 sm:p-6">
                <p className="text-[14px] text-ash">
                  Quando começarem a usar de verdade, apaguem tudo de uma vez. Filmes, equipe, perguntas, modelos, kits,
                  catálogo e estes ajustes não são tocados.
                </p>
                <ul className="flex flex-wrap gap-1.5 text-[12px] text-mute">
                  {demo.tables.map((t) => (
                    <li key={t.label} className="rounded-full border border-line px-2.5 py-1">
                      <span className="text-light tabular-nums">{t.count}</span> {t.label}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line pt-4">
                  <DeleteDemoButton total={demo.total} />
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
