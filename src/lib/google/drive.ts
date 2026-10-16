import "server-only";
import { infoDeMidia, linkComTamanho, type InfoMidia } from "@/lib/drive/midia";
import { escaparConsulta, idDriveValido } from "@/lib/drive/nomes";
import { lerRange } from "@/lib/drive/protocolo";
import { endpoints, miniaturaPermitida, sessaoPermitida } from "./config";
import { esquecerToken, tokenDeAcesso } from "./conexao";
import { deResposta, GoogleError, razaoDoErro } from "./erros";

/**
 * Cliente do Google Drive v3 (fetch, sem SDK). Recebe e devolve DTOs; nunca loga corpo, token ou URI.
 * Ids vindos de fora passam por idDriveValido e vão com encodeURIComponent.
 */

const PASTA = "application/vnd.google-apps.folder";
const CAMPOS_ARQUIVO =
  "id,name,mimeType,size,md5Checksum,parents,trashed,webViewLink,webContentLink,capabilities(canAddChildren)";

export type ArquivoDrive = {
  id: string;
  nome: string;
  tipo: string;
  pasta: boolean;
  tamanho: number | null;
  md5: string | null;
  pais: string[];
  lixeira: boolean;
  verUrl: string;
  baixarUrl: string | null;
  podeAdicionar: boolean;
};

/** Item de uma listagem. baixarUrl = webContentLink (null em pasta e em Google Docs). */
export type ItemDrive = {
  id: string;
  nome: string;
  pasta: boolean;
  tipo: string;
  tamanho: number | null;
  modificadoEm: string | null;
  verUrl: string;
  baixarUrl: string | null;
  /** Miniatura, duração e resolução (a miniatura em si vem por uma rota do servidor: o link do Google pede sessão). */
  midia: InfoMidia;
  /** O arquivo tem resourceKey (link antigo do Google): a leitura pública pede um cabeçalho a mais. */
  chaveRecurso: boolean;
};

const CAMPOS_MIDIA = "hasThumbnail,thumbnailLink,videoMediaMetadata(width,height,durationMillis),imageMediaMetadata(width,height),resourceKey";

type ArquivoJson = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  md5Checksum?: string;
  parents?: string[];
  trashed?: boolean;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
  driveId?: string;
  capabilities?: { canAddChildren?: boolean };
  hasThumbnail?: boolean;
  thumbnailLink?: string;
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
  imageMediaMetadata?: { width?: number; height?: number };
  resourceKey?: string;
};

export function linkPasta(id: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
}

export function linkArquivo(id: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
}

function paraArquivo(j: ArquivoJson): ArquivoDrive {
  const pasta = j.mimeType === PASTA;
  return {
    id: j.id,
    nome: j.name ?? "",
    tipo: j.mimeType ?? "",
    pasta,
    tamanho: j.size != null ? Number(j.size) : null,
    md5: j.md5Checksum ?? null,
    pais: j.parents ?? [],
    lixeira: Boolean(j.trashed),
    verUrl: j.webViewLink ?? (pasta ? linkPasta(j.id) : linkArquivo(j.id)),
    baixarUrl: pasta ? null : (j.webContentLink ?? null),
    podeAdicionar: Boolean(j.capabilities?.canAddChildren),
  };
}

function paraItem(j: ArquivoJson): ItemDrive {
  const pasta = j.mimeType === PASTA;
  return {
    id: j.id,
    nome: j.name ?? "",
    pasta,
    tipo: j.mimeType ?? "",
    tamanho: j.size != null ? Number(j.size) : null,
    modificadoEm: j.modifiedTime ?? null,
    verUrl: j.webViewLink ?? (pasta ? linkPasta(j.id) : linkArquivo(j.id)),
    baixarUrl: pasta ? null : (j.webContentLink ?? null),
    midia: infoDeMidia(j),
    chaveRecurso: Boolean(j.resourceKey),
  };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Recuo exponencial com jitter (curto: as funções da Vercel têm prazo). */
const recuo = (tentativa: number) => espera(Math.min(8000, 400 * 2 ** (tentativa - 1)) + Math.random() * 400);

type Opcoes = {
  method?: string;
  base?: "drive" | "upload";
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  headers?: Record<string, string>;
  /** Token já em mãos (callback do OAuth, antes de salvar a conexão). */
  token?: string;
  /** Status que não são erro para quem chamou (ex.: 404 em "achou ou não"). */
  aceitar?: number[];
};

/**
 * Uma chamada ao Drive com o Bearer do servidor. 401: esquece o token e tenta uma vez de novo.
 * 5xx, 429, 403 de taxa e queda de rede: até 3 tentativas com recuo. Log só com motivo e status.
 */
export async function driveFetch(caminho: string, o: Opcoes = {}): Promise<Response> {
  const url = new URL(endpoints()[o.base ?? "drive"] + caminho);
  if (caminho.startsWith("/files")) url.searchParams.set("supportsAllDrives", "true");
  for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  let renovou = false;
  for (let tentativa = 1; ; tentativa++) {
    const token = o.token ?? (await tokenDeAcesso());
    let res: Response;
    try {
      res = await fetch(url, {
        method: o.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(o.json !== undefined ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
          ...o.headers,
        },
        body: o.json !== undefined ? JSON.stringify(o.json) : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (tentativa < 3) {
        await recuo(tentativa);
        continue;
      }
      console.error("[drive]", "rede", 0);
      throw new GoogleError("rede", 0, "drive");
    }
    if (res.ok || o.aceitar?.includes(res.status)) return res;
    const corpo = await res.json().catch(() => null);
    const erro = deResposta(res.status, corpo);
    if (erro.motivo === "auth" && !renovou && !o.token) {
      esquecerToken();
      renovou = true;
      tentativa--;
      continue;
    }
    if (erro.motivo === "taxa" && tentativa < 3) {
      await recuo(tentativa);
      continue;
    }
    if (erro.motivo === "taxa" && razaoDoErro(corpo) === "userRateLimitExceeded") {
      console.error("[drive]", "limite_diario", res.status);
      throw new GoogleError("limite_diario", res.status, "userRateLimitExceeded");
    }
    console.error("[drive]", erro.motivo, res.status);
    throw erro;
  }
}

/** Conta conectada e espaço. `token`: usado no callback, antes de a conexão existir. */
export async function sobre(token?: string): Promise<{ email: string; nome: string | null; usado: number; limite: number | null }> {
  const res = await driveFetch("/about", { query: { fields: "user(emailAddress,displayName),storageQuota(limit,usage)" }, token });
  const j = (await res.json()) as {
    user?: { emailAddress?: string; displayName?: string };
    storageQuota?: { limit?: string; usage?: string };
  };
  return {
    email: (j.user?.emailAddress ?? "").toLowerCase(),
    nome: j.user?.displayName ?? null,
    usado: Number(j.storageQuota?.usage ?? 0),
    limite: j.storageQuota?.limit != null ? Number(j.storageQuota.limit) : null,
  };
}

/** Metadados de um arquivo ou pasta. */
export async function arquivo(id: string, campos = CAMPOS_ARQUIVO): Promise<ArquivoDrive> {
  if (!idDriveValido(id)) throw new GoogleError("nao_encontrado", 400, "id inválido");
  const res = await driveFetch(`/files/${encodeURIComponent(id)}`, { query: { fields: campos } });
  return paraArquivo((await res.json()) as ArquivoJson);
}

/** Igual a `arquivo`, mas 404 vira null. */
export async function arquivoOuNull(id: string, campos = CAMPOS_ARQUIVO): Promise<ArquivoDrive | null> {
  if (!idDriveValido(id)) return null;
  const res = await driveFetch(`/files/${encodeURIComponent(id)}`, { query: { fields: campos }, aceitar: [404] });
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  return paraArquivo((await res.json()) as ArquivoJson);
}

/** Itens de uma pasta (pastas primeiro, nome natural), 200 por página. */
export async function listarPasta(pastaId: string, pagina?: string | null): Promise<{ itens: ItemDrive[]; proxima: string | null }> {
  if (!idDriveValido(pastaId)) throw new GoogleError("nao_encontrado", 400, "id inválido");
  const res = await driveFetch("/files", {
    query: {
      q: `'${escaparConsulta(pastaId)}' in parents and trashed = false`,
      orderBy: "folder,name_natural",
      pageSize: 200,
      includeItemsFromAllDrives: true,
      pageToken: pagina || undefined,
      fields: `nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,${CAMPOS_MIDIA})`,
    },
  });
  const j = (await res.json()) as { nextPageToken?: string; files?: ArquivoJson[] };
  return { itens: (j.files ?? []).map(paraItem), proxima: j.nextPageToken ?? null };
}

/** Busca livre (q já montado e escapado por quem chama), até 50 itens, com os dados de mídia. */
export async function buscarItens(q: string): Promise<ItemDrive[]> {
  const res = await driveFetch("/files", {
    query: {
      q,
      pageSize: 50,
      includeItemsFromAllDrives: true,
      fields: `files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,${CAMPOS_MIDIA})`,
    },
  });
  const j = (await res.json()) as { files?: ArquivoJson[] };
  return (j.files ?? []).map(paraItem);
}

/** Um item com os dados de mídia e o pai (prévia e proxy). 404 → null. */
export async function itemComMidia(id: string): Promise<(ItemDrive & { pais: string[]; lixeira: boolean }) | null> {
  if (!idDriveValido(id)) return null;
  const res = await driveFetch(`/files/${encodeURIComponent(id)}`, {
    query: { fields: `id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,parents,trashed,${CAMPOS_MIDIA}` },
    aceitar: [404],
  });
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  const j = (await res.json()) as ArquivoJson;
  return { ...paraItem(j), pais: j.parents ?? [], lixeira: Boolean(j.trashed) };
}

/** O thumbnailLink atual de um arquivo que a conta conectada enxerga (o link do Google dura horas). */
export async function linkDaMiniatura(id: string): Promise<string | null> {
  if (!idDriveValido(id)) return null;
  const res = await driveFetch(`/files/${encodeURIComponent(id)}`, {
    query: { fields: "id,trashed,hasThumbnail,thumbnailLink" },
    aceitar: [404],
  });
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  const j = (await res.json()) as ArquivoJson;
  if (j.trashed || !j.hasThumbnail || !j.thumbnailLink || !miniaturaPermitida(j.thumbnailLink)) return null;
  return j.thumbnailLink;
}

const MINIATURA_MAX = 8 * 1024 * 1024;
const TIPOS_IMAGEM = /^image\/(jpeg|png|webp|gif)$/;

/**
 * Bytes da miniatura no tamanho pedido. O thumbnailLink abre com o token (sessão do Google); se o Google
 * recusar, tenta sem. Só hosts do Google (miniaturaPermitida), redirecionamentos conferidos um a um,
 * só imagem (jpeg, png, webp, gif) e no máximo 8 MB. null = sem miniatura.
 */
export async function baixarMiniatura(link: string, px: number): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  if (!miniaturaPermitida(link)) return null;
  const token = await tokenDeAcesso();
  for (const comToken of [true, false]) {
    let url = linkComTamanho(link, px);
    for (let salto = 0; salto < 4; salto++) {
      if (!miniaturaPermitida(url)) return null;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: comToken ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return null;
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        await res.body?.cancel().catch(() => {});
        url = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!res.ok || !TIPOS_IMAGEM.test(tipo) || Number(res.headers.get("content-length") ?? 0) > MINIATURA_MAX) {
        await res.body?.cancel().catch(() => {});
        break;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length || bytes.length > MINIATURA_MAX) break;
      return { bytes, tipo };
    }
  }
  return null;
}

/** Do topo até a pasta: [{ id, nome }] (máx. 12 níveis). A raiz do Meu Drive vira "Meu Drive". */
export async function caminhoDaPasta(id: string): Promise<{ id: string; nome: string }[]> {
  const trilha: { id: string; nome: string }[] = [];
  let atual: string | undefined = id;
  for (let n = 0; atual && n < 12; n++) {
    const res = await driveFetch(`/files/${encodeURIComponent(atual)}`, { query: { fields: "id,name,parents,driveId" } });
    const j = (await res.json()) as ArquivoJson;
    const topo = !j.parents?.length;
    trilha.push({ id: j.id, nome: topo && !j.driveId ? "Meu Drive" : (j.name ?? "") });
    atual = j.parents?.[0];
  }
  return trilha.reverse();
}

/** Drives compartilhados que a conta enxerga. */
export async function listarDrivesCompartilhados(): Promise<{ id: string; nome: string }[]> {
  const res = await driveFetch("/drives", { query: { pageSize: 100, fields: "drives(id,name)" } });
  const j = (await res.json()) as { drives?: { id: string; name: string }[] };
  return (j.drives ?? []).map((d) => ({ id: d.id, nome: d.name }));
}

/** Pastas com exatamente este nome dentro do pai, da mais antiga para a mais nova. */
export async function acharPastas(nome: string, paiId: string): Promise<{ id: string; nome: string }[]> {
  if (!idDriveValido(paiId)) throw new GoogleError("pasta", 400, "id inválido");
  const res = await driveFetch("/files", {
    query: {
      q: `name = '${escaparConsulta(nome)}' and '${escaparConsulta(paiId)}' in parents and mimeType = '${PASTA}' and trashed = false`,
      orderBy: "createdTime",
      pageSize: 100,
      includeItemsFromAllDrives: true,
      fields: "files(id,name)",
    },
    aceitar: [404],
  });
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {});
    throw new GoogleError("pasta", 404, "pai");
  }
  const j = (await res.json()) as { files?: ArquivoJson[] };
  // `name =` do Drive não diferencia maiúsculas: confere o nome exato aqui.
  return (j.files ?? []).filter((f) => f.name === nome).map((f) => ({ id: f.id, nome: f.name ?? "" }));
}

/** Cria uma pasta. Pai que não existe: GoogleError("pasta"). */
export async function criarPasta(nome: string, paiId: string, descricao?: string): Promise<string> {
  if (!idDriveValido(paiId)) throw new GoogleError("pasta", 400, "id inválido");
  try {
    const res = await driveFetch("/files", {
      method: "POST",
      query: { fields: "id" },
      json: { name: nome, mimeType: PASTA, parents: [paiId], ...(descricao ? { description: descricao.slice(0, 1000) } : {}) },
    });
    return ((await res.json()) as { id: string }).id;
  } catch (e) {
    if (e instanceof GoogleError && e.motivo === "nao_encontrado") throw new GoogleError("pasta", e.status, "pai");
    throw e;
  }
}

/** Arquivo de 0 byte (o Google não aceita sessão vazia de forma confiável): só metadados. */
export async function criarVazio(
  nome: string,
  paiId: string,
  propriedades: Record<string, string>,
): Promise<{ id: string; md5: string | null }> {
  if (!idDriveValido(paiId)) throw new GoogleError("pasta", 400, "id inválido");
  try {
    const res = await driveFetch("/files", {
      method: "POST",
      query: { fields: "id,md5Checksum" },
      json: { name: nome, parents: [paiId], appProperties: propriedades },
    });
    const j = (await res.json()) as { id: string; md5Checksum?: string };
    return { id: j.id, md5: j.md5Checksum ?? null };
  } catch (e) {
    if (e instanceof GoogleError && e.motivo === "nao_encontrado") throw new GoogleError("pasta", e.status, "pai");
    throw e;
  }
}

/**
 * Abre a sessão retomável com o Origin do navegador (assim o Google responde aos PUTs dele com CORS).
 * Sem mimeType nos metadados (o tipo vai só em X-Upload-Content-Type) e com fields=id.
 */
export async function abrirSessao(i: {
  nome: string;
  tipo: string;
  tamanho: number;
  paiId: string;
  origem: string;
  envioId: string;
  descricao?: string;
}): Promise<{ sessao: string; host: string }> {
  if (!idDriveValido(i.paiId)) throw new GoogleError("pasta", 400, "id inválido");
  let res: Response;
  try {
    res = await driveFetch("/files", {
      base: "upload",
      method: "POST",
      query: { uploadType: "resumable", fields: "id" },
      headers: {
        "X-Upload-Content-Type": i.tipo,
        "X-Upload-Content-Length": String(i.tamanho),
        Origin: i.origem,
      },
      json: {
        name: i.nome,
        parents: [i.paiId],
        appProperties: { zroEnvio: i.envioId },
        ...(i.descricao ? { description: i.descricao.slice(0, 1000) } : {}),
      },
    });
  } catch (e) {
    if (e instanceof GoogleError && e.motivo === "nao_encontrado") throw new GoogleError("pasta", e.status, "pai");
    throw e;
  }
  await res.body?.cancel().catch(() => {});
  const sessao = res.headers.get("location") ?? "";
  if (!sessaoPermitida(sessao)) {
    console.error("[drive]", "abertura_sem_endereco", res.status);
    throw new GoogleError("google", res.status, "sessão sem endereço do Google");
  }
  return { sessao, host: new URL(sessao).host };
}

export type EstadoSessao = { estado: "concluido"; id: string } | { estado: "parcial"; offset: number } | { estado: "morta" };

/**
 * Pergunta ao Google quanto já chegou: PUT sem token, "bytes *\/T", corpo vazio.
 * 200/201 → concluído (com o id); 308 → parcial (sem Range = 0: aqui o servidor lê todos os
 * cabeçalhos, sem CORS); 404/410 → sessão morta.
 */
export async function consultarSessao(sessao: string, total: number): Promise<EstadoSessao> {
  if (!sessaoPermitida(sessao)) throw new GoogleError("google", 0, "sessão fora do Google");
  for (let tentativa = 1; ; tentativa++) {
    let res: Response;
    try {
      res = await fetch(sessao, {
        method: "PUT",
        headers: { "Content-Range": `bytes */${total}` },
        body: new Uint8Array(0),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (tentativa < 3) {
        await recuo(tentativa);
        continue;
      }
      throw new GoogleError("rede", 0, "consulta");
    }
    if (res.status === 200 || res.status === 201) {
      const j = (await res.json().catch(() => null)) as { id?: string } | null;
      if (j?.id) return { estado: "concluido", id: j.id };
      throw new GoogleError("google", res.status, "resposta final sem id");
    }
    await res.body?.cancel().catch(() => {});
    if (res.status === 308) return { estado: "parcial", offset: Math.min(lerRange(res.headers.get("range")) ?? 0, total) };
    if (res.status === 404 || res.status === 410) return { estado: "morta" };
    if ((res.status >= 500 || res.status === 429) && tentativa < 3) {
      await recuo(tentativa);
      continue;
    }
    throw new GoogleError(res.status >= 500 || res.status === 429 ? "taxa" : "google", res.status, "consulta");
  }
}

/** Cancela a sessão no Google (cortesia). Nunca lança. */
export async function cancelarSessao(sessao: string): Promise<void> {
  if (!sessaoPermitida(sessao)) return;
  try {
    const res = await fetch(sessao, { method: "DELETE", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000) });
    await res.body?.cancel().catch(() => {});
  } catch {
    // sem rede: a sessão expira sozinha em uma semana
  }
}

/**
 * Acha o arquivo que um envio criou (appProperties.zroEnvio) dentro da pasta. Reserva: mesmo nome
 * e mesmo tamanho (sessões antigas, ou um Drive que não guardou a propriedade).
 */
export async function acharPorEnvio(
  envioId: string,
  paiId: string,
  reserva?: { nome: string; tamanho: number },
): Promise<{ id: string; tamanho: number | null; md5: string | null } | null> {
  if (!idDriveValido(paiId)) return null;
  const pai = escaparConsulta(paiId);
  const buscar = async (q: string) => {
    const res = await driveFetch("/files", {
      query: { q, pageSize: 20, includeItemsFromAllDrives: true, fields: "files(id,name,size,md5Checksum)" },
      aceitar: [404],
    });
    if (res.status === 404) {
      await res.body?.cancel().catch(() => {});
      return [];
    }
    return ((await res.json()) as { files?: ArquivoJson[] }).files ?? [];
  };
  const porPropriedade = await buscar(
    `appProperties has { key='zroEnvio' and value='${escaparConsulta(envioId)}' } and '${pai}' in parents and trashed = false`,
  );
  let f = porPropriedade[0];
  if (!f && reserva) {
    const porNome = await buscar(`name = '${escaparConsulta(reserva.nome)}' and '${pai}' in parents and trashed = false`);
    f = porNome.find((x) => x.name === reserva.nome && Number(x.size) === reserva.tamanho)!;
  }
  if (!f) return null;
  return { id: f.id, tamanho: f.size != null ? Number(f.size) : null, md5: f.md5Checksum ?? null };
}

/** Manda para a lixeira (só o teste de envio usa). Nunca apaga de vez. */
export async function lixeira(id: string): Promise<void> {
  if (!idDriveValido(id)) return;
  const res = await driveFetch(`/files/${encodeURIComponent(id)}`, { method: "PATCH", query: { fields: "id" }, json: { trashed: true } });
  await res.body?.cancel().catch(() => {});
}

/** Cria uma permissão. Devolve o id dela (guardado para poder recolher). */
export async function criarPermissao(i: {
  arquivoId: string;
  tipo: "anyone" | "user";
  papel: "reader" | "writer";
  email?: string;
  avisar?: boolean;
  mensagem?: string;
}): Promise<string> {
  if (!idDriveValido(i.arquivoId)) throw new GoogleError("nao_encontrado", 400, "id inválido");
  const query: Record<string, string | boolean | undefined> = { fields: "id" };
  if (i.tipo === "user") {
    query.sendNotificationEmail = Boolean(i.avisar);
    if (i.avisar && i.mensagem) query.emailMessage = i.mensagem.slice(0, 400);
  }
  const res = await driveFetch(`/files/${encodeURIComponent(i.arquivoId)}/permissions`, {
    method: "POST",
    query,
    json:
      i.tipo === "anyone"
        ? { type: "anyone", role: i.papel, allowFileDiscovery: false }
        : { type: "user", role: i.papel, emailAddress: i.email },
  });
  return ((await res.json()) as { id: string }).id;
}

/** Remove uma permissão. 404 conta como removida. */
export async function removerPermissao(arquivoId: string, permissaoId: string): Promise<void> {
  if (!idDriveValido(arquivoId) || !/^[A-Za-z0-9_-]{1,128}$/.test(permissaoId)) return;
  const res = await driveFetch(`/files/${encodeURIComponent(arquivoId)}/permissions/${encodeURIComponent(permissaoId)}`, {
    method: "DELETE",
    aceitar: [404],
  });
  await res.body?.cancel().catch(() => {});
}
