/**
 * Registro de retomada no aparelho: só os lotes abertos ({ loteId, rotulo, impressao, contagens }),
 * por 30 dias. NUNCA a URI da sessão (é credencial) e nunca o arquivo: para continuar, a pessoa escolhe
 * o mesmo cartão e o servidor devolve o mesmo lote e o ponto de cada arquivo.
 * Toda leitura e escrita em try/catch (aba anônima, armazenamento bloqueado).
 */

export type LoteSalvo = {
  loteId: string;
  rotulo: string;
  impressao: string;
  arquivos: number;
  bytes: number;
  enviados: number;
  criadoEm: number;
};

const PREFIXO = "zro.drive.v1.";
const VALIDADE_MS = 30 * 24 * 60 * 60_000;

function chave(escopo: string) {
  return `${PREFIXO}${escopo}`;
}

export function lerSalvos(escopo: string): LoteSalvo[] {
  try {
    const bruto = localStorage.getItem(chave(escopo));
    if (!bruto) return [];
    const lista = JSON.parse(bruto) as LoteSalvo[];
    if (!Array.isArray(lista)) return [];
    const agora = Date.now();
    return lista.filter(
      (l) => l && typeof l.loteId === "string" && typeof l.impressao === "string" && agora - Number(l.criadoEm) < VALIDADE_MS,
    );
  } catch {
    return [];
  }
}

function gravar(escopo: string, lista: LoteSalvo[]) {
  try {
    if (lista.length) localStorage.setItem(chave(escopo), JSON.stringify(lista.slice(-20)));
    else localStorage.removeItem(chave(escopo));
  } catch {
    // sem armazenamento: a retomada depende só do servidor (mesmo cartão, mesma impressão)
  }
}

/** Guarda (ou atualiza) estes lotes. */
export function salvarLotes(escopo: string, lotes: LoteSalvo[]): void {
  if (!lotes.length) return;
  const porId = new Map(lerSalvos(escopo).map((l) => [l.loteId, l]));
  for (const l of lotes) porId.set(l.loteId, { ...porId.get(l.loteId), ...l });
  gravar(escopo, [...porId.values()]);
}

export function esquecerLote(escopo: string, loteId: string): void {
  const lista = lerSalvos(escopo);
  const resto = lista.filter((l) => l.loteId !== loteId);
  if (resto.length !== lista.length) gravar(escopo, resto);
}

/** O aparelho já mostrou o cabeçalho Range alguma vez? (então a ausência dele é real) */
const RANGE_VISTO = "zro.drive.rangeVisivel";

export function rangeJaVisto(): boolean {
  try {
    return localStorage.getItem(RANGE_VISTO) === "1";
  } catch {
    return false;
  }
}

export function marcarRangeVisto(): void {
  try {
    localStorage.setItem(RANGE_VISTO, "1");
  } catch {
    // sem armazenamento: vale só nesta página
  }
}
