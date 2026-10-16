"use client";

import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import type { Foto } from "@/lib/drive/navegador/motor";
import { transporteDaRota } from "@/lib/drive/navegador/transporte";
import { useMotor } from "@/lib/drive/navegador/use-motor";
import type { DiagnosticoRegistro, ResultadoDiagnostico } from "@/lib/drive/protocolo";

/**
 * Teste de envio direto neste aparelho (docs/dev/drive.md §9): o próprio motor manda 512 KiB em dois
 * pedaços de 256 KiB para a pasta raiz, pela mesma rota de qualquer envio. O servidor confere, manda o
 * arquivo para a lixeira e guarda o resultado. A sessão nunca aparece: só o endereço (host).
 */

const ROTA = "/painel/arquivos/api";
const FINAIS = new Set(["concluido", "parcial", "cancelado", "erro"]);
const HOST_GOOGLE = "www.googleapis.com";

const diaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit" });

function Linha({ rotulo, ok, texto, nota }: { rotulo: string; ok: boolean | null; texto?: string; nota?: string }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[14px] text-light">{rotulo}</p>
        {nota ? <p className="mt-0.5 text-[13px] text-mute">{nota}</p> : null}
      </div>
      {ok === null ? (
        <span className="font-mono text-[13px] text-ash">{texto}</span>
      ) : (
        <Badge tone={ok ? "ok" : "danger"}>{texto ?? (ok ? "ok" : "falhou")}</Badge>
      )}
    </li>
  );
}

function Resultado({ r }: { r: ResultadoDiagnostico & { conferido?: boolean } }) {
  const direto = r.preflight && r.viu308;
  const hostGoogle = r.host === HOST_GOOGLE;
  return (
    <div className="grid gap-3">
      <ul>
        <Linha rotulo="Permissão do navegador (preflight)" ok={r.preflight} />
        <Linha rotulo="Resposta 308 legível" ok={r.viu308} />
        <Linha
          rotulo="Range legível"
          ok={r.rangeLegivel}
          nota={r.rangeLegivel ? undefined : "O envio funciona igual: o ponto vem do servidor a cada pedaço."}
        />
        <Linha
          rotulo="Resposta final legível"
          ok={r.finalLegivel ? true : null}
          texto={r.finalLegivel ? "ok" : "não (só informativo)"}
        />
        <Linha
          rotulo="Endereço da sessão"
          ok={null}
          texto={r.host || "—"}
          nota={r.host && !hostGoogle ? "Diferente do Google padrão: acrescentar ao connect-src de /enviar e /cliente." : undefined}
        />
      </ul>
      <p className={direto ? "text-[14px] text-ok" : "text-[14px] text-danger"} role="status">
        {direto
          ? r.conferido === false
            ? "O navegador falou com o Google, mas o arquivo não foi conferido. Rode o teste de novo."
            : "Envio direto funciona neste navegador."
          : "Este navegador não conseguiu enviar direto ao Google. Mande este resultado para o Claude."}
      </p>
    </div>
  );
}

export function TesteDeEnvio({ raizId, ultimos }: { raizId: string | null; ultimos: DiagnosticoRegistro[] }) {
  const router = useRouter();
  const [transporte] = useState(() => transporteDaRota(ROTA));
  const { motor } = useMotor({ transporte, escopo: "diagnostico", voz: "painel", diagnostico: true, pedacoMiB: 0.25, paralelos: 1 });
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<(ResultadoDiagnostico & { conferido?: boolean }) | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function testar() {
    if (!raizId || rodando) return;
    setRodando(true);
    setResultado(null);
    setErro(null);
    try {
      const dados = new Uint8Array(512 * 1024);
      for (let i = 0; i < dados.length; i += 65_536) crypto.getRandomValues(dados.subarray(i, i + 65_536));
      const file = new File([dados], "zro-teste-envio.bin", { type: "application/octet-stream" });
      motor.limparConcluidos();
      const chave = motor.adicionar({ arquivos: [{ file, caminho: "" }], ignorados: [], cartaoNome: null }, { tipo: "pasta", pastaId: raizId });
      const fim = await new Promise<Foto>((ok) => {
        const ver = () => {
          const f = motor.foto();
          const l = f.lotes.find((x) => x.chave === chave);
          if (l && FINAIS.has(l.estado) && !f.ativo) {
            parar();
            ok(f);
          }
        };
        const parar = motor.assinar(ver);
        ver();
      });
      const lote = fim.lotes.find((x) => x.chave === chave);
      const item = fim.itens.find((i) => i.lote === chave);
      if (!fim.diagnostico || !item?.envioId) {
        setErro(lote?.erro ?? item?.erro ?? (fim.precisaEntrar ? "Sua sessão expirou. Entre de novo para continuar." : "O teste não chegou ao Google."));
        if (fim.diagnostico) setResultado(fim.diagnostico);
        return;
      }
      const r = await transporte.diagnostico!({ op: "diagnostico", envioId: item.envioId, resultado: fim.diagnostico });
      if (r.ok) {
        setResultado(r.registro);
        router.refresh();
      } else {
        setResultado(fim.diagnostico);
        setErro(r.mensagem);
      }
    } catch {
      setErro("O teste não terminou. Confira a internet e tente de novo.");
    } finally {
      setRodando(false);
    }
  }

  const recentes = [...ultimos].reverse();
  return (
    <div className="grid gap-5 px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={testar} disabled={!raizId || rodando}>
          <Activity aria-hidden /> {rodando ? "Testando…" : "Testar neste aparelho"}
        </Button>
        {!raizId ? <p className="text-[13px] text-mute">Conecte o Google Drive para testar.</p> : null}
      </div>
      {resultado ? <Resultado r={resultado} /> : null}
      {erro ? (
        <p className="text-[14px] text-danger" role="alert">
          {erro}
        </p>
      ) : null}
      {recentes.length ? (
        <div>
          <p className="label mb-2 text-mute">Últimos testes</p>
          <ul className="grid gap-1.5">
            {recentes.map((d) => (
              <li key={d.em} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-ash">
                  {d.navegador} · {diaMes.format(new Date(d.em))}
                </span>
                <Badge tone={d.ok && d.conferido ? "ok" : d.ok ? "warn" : "danger"}>{d.ok && d.conferido ? "ok" : d.ok ? "sem conferir" : "falhou"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
