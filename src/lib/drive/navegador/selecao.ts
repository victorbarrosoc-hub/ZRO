/**
 * O que a pessoa escolheu: arquivos com as pastas preservadas.
 * - Escolher pasta: <input type="file" webkitdirectory multiple> (caminho em file.webkitRelativePath).
 * - Arrastar: webkitGetAsEntry() em TODOS os itens antes de qualquer await (o DataTransfer some depois);
 *   diretórios lidos com readEntries() em laço até vir vazio (o Chrome entrega de 100 em 100).
 * - `tirarRaiz` (só o cartão do freela): uma pasta de topo vira `cartaoNome` e sai do caminho.
 * - Arquivos de sistema (.DS_Store, ._*, Thumbs.db…) ficam de fora e aparecem em `ignorados`.
 */
import { ehLixoDoSistema } from "../nomes";
import { ehIOS } from "./plataforma";

export type Selecao = {
  arquivos: { file: File; caminho: string /* pastas, sem o nome */ }[];
  ignorados: string[];
  cartaoNome: string | null;
};

type Bruto = { file: File; partes: string[] /* pastas */ };

function separar(caminhoCompleto: string): string[] {
  return caminhoCompleto.split("/").filter(Boolean);
}

function montar(brutos: Bruto[], tirarRaiz: boolean): Selecao {
  const ignorados: string[] = [];
  const validos: Bruto[] = [];
  for (const b of brutos) {
    const completo = [...b.partes, b.file.name].join("/");
    if (ehLixoDoSistema(completo)) ignorados.push(completo);
    else validos.push(b);
  }
  let cartaoNome: string | null = null;
  if (tirarRaiz) {
    const topos = new Set(validos.filter((b) => b.partes.length > 0).map((b) => b.partes[0]));
    if (topos.size === 1) {
      cartaoNome = [...topos][0];
      for (const b of validos) if (b.partes[0] === cartaoNome) b.partes = b.partes.slice(1);
    }
  }
  return {
    arquivos: validos.map((b) => ({ file: b.file, caminho: b.partes.join("/") })),
    ignorados,
    cartaoNome,
  };
}

/** Do <input type="file"> (com ou sem webkitdirectory). */
export function deInput(files: FileList | File[], o: { tirarRaiz?: boolean } = {}): Selecao {
  const brutos: Bruto[] = Array.from(files).map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const partes = separar(rel);
    return { file, partes: partes.length > 1 ? partes.slice(0, -1) : [] };
  });
  return montar(brutos, Boolean(o.tirarRaiz));
}

type Entrada = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (ok: (f: File) => void, erro?: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (ok: (e: Entrada[]) => void, erro?: (e: unknown) => void) => void };
};

function arquivoDe(e: Entrada): Promise<File> {
  return new Promise((ok, erro) => e.file!(ok, erro));
}

async function lerPasta(e: Entrada): Promise<Entrada[]> {
  const leitor = e.createReader!();
  const todas: Entrada[] = [];
  for (;;) {
    const lote = await new Promise<Entrada[]>((ok, erro) => leitor.readEntries(ok, erro));
    if (!lote.length) break;
    todas.push(...lote);
  }
  return todas;
}

/** Do arrastar e soltar (pastas inteiras no computador). */
export async function deSoltura(dt: DataTransfer, o: { tirarRaiz?: boolean } = {}): Promise<Selecao> {
  // Tudo antes do primeiro await: depois dele o DataTransfer já não tem os itens.
  const entradas: Entrada[] = [];
  const soltos: File[] = [];
  const itens = Array.from(dt.items ?? []);
  for (const item of itens) {
    if (item.kind !== "file") continue;
    const e = (item as DataTransferItem & { webkitGetAsEntry?: () => Entrada | null }).webkitGetAsEntry?.() ?? null;
    if (e) entradas.push(e);
    else {
      const f = item.getAsFile();
      if (f) soltos.push(f);
    }
  }
  if (!itens.length) soltos.push(...Array.from(dt.files ?? []));

  const brutos: Bruto[] = soltos.map((file) => ({ file, partes: [] }));
  const fila = [...entradas];
  while (fila.length) {
    const e = fila.shift()!;
    if (e.isDirectory) fila.push(...(await lerPasta(e)));
    else if (e.isFile) {
      try {
        const file = await arquivoDe(e);
        const partes = separar(e.fullPath || e.name);
        brutos.push({ file, partes: partes.slice(0, -1) });
      } catch {
        // arquivo que sumiu ou sem permissão: fica de fora
      }
    }
  }
  return montar(brutos, Boolean(o.tirarRaiz));
}

/**
 * Impressão do cartão: SHA-256 das linhas "caminho/nome|tamanho" ordenadas (sem lastModified: a Fotos
 * do iPhone muda a data a cada escolha). Mesmo cartão, mesma impressão, mesmo lote.
 */
export async function impressao(s: Selecao): Promise<string> {
  const linhas = s.arquivos.map((a) => `${a.caminho ? `${a.caminho}/` : ""}${a.file.name}|${a.file.size}`).sort();
  const dados = new TextEncoder().encode(linhas.join("\n"));
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** O Safari do iPhone não escolhe pastas. */
export function podeEscolherPasta(): boolean {
  if (typeof document === "undefined" || ehIOS()) return false;
  const input = document.createElement("input");
  return "webkitdirectory" in input;
}
