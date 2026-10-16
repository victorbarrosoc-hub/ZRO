import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import {
  ARQUIVOS_DA_EMPRESA,
  CLIENTES,
  ESTRUTURA,
  SECOES_ENTREGAS,
  SEM_CLIENTE,
  type ChaveEstrutura,
  nomeDiaria,
  nomePastaProjeto,
} from "@/lib/drive/estrutura";
import { idDePastaDoLink, nomePasta } from "@/lib/drive/nomes";
import { todayISO } from "@/lib/format";
import { contaAtual, dadosDaConexao, driveConectado, salvarRaiz } from "@/lib/google/conexao";
import { acharPastas, arquivoOuNull, caminhoDaPasta, criarPasta, linkPasta, listarPasta, lixeira } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";

/**
 * Pastas no Drive, sem duplicata (docs/dev/drive.md §4).
 * O banco é cache e trava: uma linha de drive_pastas por (conta, pai, nome). Quem insere a linha cria
 * a pasta; quem perdeu espera. Trava parada há 30 s é tomada (quem criava caiu).
 * Toda leitura filtra pela conta conectada agora: troca de conta recria a árvore na conta nova.
 */

const { drivePastas, driveProjetos, driveDiarias, driveConexao, driveLotes, driveEnvios, projects, clients, events } = schema;

const TRAVA_MS = 30_000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ResultadoPastas =
  | { ok: true; driveProjetoId: string; pastaId: string; criadas: number }
  | { ok: false; erro: "sem_google" | "reconectar" | "link_de_fora" | "google"; mensagem: string };

export type DriveProjetoDTO = {
  id: string;
  estado: "criando" | "pronta" | "incompleta" | "erro";
  erro: string | null;
  /** As pastas estão numa conta que não é mais a conectada. */
  contaAntiga: boolean;
  /** Conta do Drive onde essas pastas estão. */
  conta: string;
  deLink: boolean;
  pastaId: string | null;
  pastaUrl: string | null;
  caminho: string | null;
  /** As 7 + subpastas, na ordem. Subpasta: chave "03 Assets/Do cliente", nome "Do cliente". */
  pastas: { chave: string; nome: string; id: string | null; url: string | null }[];
  entregasLiberadasEm: Date | null;
};

export type DiariaDTO = {
  id: string;
  numero: number;
  nome: string;
  data: string;
  cenasPastaId: string | null;
  audiosPastaId: string | null;
};

const COLUNAS: Record<ChaveEstrutura, "documentosId" | "cenasId" | "audiosId" | "assetsId" | "projetoEdicaoId" | "renderId" | "entregasId"> = {
  documentos: "documentosId",
  cenas: "cenasId",
  audios: "audiosId",
  assets: "assetsId",
  projetoEdicao: "projetoEdicaoId",
  render: "renderId",
  entregas: "entregasId",
};

const LINK_DE_FORA =
  "O link do Drive do projeto não abre na conta conectada. Corrija o link ou apague para criar a pasta padrão.";

async function contaObrigatoria(): Promise<string> {
  const c = await contaAtual();
  if (!c) throw new GoogleError("sem_google");
  return c.conta;
}

/* ============================== Uma pasta ============================== */

type Garantida = { ok: true; pastaId: string; criada: boolean } | { ok: false; conflito: true };

async function criarNoDrive(linhaId: string, paiId: string, nome: string, descricao?: string): Promise<{ id: string; criada: boolean }> {
  try {
    const achadas = await acharPastas(nome, paiId);
    const id = achadas[0]?.id ?? (await criarPasta(nome, paiId, descricao));
    await db.update(drivePastas).set({ pastaId: id, criandoDesde: null }).where(eq(drivePastas.id, linhaId));
    return { id, criada: !achadas[0] };
  } catch (e) {
    // Solta a trava: a próxima chamada tenta de novo.
    await db
      .delete(drivePastas)
      .where(and(eq(drivePastas.id, linhaId), isNull(drivePastas.pastaId)))
      .catch(() => {});
    throw e;
  }
}

async function garantirUma(
  conta: string,
  paiId: string,
  nome: string,
  opcoes: { chave?: string; descricao?: string },
): Promise<Garantida> {
  const chave = opcoes.chave ?? null;
  for (let volta = 0; volta < 12; volta++) {
    let linha: typeof drivePastas.$inferSelect | undefined;
    if (chave) {
      [linha] = await db
        .select()
        .from(drivePastas)
        .where(and(eq(drivePastas.conta, conta), eq(drivePastas.chave, chave)))
        .limit(1);
    }
    if (!linha) {
      const [porNome] = await db
        .select()
        .from(drivePastas)
        .where(and(eq(drivePastas.conta, conta), eq(drivePastas.paiId, paiId), eq(drivePastas.nome, nome)))
        .limit(1);
      if (porNome && chave) {
        // Mesmo nome de outro dono (dois clientes chamados "SERHS"): quem chama tenta "SERHS (2)".
        if (porNome.chave && porNome.chave !== chave) return { ok: false, conflito: true };
        if (!porNome.chave) {
          await db
            .update(drivePastas)
            .set({ chave })
            .where(and(eq(drivePastas.id, porNome.id), isNull(drivePastas.chave)))
            .catch(() => {});
        }
      }
      linha = porNome;
    }
    if (linha?.pastaId) return { ok: true, pastaId: linha.pastaId, criada: false };

    if (!linha) {
      const [nova] = await db
        .insert(drivePastas)
        .values({ conta, paiId, nome, chave, criandoDesde: new Date() })
        .onConflictDoNothing()
        .returning({ id: drivePastas.id });
      if (nova) {
        const r = await criarNoDrive(nova.id, paiId, nome, opcoes.descricao);
        return { ok: true, pastaId: r.id, criada: r.criada };
      }
      continue; // outra requisição inseriu antes: relê
    }

    // Alguém está criando. Parado há mais de 30 s: assume.
    const limite = new Date(Date.now() - TRAVA_MS);
    if (!linha.criandoDesde || linha.criandoDesde < limite) {
      const [tomada] = await db
        .update(drivePastas)
        .set({ criandoDesde: new Date() })
        .where(
          and(
            eq(drivePastas.id, linha.id),
            isNull(drivePastas.pastaId),
            or(isNull(drivePastas.criandoDesde), lt(drivePastas.criandoDesde, limite)),
          ),
        )
        .returning({ id: drivePastas.id });
      if (tomada) {
        const r = await criarNoDrive(linha.id, linha.paiId, linha.nome, opcoes.descricao);
        return { ok: true, pastaId: r.id, criada: r.criada };
      }
    }
    await espera(300);
  }
  throw new GoogleError("taxa", 0, "pasta ainda em criação");
}

async function garantirPastaInfo(
  paiId: string,
  nome: string,
  opcoes: { chave?: string; descricao?: string } = {},
): Promise<{ id: string; criada: boolean }> {
  const conta = await contaObrigatoria();
  if (!nome.trim()) throw new GoogleError("google", 0, "nome de pasta vazio");
  for (let n = 1; n <= 20; n++) {
    const tentativa = n === 1 ? nome : `${nome} (${n})`;
    const r = await garantirUma(conta, paiId, tentativa, opcoes);
    if (r.ok) return { id: r.pastaId, criada: r.criada };
  }
  throw new GoogleError("google", 0, "nomes repetidos demais");
}

/** A pasta `nome` dentro de `paiId`, criada uma vez só (o nome já vem limpo e casa exato). */
export async function garantirPasta(paiId: string, nome: string, opcoes?: { chave?: string; descricao?: string }): Promise<string> {
  return (await garantirPastaInfo(paiId, nome, opcoes)).id;
}

/** Cada nome uma pasta dentro da anterior. Devolve a última. */
export async function garantirCaminho(paiId: string, nomes: string[]): Promise<string> {
  let atual = paiId;
  for (const nome of nomes) atual = await garantirPasta(atual, nome);
  return atual;
}

/** <Meu Drive>/ZRO e ZRO/Clientes (guardadas na conexão). */
export async function garantirRaiz(): Promise<{ raizId: string; clientesId: string }> {
  await contaObrigatoria();
  const conexao = await dadosDaConexao();
  let raizId = conexao?.raizId ?? null;
  let clientesId = conexao?.clientesId ?? null;
  const antes = `${raizId}|${clientesId}`;
  if (!raizId) raizId = await garantirPasta("root", nomePasta(conexao?.raizNome || "ZRO"));
  if (!clientesId) clientesId = await garantirPasta(raizId, CLIENTES);
  if (`${raizId}|${clientesId}` !== antes) await salvarRaiz({ raizId, clientesId });
  return { raizId, clientesId };
}

/** Chave lógica da pasta do cliente dentro de uma pasta Clientes (trocar a raiz cria outra). */
function chaveDoCliente(clientesId: string, clientId: string | null) {
  return clientId ? `cliente:${clientesId}:${clientId}` : `sem-cliente:${clientesId}`;
}

/** Clientes/<Cliente> (pela chave: renomear o cliente não cria outra pasta). Sem cliente: "Sem cliente". */
export async function garantirPastaDoCliente(clientId: string | null): Promise<string> {
  const { clientesId } = await garantirRaiz();
  const cliente = clientId
    ? await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { id: true, name: true } })
    : undefined;
  if (!cliente) return garantirPasta(clientesId, SEM_CLIENTE, { chave: chaveDoCliente(clientesId, null) });
  return garantirPasta(clientesId, nomePasta(cliente.name), { chave: chaveDoCliente(clientesId, cliente.id) });
}

/** Clientes/<Cliente>/Arquivos da empresa (o que o cliente manda sem escolher projeto). */
export async function garantirArquivosDaEmpresa(clientId: string): Promise<string> {
  const cliente = await garantirPastaDoCliente(clientId);
  return garantirPasta(cliente, ARQUIVOS_DA_EMPRESA, { chave: `empresa:${cliente}` });
}

/**
 * A pasta sumiu do Drive (404, lixeira): esquece o cache dela e das filhas diretas. Nada muda no Drive.
 * Projetos que usavam a pasta ficam "incompleta" e a próxima chamada recria o que falta.
 */
export async function esquecerPasta(pastaId: string): Promise<void> {
  await db.delete(drivePastas).where(or(eq(drivePastas.pastaId, pastaId), eq(drivePastas.paiId, pastaId)));
  await db.update(driveConexao).set({ raizId: null, clientesId: null }).where(eq(driveConexao.raizId, pastaId));
  await db.update(driveConexao).set({ clientesId: null }).where(eq(driveConexao.clientesId, pastaId));

  // Pasta do projeto inteira: tudo dela cai junto.
  const raizes = await db.select({ id: driveProjetos.id }).from(driveProjetos).where(eq(driveProjetos.pastaId, pastaId));
  for (const r of raizes) {
    await db
      .update(driveProjetos)
      .set({
        estado: "incompleta",
        documentosId: null,
        cenasId: null,
        audiosId: null,
        assetsId: null,
        projetoEdicaoId: null,
        renderId: null,
        entregasId: null,
        subpastas: {},
      })
      .where(eq(driveProjetos.id, r.id));
    await db.update(driveDiarias).set({ cenasPastaId: null, audiosPastaId: null }).where(eq(driveDiarias.driveProjetoId, r.id));
  }
  // Uma das 7 pastas.
  for (const coluna of Object.values(COLUNAS)) {
    const afetados = await db
      .update(driveProjetos)
      .set({ [coluna]: null, estado: "incompleta" })
      .where(eq(driveProjetos[coluna], pastaId))
      .returning({ id: driveProjetos.id });
    for (const a of afetados) {
      if (coluna === "cenasId") await db.update(driveDiarias).set({ cenasPastaId: null }).where(eq(driveDiarias.driveProjetoId, a.id));
      if (coluna === "audiosId") await db.update(driveDiarias).set({ audiosPastaId: null }).where(eq(driveDiarias.driveProjetoId, a.id));
    }
  }
  // Subpastas guardadas no jsonb.
  const comSub = await db
    .select({ id: driveProjetos.id, subpastas: driveProjetos.subpastas })
    .from(driveProjetos)
    .where(sql`${driveProjetos.subpastas}::text like ${`%"${pastaId}"%`}`);
  for (const r of comSub) {
    // O "_" do id é curinga no LIKE: só mexe na linha que tem mesmo esse id.
    const sub = Object.fromEntries(Object.entries(r.subpastas ?? {}).filter(([, v]) => v !== pastaId));
    if (Object.keys(sub).length === Object.keys(r.subpastas ?? {}).length) continue;
    await db.update(driveProjetos).set({ subpastas: sub, estado: "incompleta" }).where(eq(driveProjetos.id, r.id));
  }
  // Pastas de diária.
  await db.update(driveDiarias).set({ cenasPastaId: null }).where(eq(driveDiarias.cenasPastaId, pastaId));
  await db.update(driveDiarias).set({ audiosPastaId: null }).where(eq(driveDiarias.audiosPastaId, pastaId));
}

/**
 * Confere ZRO, Clientes e a pasta do cliente no Drive; o que sumiu ou foi para a lixeira sai do cache
 * (senão a árvore nova nasceria dentro de uma pasta na lixeira).
 */
async function conferirCaminhoDoCliente(clientId: string | null): Promise<void> {
  const conexao = await dadosDaConexao();
  const conta = await contaObrigatoria();
  const [cliente] = conexao?.clientesId
    ? await db
        .select({ pastaId: drivePastas.pastaId })
        .from(drivePastas)
        .where(and(eq(drivePastas.conta, conta), eq(drivePastas.chave, chaveDoCliente(conexao.clientesId, clientId))))
        .limit(1)
    : [];
  for (const id of [conexao?.raizId, conexao?.clientesId, cliente?.pastaId]) {
    if (!id) continue;
    const a = await arquivoOuNull(id, "id,mimeType,trashed");
    if (!a || a.lixeira || !a.pasta) await esquecerPasta(id);
  }
}

/* ============================== Projeto ============================== */

function mensagemDe(e: unknown): { erro: "sem_google" | "reconectar" | "google"; mensagem: string } {
  if (e instanceof GoogleError) {
    if (e.motivo === "sem_google" || e.motivo === "sem_config") return { erro: "sem_google", mensagem: "Conecte o Google Drive em Ajustes." };
    if (e.motivo === "reconectar") return { erro: "reconectar", mensagem: "A conexão com o Google expirou. Reconecte em Ajustes." };
    if (e.motivo === "sem_espaco") return { erro: "google", mensagem: "O Drive está cheio." };
    if (e.motivo === "sem_permissao") return { erro: "google", mensagem: "A conta conectada não pode criar pastas aqui." };
    if (e.motivo === "pasta") return { erro: "google", mensagem: "Uma pasta do caminho não existe mais no Drive. Tente de novo." };
    return { erro: "google", mensagem: "O Google não respondeu. Tente de novo." };
  }
  console.error("[drive]", "pastas", e instanceof Error ? e.name : "erro");
  return { erro: "google", mensagem: "Não deu para criar as pastas. Tente de novo." };
}

/** As 7 pastas e todas as subpastas com id. */
function completa(l: typeof driveProjetos.$inferSelect): boolean {
  const sub = l.subpastas ?? {};
  return ESTRUTURA.every((p) => l[COLUNAS[p.chave]] && ("sub" in p ? p.sub.every((s) => sub[`${p.nome}/${s}`]) : true));
}

async function linhaDoProjeto(projectId: string, conta: string) {
  const [linha] = await db
    .select()
    .from(driveProjetos)
    .where(and(eq(driveProjetos.projectId, projectId), eq(driveProjetos.conta, conta)))
    .limit(1);
  return linha;
}

/** O link do projeto aponta para uma pasta que a própria ZRO criou (não é link "de fora")? */
async function pastaFoiDaZro(projectId: string, pastaId: string, conta: string, contaAntigaVale: boolean) {
  const [r] = await db
    .select({ id: driveProjetos.id })
    .from(driveProjetos)
    .where(
      and(
        eq(driveProjetos.projectId, projectId),
        eq(driveProjetos.pastaId, pastaId),
        eq(driveProjetos.deLink, false),
        contaAntigaVale ? undefined : eq(driveProjetos.conta, conta),
      ),
    )
    .limit(1);
  return Boolean(r);
}

async function rotuloDoProjeto(projeto: { title: string; startDate: string | null; clientId: string | null }) {
  const cliente = projeto.clientId
    ? await db.query.clients.findFirst({ where: eq(clients.id, projeto.clientId), columns: { name: true } })
    : null;
  const nomeProjeto = nomePastaProjeto((projeto.startDate ?? todayISO()).slice(0, 7), projeto.title);
  const nomeCliente = cliente ? nomePasta(cliente.name) : SEM_CLIENTE;
  return { nomeProjeto, nomeCliente, rotulo: `${nomeCliente} / ${nomeProjeto}` };
}

/**
 * A árvore do projeto (idempotente). Chamar de novo completa o que falta.
 * - Já tem pasta: usa. - Link do projeto de fora da ZRO: usa a pasta do link (precisa abrir e aceitar
 *   arquivos; senão erro, nunca uma segunda árvore em silêncio). - Vazio: cria em Clientes/<Cliente>.
 * `verificar`: confere cada id guardado e recria o que foi para a lixeira ("Recriar o que falta").
 * `ignorarLinkAntigo`: troca de conta ("Criar na conta atual").
 */
export async function garantirPastasDoProjeto(
  projectId: string,
  opcoes: { userId?: string; verificar?: boolean; ignorarLinkAntigo?: boolean } = {},
): Promise<ResultadoPastas> {
  let linha: typeof driveProjetos.$inferSelect | undefined;
  try {
    const c = await contaAtual();
    if (!c) return { ok: false, erro: "sem_google", mensagem: "Conecte o Google Drive em Ajustes." };
    const projeto = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!projeto) return { ok: false, erro: "google", mensagem: "Projeto não encontrado." };
    const { nomeProjeto, nomeCliente, rotulo } = await rotuloDoProjeto(projeto);

    await db
      .insert(driveProjetos)
      .values({ projectId, clientId: projeto.clientId, conta: c.conta, rotulo, estado: "criando" })
      .onConflictDoNothing();
    linha = await linhaDoProjeto(projectId, c.conta);
    if (!linha) return { ok: false, erro: "google", mensagem: "Não deu para registrar as pastas. Tente de novo." };
    const id = linha.id;
    // Caminho rápido: árvore pronta e completa no cache (o envio do freela passa por aqui toda vez).
    if (!opcoes.verificar && linha.estado === "pronta" && linha.pastaId && completa(linha)) {
      return { ok: true, driveProjetoId: id, pastaId: linha.pastaId, criadas: 0 };
    }
    const salvar = (campos: Partial<typeof driveProjetos.$inferInsert>) =>
      db.update(driveProjetos).set(campos).where(eq(driveProjetos.id, id));
    let criadas = 0;

    // 1. A pasta do projeto.
    let pastaId = linha.pastaId;
    if (pastaId && (opcoes.verificar || linha.estado !== "pronta")) {
      const a = await arquivoOuNull(pastaId, "id,mimeType,trashed");
      if (!a || !a.pasta || a.lixeira) {
        if (linha.deLink) {
          await salvar({ estado: "erro", erro: LINK_DE_FORA });
          return { ok: false, erro: "link_de_fora", mensagem: LINK_DE_FORA };
        }
        await esquecerPasta(pastaId);
        await conferirCaminhoDoCliente(projeto.clientId);
        pastaId = null;
      }
    }
    if (!pastaId) {
      const linkId = idDePastaDoLink(projeto.driveUrl);
      const daZro = linkId ? await pastaFoiDaZro(projectId, linkId, c.conta, Boolean(opcoes.ignorarLinkAntigo)) : false;
      if (projeto.driveUrl?.trim() && !daZro) {
        const a = linkId ? await arquivoOuNull(linkId) : null;
        if (!a || !a.pasta || a.lixeira || !a.podeAdicionar) {
          await salvar({ estado: "erro", erro: LINK_DE_FORA, rotulo, clientId: projeto.clientId });
          return { ok: false, erro: "link_de_fora", mensagem: LINK_DE_FORA };
        }
        pastaId = a.id;
        const trilha = await caminhoDaPasta(pastaId).catch(() => [] as { nome: string }[]);
        await salvar({
          pastaId,
          pastaUrl: linkPasta(pastaId),
          deLink: true,
          caminho: trilha.length ? trilha.map((t) => t.nome).join(" / ") : a.nome,
          rotulo,
          clientId: projeto.clientId,
        });
      } else {
        const pastaCliente = await garantirPastaDoCliente(projeto.clientId);
        const r = await garantirPastaInfo(pastaCliente, nomeProjeto);
        pastaId = r.id;
        if (r.criada) criadas++;
        const conexao = await dadosDaConexao();
        const url = linkPasta(pastaId);
        await salvar({
          pastaId,
          pastaUrl: url,
          deLink: false,
          caminho: [nomePasta(conexao?.raizNome || "ZRO"), CLIENTES, nomeCliente, nomeProjeto].join(" / "),
          rotulo,
          clientId: projeto.clientId,
        });
        // O link do projeto só é gravado se estiver vazio (ou se o antigo era da própria ZRO).
        await db
          .update(projects)
          .set({ driveUrl: url })
          .where(
            and(
              eq(projects.id, projectId),
              projeto.driveUrl?.trim() && daZro ? eq(projects.driveUrl, projeto.driveUrl) : or(isNull(projects.driveUrl), eq(projects.driveUrl, "")),
            ),
          );
      }
    }

    // 2. Conferência pedida: o que foi para a lixeira sai do cache.
    if (opcoes.verificar) {
      if (!linha.deLink) await conferirCaminhoDoCliente(projeto.clientId);
      const atual = await linhaDoProjeto(projectId, c.conta);
      const ids = [
        ...Object.values(COLUNAS).map((col) => atual?.[col]),
        ...Object.values(atual?.subpastas ?? {}),
      ].filter((x): x is string => !!x);
      for (const pid of ids) {
        const a = await arquivoOuNull(pid, "id,mimeType,trashed");
        if (!a || a.lixeira || !a.pasta) await esquecerPasta(pid);
      }
    }

    // 3. As 7 pastas e as subpastas, uma por vez.
    const atual = await linhaDoProjeto(projectId, c.conta);
    const subpastas: Record<string, string> = { ...(atual?.subpastas ?? {}) };
    const colunas: Partial<Record<(typeof COLUNAS)[ChaveEstrutura], string>> = {};
    let falhou: string | null = null;
    for (const p of ESTRUTURA) {
      try {
        const r = await garantirPastaInfo(pastaId, p.nome);
        if (r.criada) criadas++;
        colunas[COLUNAS[p.chave]] = r.id;
        for (const sub of "sub" in p ? p.sub : []) {
          const s = await garantirPastaInfo(r.id, sub);
          if (s.criada) criadas++;
          subpastas[`${p.nome}/${sub}`] = s.id;
        }
      } catch (e) {
        if (e instanceof GoogleError && (e.motivo === "sem_google" || e.motivo === "reconectar")) throw e;
        falhou ??= mensagemDe(e).mensagem;
      }
    }
    await salvar({ ...colunas, subpastas, estado: falhou ? "incompleta" : "pronta", erro: falhou });
    if (falhou) return { ok: false, erro: "google", mensagem: falhou };
    return { ok: true, driveProjetoId: id, pastaId, criadas };
  } catch (e) {
    const m = mensagemDe(e);
    if (linha) {
      await db
        .update(driveProjetos)
        .set({ estado: linha.pastaId ? "incompleta" : "erro", erro: m.mensagem })
        .where(eq(driveProjetos.id, linha.id))
        .catch(() => {});
    }
    return { ok: false, erro: m.erro, mensagem: m.mensagem };
  }
}

/**
 * Chamada por createProject: grava a linha "criando" (rápido) e cria o resto depois da resposta.
 * Nunca lança: o projeto nasce mesmo com o Google fora.
 */
export async function agendarPastasDoProjeto(projectId: string): Promise<void> {
  try {
    if (!(await driveConectado())) return;
    const c = await contaAtual();
    const projeto = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!c || !projeto) return;
    const { rotulo } = await rotuloDoProjeto(projeto);
    await db
      .insert(driveProjetos)
      .values({ projectId, clientId: projeto.clientId, conta: c.conta, rotulo, estado: "criando" })
      .onConflictDoNothing();
    const tarefa = () => garantirPastasDoProjeto(projectId).then(
      () => undefined,
      () => undefined,
    );
    try {
      after(tarefa);
    } catch {
      // Fora de uma requisição (script): segue sem esperar.
      void tarefa();
    }
  } catch (e) {
    console.error("[drive]", "agendar_pastas", e instanceof Error ? e.name : "erro");
  }
}

/* ============================== Apagar ============================== */

/** Linha que ficou sem pasta depois de "Apagar pasta do Drive": para as telas, o projeto não tem pasta. */
function apagada(l: typeof driveProjetos.$inferSelect): boolean {
  return !l.pastaId && l.estado === "incompleta" && !l.erro;
}

/** Tem algum arquivo (não pasta) em qualquer nível? Para no primeiro que achar. */
async function temArquivo(pastaId: string): Promise<boolean> {
  const fila = [pastaId];
  for (let lidas = 0; fila.length; lidas++) {
    // Árvore grande demais para conferir: trata como cheia (nunca apaga sem ter visto).
    if (lidas >= 150) return true;
    let pagina: string | null = null;
    do {
      const r = await listarPasta(fila.shift()!, pagina);
      if (r.itens.some((i) => !i.pasta)) return true;
      fila.push(...r.itens.filter((i) => i.pasta).map((i) => i.id));
      pagina = r.proxima;
    } while (pagina);
  }
  return false;
}

export type ResultadoApagar = { ok: true } | { ok: false; mensagem: string };

/**
 * "Apagar pasta do Drive": só a árvore que a ZRO criou, vazia (nenhum arquivo em nenhum nível) e sem
 * envio em andamento. A pasta vai para a lixeira do Drive (o Google guarda 30 dias); nada é apagado
 * de vez. A linha fica (números das diárias e links seguem valendo) e "Criar pastas" volta a aparecer.
 */
export async function apagarPastaDoProjeto(
  projectId: string,
  /** Roda depois das conferências e antes da lixeira (recolher as entregas). */
  antes?: (linha: typeof driveProjetos.$inferSelect) => Promise<ResultadoApagar>,
): Promise<ResultadoApagar> {
  try {
    const linha = await driveProjetoAtual(projectId);
    if (!linha?.pastaId) return { ok: false, mensagem: "Este projeto não tem pasta no Drive." };
    if (linha.deLink) return { ok: false, mensagem: "A pasta veio do link do projeto. Para trocar, edite o link do Drive no projeto." };
    if (linha.estado === "criando") return { ok: false, mensagem: "As pastas ainda estão sendo criadas. Espere terminar." };
    const pastaId = linha.pastaId;

    const [enviando] = await db
      .select({ id: driveEnvios.id })
      .from(driveEnvios)
      .innerJoin(driveLotes, eq(driveLotes.id, driveEnvios.loteId))
      .where(and(eq(driveLotes.driveProjetoId, linha.id), eq(driveEnvios.estado, "enviando")))
      .limit(1);
    if (enviando) return { ok: false, mensagem: "Tem envio em andamento nesta pasta. Espere terminar ou cancele." };

    const a = await arquivoOuNull(pastaId, "id,mimeType,trashed");
    if (a && a.pasta && !a.lixeira) {
      if (await temArquivo(pastaId)) {
        return { ok: false, mensagem: "A pasta tem arquivos. Para não perder material, apague direto no Drive se for isso mesmo." };
      }
    }
    if (antes) {
      const r = await antes(linha);
      if (!r.ok) return r;
    }
    if (a && a.pasta && !a.lixeira) await lixeira(pastaId);

    await esquecerPasta(pastaId);
    await db
      .update(driveProjetos)
      .set({ pastaId: null, pastaUrl: null, caminho: null, estado: "incompleta", erro: null, rolos: {}, entregasLiberadasEm: null, entregasLiberadasPorId: null })
      .where(eq(driveProjetos.id, linha.id));
    // O link do projeto apontava para a pasta apagada: sai, senão a próxima criação acharia um link quebrado.
    const projeto = await db.query.projects.findFirst({ where: eq(projects.id, projectId), columns: { driveUrl: true } });
    if (projeto?.driveUrl && idDePastaDoLink(projeto.driveUrl) === pastaId) {
      await db.update(projects).set({ driveUrl: null }).where(and(eq(projects.id, projectId), eq(projects.driveUrl, projeto.driveUrl)));
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof GoogleError) {
      if (e.motivo === "sem_google" || e.motivo === "sem_config") return { ok: false, mensagem: "Conecte o Google Drive em Ajustes." };
      if (e.motivo === "reconectar") return { ok: false, mensagem: "A conexão com o Google expirou. Reconecte em Ajustes." };
      if (e.motivo === "sem_permissao") return { ok: false, mensagem: "A conta conectada não pode apagar esta pasta." };
    }
    console.error("[drive]", "apagar_pasta", e instanceof Error ? e.name : "erro");
    return { ok: false, mensagem: "O Google não respondeu. Tente de novo." };
  }
}

/** Pastas do projeto para as telas (conta atual; senão, a mais recente de outra conta). */
export async function pastasDoProjeto(projectId: string): Promise<DriveProjetoDTO | null> {
  const c = await contaAtual();
  let linha = c ? await linhaDoProjeto(projectId, c.conta) : undefined;
  if (!linha) {
    [linha] = await db
      .select()
      .from(driveProjetos)
      .where(eq(driveProjetos.projectId, projectId))
      .orderBy(desc(driveProjetos.criadoEm))
      .limit(1);
  }
  if (!linha || apagada(linha)) return null;
  const sub = linha.subpastas ?? {};
  const pastas: DriveProjetoDTO["pastas"] = [];
  for (const p of ESTRUTURA) {
    const pid = linha[COLUNAS[p.chave]];
    pastas.push({ chave: p.chave, nome: p.nome, id: pid, url: pid ? linkPasta(pid) : null });
    for (const s of "sub" in p ? p.sub : []) {
      const sid = sub[`${p.nome}/${s}`] ?? null;
      pastas.push({ chave: `${p.nome}/${s}`, nome: s, id: sid, url: sid ? linkPasta(sid) : null });
    }
  }
  return {
    id: linha.id,
    estado: linha.estado as DriveProjetoDTO["estado"],
    erro: linha.erro,
    contaAntiga: !c || linha.conta !== c.conta,
    conta: linha.conta,
    deLink: linha.deLink,
    pastaId: linha.pastaId,
    pastaUrl: linha.pastaUrl,
    caminho: linha.caminho,
    pastas,
    entregasLiberadasEm: linha.entregasLiberadasEm,
  };
}

export type PastasDaPauta = {
  render: { id: string; url: string } | null;
  entregas: { id: string; url: string } | null;
  /** Seções de 06 Entregas ("Master", "Redes", "Legendas"). */
  secoes: Record<string, { id: string; url: string } | null>;
  entregasLiberadas: boolean;
};

/**
 * Onde a peça final sobe, para a ficha da Pauta: 05 Render e 06 Entregas (com as seções) de cada
 * projeto, na conta conectada agora. Só lê o banco (nada de Google). Sem Drive: mapa vazio.
 */
export async function pastasDaPauta(projectIds: string[]): Promise<Map<string, PastasDaPauta>> {
  const mapa = new Map<string, PastasDaPauta>();
  if (!projectIds.length) return mapa;
  const c = await contaAtual().catch(() => null);
  if (!c) return mapa;
  const linhas = await db
    .select()
    .from(driveProjetos)
    .where(and(eq(driveProjetos.conta, c.conta), inArray(driveProjetos.projectId, projectIds)));
  const pasta = (id: string | null | undefined) => (id ? { id, url: linkPasta(id) } : null);
  for (const l of linhas) {
    if (!l.projectId || !l.pastaId || apagada(l)) continue;
    const sub = l.subpastas ?? {};
    mapa.set(l.projectId, {
      render: pasta(l.renderId),
      entregas: pasta(l.entregasId),
      secoes: Object.fromEntries(SECOES_ENTREGAS.map((s) => [s, pasta(sub[`06 Entregas/${s}`])])),
      entregasLiberadas: Boolean(l.entregasLiberadasEm),
    });
  }
  return mapa;
}

/** Linha de drive_projetos da conta atual (para os outros serviços). */
export async function driveProjetoAtual(projectId: string) {
  const c = await contaAtual();
  return c ? linhaDoProjeto(projectId, c.conta) : undefined;
}

/* ============================== Diária ============================== */

/**
 * A diária com número congelado: posição por (data, criação, id) entre as diárias do projeto, ou o
 * próximo livre. Cria a pasta em 01 Cenas ou 02 Áudios só quando pedido (sem pasta vazia de áudio).
 */
export async function diariaDoEvento(eventId: string, opcoes: { criarPastas?: "cenas" | "audios" } = {}): Promise<DiariaDTO> {
  const evento = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!evento?.projectId) throw new GoogleError("nao_encontrado", 0, "diária sem projeto");
  const r = await garantirPastasDoProjeto(evento.projectId);
  if (!r.ok) {
    throw new GoogleError(r.erro === "sem_google" ? "sem_google" : r.erro === "reconectar" ? "reconectar" : "google", 0, r.mensagem);
  }
  const driveProjetoId = r.driveProjetoId;

  let [linha] = await db
    .select()
    .from(driveDiarias)
    .where(and(eq(driveDiarias.eventId, eventId), eq(driveDiarias.driveProjetoId, driveProjetoId)))
    .limit(1);
  if (!linha) {
    const doProjeto = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.projectId, evento.projectId), eq(events.type, "diaria")))
      .orderBy(asc(events.date), asc(events.createdAt), asc(events.id));
    let numero = doProjeto.findIndex((e) => e.id === eventId) + 1 || doProjeto.length + 1;
    for (let t = 0; t < 6 && !linha; t++) {
      const usados = (await db.select({ n: driveDiarias.numero }).from(driveDiarias).where(eq(driveDiarias.driveProjetoId, driveProjetoId))).map(
        (u) => u.n,
      );
      if (usados.includes(numero)) numero = Math.max(...usados) + 1;
      [linha] = await db
        .insert(driveDiarias)
        .values({ eventId, projectId: evento.projectId, driveProjetoId, numero, data: evento.date, nome: nomeDiaria(evento.date, numero) })
        .onConflictDoNothing()
        .returning();
      if (!linha) {
        [linha] = await db
          .select()
          .from(driveDiarias)
          .where(and(eq(driveDiarias.eventId, eventId), eq(driveDiarias.driveProjetoId, driveProjetoId)))
          .limit(1);
      }
    }
    if (!linha) throw new GoogleError("google", 0, "número da diária");
  }

  if (opcoes.criarPastas) {
    const dp = await db.query.driveProjetos.findFirst({ where: eq(driveProjetos.id, driveProjetoId) });
    const coluna = opcoes.criarPastas === "cenas" ? "cenasPastaId" : "audiosPastaId";
    const pai = opcoes.criarPastas === "cenas" ? dp?.cenasId : dp?.audiosId;
    if (!linha[coluna]) {
      if (!pai) throw new GoogleError("pasta", 0, "pasta da diária");
      const pid = await garantirPasta(pai, linha.nome);
      await db.update(driveDiarias).set({ [coluna]: pid }).where(eq(driveDiarias.id, linha.id));
      linha = { ...linha, [coluna]: pid };
    }
  }
  return {
    id: linha.id,
    numero: linha.numero,
    nome: linha.nome,
    data: linha.data,
    cenasPastaId: linha.cenasPastaId,
    audiosPastaId: linha.audiosPastaId,
  };
}

/* ============================== Ajustes ============================== */

/** A conta já tem pastas criadas pela ZRO? (trocar de conta pede confirmação) */
export async function contaTemPastas(conta: string): Promise<boolean> {
  const [p] = await db.select({ id: drivePastas.id }).from(drivePastas).where(eq(drivePastas.conta, conta)).limit(1);
  if (p) return true;
  const [d] = await db.select({ id: driveProjetos.id }).from(driveProjetos).where(eq(driveProjetos.conta, conta)).limit(1);
  return Boolean(d);
}

/** Projetos ativos sem a árvore pronta na conta atual. */
export async function projetosAtivosSemPasta(limite = 200): Promise<{ id: string; title: string }[]> {
  const c = await contaAtual();
  const ativos = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(eq(projects.status, "ativo"))
    .orderBy(desc(projects.createdAt))
    .limit(1000);
  if (!c) return ativos.slice(0, limite);
  const prontos = new Set(
    (
      await db
        .select({ p: driveProjetos.projectId })
        .from(driveProjetos)
        .where(and(eq(driveProjetos.conta, c.conta), eq(driveProjetos.estado, "pronta")))
    ).map((r) => r.p),
  );
  return ativos.filter((p) => !prontos.has(p.id)).slice(0, limite);
}
