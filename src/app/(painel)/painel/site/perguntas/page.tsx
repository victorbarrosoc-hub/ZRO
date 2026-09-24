import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { listFaqsAdmin } from "@/lib/queries/admin-content";
import { FaqRowActions, NewFaqButton } from "../content-dialogs";
import { SiteTabs } from "../site-tabs";

export const metadata: Metadata = { title: "Perguntas frequentes" };

export default async function SitePerguntasPage() {
  await requireUser();
  const faqs = await listFaqsAdmin();
  const published = faqs.filter((f) => f.published).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Site"
        title="Perguntas frequentes"
        description={`${published} de ${faqs.length} no site, no fim da página inicial.`}
        actions={<NewFaqButton />}
      />
      <SiteTabs active="perguntas" />

      {faqs.length ? (
        <Card>
          <ol className="divide-y divide-line">
            {faqs.map((f, i) => (
              <li
                key={f.id}
                className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[28px_minmax(0,1fr)_auto] lg:items-center"
              >
                <span className="hidden font-mono text-[12px] text-mute tabular-nums lg:block">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className={f.published ? "text-[15px] font-medium text-white" : "text-[15px] font-medium text-white/50"}>
                    {f.question}
                  </p>
                  <p className="mt-1 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-mute">{f.answer}</p>
                  {!f.published ? (
                    <div className="mt-2">
                      <Badge>Fora do site</Badge>
                    </div>
                  ) : null}
                </div>
                <div className="-ml-1 lg:ml-0">
                  <FaqRowActions
                    faq={{ id: f.id, question: f.question, answer: f.answer, published: f.published }}
                    first={i === 0}
                    last={i === faqs.length - 1}
                  />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Nenhuma pergunta"
            description="Sem perguntas publicadas, a seção some da página inicial."
            action={<NewFaqButton />}
          />
        </Card>
      )}

      <p className="text-[13px] text-mute">A ordem daqui é a ordem do site.</p>
    </div>
  );
}
