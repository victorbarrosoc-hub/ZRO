import { bytesBR } from "@/lib/drive/bytes";
import { SECOES_ENTREGAS } from "@/lib/drive/estrutura";
import type { EntregaArquivo } from "@/lib/services/drive-entregas";
import { urlPublicaDeMidia } from "@/lib/services/drive-previa";
import type { DadosArea } from "@/lib/services/drive-publico";
import { GradeEntregas, type EntregaGrade } from "./entregas-grade";

/**
 * Arquivos finais de cada projeto do cliente (docs/dev/drive.md §8.3 e §16): só o que está em 06 Entregas,
 * só depois de "Liberar entregas", em miniaturas agrupadas em Master, Redes, Legendas e Outros. O cliente
 * assiste antes de baixar (player da ZRO, direto do Google pelo link público) e o Baixar leva ao próprio
 * Google: os bytes nunca passam pela ZRO. A lista vem do servidor, pelos ids do banco.
 */

const GRUPOS = [...SECOES_ENTREGAS, "Outros"] as const;
const comparar = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** "Master/4K" → "4K" (a subpasta dentro da seção). */
function subpasta(e: EntregaArquivo): string | null {
  const partes = e.caminho.split("/").filter(Boolean);
  const resto = e.secao ? partes.slice(1) : partes;
  return resto.length ? resto.join(" / ") : null;
}

function agrupar(entregas: EntregaArquivo[]): { nome: string; itens: EntregaGrade[] }[] {
  const grupos = new Map<(typeof GRUPOS)[number], EntregaArquivo[]>();
  for (const e of entregas) {
    const g = e.secao ?? "Outros";
    grupos.set(g, [...(grupos.get(g) ?? []), e]);
  }
  return GRUPOS.filter((g) => grupos.has(g)).map((g) => ({
    nome: g,
    itens: grupos
      .get(g)!
      .sort((a, b) => comparar.compare(`${a.caminho}/${a.nome}`, `${b.caminho}/${b.nome}`))
      .map((e) => ({
        id: e.id,
        nome: e.nome,
        tipo: e.tipo,
        tamanho: e.tamanho,
        modificadoEm: e.modificadoEm,
        midia: e.midia,
        verUrl: e.verUrl,
        baixarUrl: e.baixarUrl,
        sub: subpasta(e),
        assistir: urlPublicaDeMidia(e),
      })),
  }));
}

export function Entregas({ projetos, googleOk, token }: { projetos: DadosArea["projetos"]; googleOk: boolean; token: string }) {
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
          {projetos.map((p) => {
            const total = p.entregas.reduce((s, e) => s + (e.tamanho ?? 0), 0);
            return (
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
                  <>
                    <p className="mt-2 text-caption text-mute">
                      {p.entregas.length} {p.entregas.length === 1 ? "arquivo" : "arquivos"} · {bytesBR(total)}
                    </p>
                    <GradeEntregas token={token} grupos={agrupar(p.entregas)} />
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {algumArquivo && googleOk ? (
        <p className="text-caption text-mute">Toque para assistir. Arquivos grandes abrem uma página do Google antes de baixar.</p>
      ) : null}
    </section>
  );
}
