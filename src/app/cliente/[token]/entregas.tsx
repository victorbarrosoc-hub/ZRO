import { Download, Eye } from "lucide-react";
import { bytesBR } from "@/lib/drive/bytes";
import { SECOES_ENTREGAS } from "@/lib/drive/estrutura";
import type { EntregaArquivo } from "@/lib/services/drive-entregas";
import type { DadosArea } from "@/lib/services/drive-publico";

/**
 * Arquivos finais de cada projeto do cliente (docs/dev/drive.md §8.3): só o que está em 06 Entregas,
 * só depois de "Liberar entregas", agrupado em Master, Redes, Legendas e Outros. Baixar e Ver levam
 * ao próprio Google (os bytes nunca passam pela ZRO). A lista vem do servidor, pelos ids do banco.
 */

const GRUPOS = [...SECOES_ENTREGAS, "Outros"] as const;
const comparar = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function agrupar(entregas: EntregaArquivo[]) {
  const grupos = new Map<(typeof GRUPOS)[number], EntregaArquivo[]>();
  for (const e of entregas) {
    const g = e.secao ?? "Outros";
    grupos.set(g, [...(grupos.get(g) ?? []), e]);
  }
  return GRUPOS.filter((g) => grupos.has(g)).map((g) => ({
    nome: g,
    itens: grupos.get(g)!.sort((a, b) => comparar.compare(`${a.caminho}/${a.nome}`, `${b.caminho}/${b.nome}`)),
  }));
}

/** "Master/4K" → "4K" (a subpasta dentro da seção). */
function subpasta(e: EntregaArquivo): string | null {
  const partes = e.caminho.split("/").filter(Boolean);
  const resto = e.secao ? partes.slice(1) : partes;
  return resto.length ? resto.join(" / ") : null;
}

const acao =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] transition-colors [&_svg]:size-4";

export function Entregas({ projetos, googleOk }: { projetos: DadosArea["projetos"]; googleOk: boolean }) {
  const algumArquivo = projetos.some((p) => p.entregas.length > 0);
  return (
    <section aria-labelledby="arquivos-finais" className="grid gap-8">
      <div>
        <p className="label mb-4 text-mute">Entregas</p>
        <h2 id="arquivos-finais" className="text-title text-white">
          Arquivos finais
        </h2>
      </div>

      {projetos.length === 0 ? (
        <p className="text-body-lg text-ash">
          {googleOk ? "Nenhum projeto por aqui ainda." : "Os arquivos estão indisponíveis agora. Avise a ZRO."}
        </p>
      ) : (
        <div className="grid gap-6">
          {projetos.map((p) => (
            <article key={p.id} className="rounded-media border border-line bg-white/[0.02] p-5 sm:p-8">
              <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 className="text-h3 break-words text-white">{p.titulo}</h3>
                <p className="label shrink-0 text-mute">{p.mes}</p>
              </header>

              {!googleOk ? (
                <p className="mt-5 text-ui text-ash">Os arquivos estão indisponíveis agora. Avise a ZRO.</p>
              ) : !p.liberado || p.entregas.length === 0 ? (
                <p className="mt-5 text-ui text-ash">Os arquivos finais aparecem aqui quando estiverem prontos.</p>
              ) : (
                <div className="mt-6 grid gap-6">
                  {agrupar(p.entregas).map((g) => (
                    <div key={g.nome}>
                      <p className="label mb-2 text-mute">{g.nome}</p>
                      <ul className="border-t border-line">
                        {g.itens.map((e) => {
                          const sub = subpasta(e);
                          return (
                            <li
                              key={e.id}
                              className="flex flex-col gap-3 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                            >
                              <div className="min-w-0">
                                <p className="text-ui break-words text-light">{e.nome}</p>
                                <p className="mt-0.5 text-caption text-mute">
                                  {[sub, e.tamanho != null ? bytesBR(e.tamanho) : null].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                {e.baixarUrl ? (
                                  <a
                                    href={e.baixarUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className={`${acao} bg-white font-medium text-void hover:bg-light`}
                                    aria-label={`Baixar ${e.nome}`}
                                  >
                                    <Download aria-hidden />
                                    Baixar
                                  </a>
                                ) : null}
                                <a
                                  href={e.verUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className={`${acao} border border-line-strong text-light hover:border-white/40 hover:bg-white/[0.04]`}
                                  aria-label={`Ver ${e.nome}`}
                                >
                                  <Eye aria-hidden />
                                  Ver
                                </a>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {algumArquivo && googleOk ? (
        <p className="text-caption text-mute">Arquivos grandes abrem uma página do Google antes de baixar.</p>
      ) : null}
    </section>
  );
}
