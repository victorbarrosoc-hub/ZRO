import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { CATEGORIES, categoryLabel } from "@/lib/domain";
import { countProcessos, listTemplates } from "@/lib/queries/admin-content";
import { cn } from "@/lib/utils";
import { ProcessosTabs } from "./processos-tabs";

export const metadata: Metadata = { title: "Modelos de projeto" };

export default async function ProcessosPage() {
  await requireUser();
  const [templates, counts] = await Promise.all([listTemplates(), countProcessos()]);

  // O projeto novo usa o modelo mais antigo da categoria (lista já vem por data de criação).
  const inUse = new Map<string, string>();
  for (const t of templates) if (t.category && !inUse.has(t.category)) inUse.set(t.category, t.id);
  const uncovered = CATEGORIES.filter((c) => !inUse.has(c.key));

  return (
    <div className="grid gap-8">
      <PageHeader
        label="Processos"
        title="Modelos de projeto"
        actions={
          <ButtonLink href="/painel/processos/novo" variant="primary">
            <Plus /> Novo modelo
          </ButtonLink>
        }
      />
      <ProcessosTabs active="modelos" counts={counts} />

      {templates.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {templates.map((t) => {
            const spare = t.category ? inUse.get(t.category) !== t.id : false;
            return (
              <li key={t.id}>
                <Link href={`/painel/processos/${t.id}`} className="group block h-full">
                  <Card className="flex h-full flex-col gap-5 p-5 transition-colors duration-300 group-hover:border-white/20 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[17px] font-medium tracking-[-0.01em] text-white">{t.name}</p>
                        {t.description ? <p className="mt-1 text-[13px] text-mute">{t.description}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {t.category ? <Badge>{categoryLabel(t.category)}</Badge> : <Badge>Sem categoria</Badge>}
                        {spare ? <Badge tone="warn">Categoria repetida</Badge> : null}
                      </div>
                    </div>
                    <ol className="grid grid-cols-7 gap-1.5" aria-label="Tarefas por etapa">
                      {t.perStage.map((s) => (
                        <li
                          key={s.key}
                          className={cn(
                            "grid justify-items-center gap-1 rounded-xl px-1 py-2.5 text-center",
                            s.count ? "bg-white/[0.05]" : "bg-white/[0.015]",
                          )}
                        >
                          <span className={cn("text-[17px] leading-none font-semibold", s.count ? "text-white" : "text-white/25")}>
                            {s.count}
                          </span>
                          <span className="font-mono text-[10px] text-mute">{s.n}</span>
                          <span className="hidden max-w-full truncate text-[10px] text-mute sm:block">{s.label}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-4 text-[13px]">
                      <span className="text-mute">
                        {t.total} tarefa{t.total === 1 ? "" : "s"}
                        {spare ? " · não entra sozinho" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 text-ash transition-colors group-hover:text-white">
                        Editar <ArrowUpRight className="size-3.5" />
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="Nenhum modelo ainda"
            action={
              <ButtonLink href="/painel/processos/novo" variant="primary">
                <Plus /> Novo modelo
              </ButtonLink>
            }
          />
        </Card>
      )}

      {uncovered.length ? (
        <Card className="p-5 sm:p-6">
          <p className="text-[14px] text-light">Categorias sem modelo</p>
          <p className="mt-1 text-[13px] text-mute">Projetos destas categorias começam sem tarefas. Crie um modelo ou duplique um parecido.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {uncovered.map((c) => (
              <Link
                key={c.key}
                href={`/painel/processos/novo?categoria=${c.key}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/20 px-3.5 text-[13px] text-ash transition-colors hover:border-white/50 hover:text-white"
              >
                <Plus className="size-3.5" /> {c.short}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
