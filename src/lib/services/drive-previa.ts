import "server-only";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ehPastaDeProxy, escolherProxy, EXT_PROXY, extensao, tamanhoMiniatura } from "@/lib/drive/midia";
import { escaparConsulta, idDriveValido } from "@/lib/drive/nomes";
import { chaveApiGoogle, endpoints } from "@/lib/google/config";
import { acessoCurto, contaAtual, driveConectado } from "@/lib/google/conexao";
import { baixarMiniatura, buscarItens, itemComMidia, linkDaMiniatura, type ItemDrive } from "@/lib/google/drive";
import { entregasDoProjeto, type EntregaArquivo } from "./drive-entregas";
import type { LinkLinha } from "./drive-links";

/**
 * Prévia dos arquivos do Drive (docs/dev/drive.md §16): miniaturas pelo servidor (o thumbnailLink do Google
 * pede sessão), o token curto do service worker do painel, o proxy de câmera e o que a área do cliente pode ver.
 * Os bytes de vídeo nunca passam por aqui: o painel lê direto do Google pelo service worker; o cliente, pela
 * chave de API (link público de 06 Entregas) ou pela prévia do próprio Google.
 */

const PASTA = "application/vnd.google-apps.folder";

/* ------------------------------ miniaturas ------------------------------ */

type Miniatura = { bytes: Uint8Array; tipo: string };
const TTL_MINIATURA = 5 * 60_000;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const cacheMiniaturas = new Map<string, { em: number; m: Miniatura | null }>();
let bytesNoCache = 0;

function guardar(chave: string, m: Miniatura | null) {
  const antes = cacheMiniaturas.get(chave);
  if (antes?.m) bytesNoCache -= antes.m.bytes.length;
  cacheMiniaturas.delete(chave);
  cacheMiniaturas.set(chave, { em: Date.now(), m });
  if (m) bytesNoCache += m.bytes.length;
  // Sai o mais antigo até caber (Map guarda a ordem de entrada).
  while ((bytesNoCache > MAX_CACHE_BYTES || cacheMiniaturas.size > 2000) && cacheMiniaturas.size) {
    const [k, v] = cacheMiniaturas.entries().next().value!;
    if (v.m) bytesNoCache -= v.m.bytes.length;
    cacheMiniaturas.delete(k);
  }
}

/** Esvazia o cache (testes; troca de conta). */
export function esquecerMiniaturas(): void {
  cacheMiniaturas.clear();
  bytesNoCache = 0;
}

/**
 * Miniatura de um arquivo que a conta conectada enxerga, no tamanho pedido (arredondado para os tamanhos
 * da ZRO). Cache em memória de 5 min por arquivo e tamanho (também o "não tem"). null = sem miniatura.
 * Quem chama confere ANTES quem pode ver (login no painel; link, liberação e 06 Entregas no cliente).
 */
export async function miniatura(id: string, px: number): Promise<Miniatura | null> {
  if (!idDriveValido(id) || id === "root") return null;
  if (!(await driveConectado())) return null;
  const tamanho = tamanhoMiniatura(px);
  const chave = `${id}:${tamanho}`;
  const guardado = cacheMiniaturas.get(chave);
  if (guardado && Date.now() - guardado.em < TTL_MINIATURA) return guardado.m;
  const link = await linkDaMiniatura(id);
  const m = link ? await baixarMiniatura(link, tamanho) : null;
  guardar(chave, m);
  return m;
}

/* ------------------------------ token do stream (painel) ------------------------------ */

/** Token de acesso curto e a base da API (o service worker confere a base). Nunca o refresh token. */
export async function acessoParaStream(): Promise<{ token: string; expiraEm: number; api: string }> {
  const { token, expiraEm } = await acessoCurto();
  return { token, expiraEm, api: endpoints().drive };
}

/* ------------------------------ proxy de câmera (painel) ------------------------------ */

export type ProxyDTO = Pick<ItemDrive, "id" | "nome" | "tipo" | "tamanho" | "modificadoEm" | "verUrl" | "baixarUrl" | "midia">;

const cacheProxy = new Map<string, { em: number; p: ProxyDTO | null }>();

/**
 * Proxy de um bruto de câmera (BRAW, R3D, ARRI, MXF, ProRes): .mp4/.mov/.m4v com o mesmo nome-base na mesma
 * pasta ou numa subpasta "Proxy"/"Proxies" dela. Busca por nome exato (nada de listar a pasta inteira de um
 * cartão). Cache de 5 min por arquivo.
 */
export async function acharProxy(id: string): Promise<ProxyDTO | null> {
  if (!idDriveValido(id) || id === "root") return null;
  const guardado = cacheProxy.get(id);
  if (guardado && Date.now() - guardado.em < TTL_MINIATURA) return guardado.p;

  const orig = await itemComMidia(id);
  let achado: ProxyDTO | null = null;
  const pai = orig?.pais[0];
  if (orig && !orig.pasta && !orig.lixeira && pai && idDriveValido(pai)) {
    const subpastas = await buscarItens(
      `'${escaparConsulta(pai)}' in parents and mimeType = '${PASTA}' and trashed = false and (name = 'Proxy' or name = 'Proxies' or name = 'proxy' or name = 'proxies' or name = 'PROXY' or name = 'PROXIES')`,
    );
    const ondes = [pai, ...subpastas.filter((p) => p.pasta && ehPastaDeProxy(p.nome)).map((p) => p.id)].filter(idDriveValido).slice(0, 6);
    const ext = extensao(orig.nome);
    const base = ext ? orig.nome.slice(0, -(ext.length + 1)) : orig.nome;
    const nomes = EXT_PROXY.flatMap((e) => [`${base}.${e}`, `${base}.${e.toUpperCase()}`]);
    const candidatos = await buscarItens(
      `(${ondes.map((o) => `'${escaparConsulta(o)}' in parents`).join(" or ")}) and trashed = false and (${nomes
        .map((n) => `name = '${escaparConsulta(n)}'`)
        .join(" or ")})`,
    );
    const p = escolherProxy(candidatos, orig);
    if (p) {
      achado = { id: p.id, nome: p.nome, tipo: p.tipo, tamanho: p.tamanho, modificadoEm: p.modificadoEm, verUrl: p.verUrl, baixarUrl: p.baixarUrl, midia: p.midia };
    }
  }
  cacheProxy.set(id, { em: Date.now(), p: achado });
  if (cacheProxy.size > 500) cacheProxy.delete(cacheProxy.keys().next().value!);
  return achado;
}

export function esquecerProxies(): void {
  cacheProxy.clear();
}

/* ------------------------------ área do cliente ------------------------------ */

/**
 * O arquivo está em 06 Entregas de um projeto DESTE cliente, com as entregas liberadas, na conta atual?
 * (a mesma regra de abrirLinkPublico: projeto do cliente do link, não cancelado, drive_projetos na conta
 * atual, entregasLiberadasEm preenchido; a lista vem dos ids do banco). Quem chama já conferiu o link
 * (ativo, senha, prévia). null = recusa.
 */
export async function entregaDaArea(link: Pick<LinkLinha, "clientId" | "tipo">, arquivoId: string): Promise<EntregaArquivo | null> {
  if (link.tipo !== "cliente-area" || !link.clientId || !idDriveValido(arquivoId) || arquivoId === "root") return null;
  const conta = await contaAtual();
  if (!conta) return null;
  const { projects, driveProjetos } = schema;
  const liberados = await db
    .select({ driveProjetoId: driveProjetos.id })
    .from(projects)
    .innerJoin(driveProjetos, and(eq(driveProjetos.projectId, projects.id), eq(driveProjetos.conta, conta.conta)))
    .where(and(eq(projects.clientId, link.clientId), ne(projects.status, "cancelado"), isNotNull(driveProjetos.entregasLiberadasEm)));
  for (const p of liberados) {
    const e = (await entregasDoProjeto(p.driveProjetoId)).find((x) => x.id === arquivoId);
    if (e) return e;
  }
  return null;
}

/**
 * Endereço do arquivo para o player do cliente, direto do Google com a chave de API (GOOGLE_API_KEY, restrita à
 * Drive API e ao endereço do site): só funciona porque 06 Entregas está com "qualquer pessoa com o link" depois de
 * "Liberar entregas" (e para de funcionar ao "Recolher"). Sem chave, ou com resourceKey: null (a página usa a
 * prévia do próprio Google). Nenhum token da conta da ZRO vai para o navegador.
 */
export function urlPublicaDeMidia(e: Pick<EntregaArquivo, "id" | "chaveRecurso">): string | null {
  const chave = chaveApiGoogle();
  if (!chave || e.chaveRecurso || !idDriveValido(e.id)) return null;
  return `${endpoints().drive}/files/${encodeURIComponent(e.id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(chave)}`;
}
