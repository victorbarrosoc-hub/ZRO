import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { SECOES_ENTREGAS } from "@/lib/drive/estrutura";
import { criarPermissao, listarPasta, removerPermissao } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";
import { logProjectActivity } from "./activity";
import { areaDoCliente } from "./drive-links";
import { garantirPastasDoProjeto, garantirRaiz } from "./drive-pastas";

/**
 * Entregas para o cliente (docs/dev/drive.md §4): "Liberar entregas" cria o link "qualquer pessoa:
 * leitor" SÓ em 06 Entregas (os arquivos de dentro herdam) e, se o cliente tem e-mail no CRM, o
 * compartilhamento de leitor com aviso do Google. Toda permissão criada fica registrada para "Recolher".
 */

const { driveCompartilhamentos, driveProjetos, projects, clients } = schema;

export type EntregaArquivo = {
  id: string;
  nome: string;
  secao: "Master" | "Redes" | "Legendas" | null;
  caminho: string;
  tamanho: number | null;
  modificadoEm: string | null;
  baixarUrl: string | null;
  verUrl: string;
};

export type CompartilhamentoDTO = {
  id: string;
  motivo: "entregas" | "equipe";
  tipo: "anyone" | "user";
  papel: string;
  email: string | null;
  avisouPorEmail: boolean;
  criadoEm: Date;
  revogadoEm: Date | null;
  erro: string | null;
};

const BLOQUEADO = "O Google Workspace bloqueou o link público. Veja Ajustes → Google Drive.";

function paraDTO(r: typeof driveCompartilhamentos.$inferSelect): CompartilhamentoDTO {
  return {
    id: r.id,
    motivo: r.motivo as CompartilhamentoDTO["motivo"],
    tipo: r.tipo as CompartilhamentoDTO["tipo"],
    papel: r.papel,
    email: r.email,
    avisouPorEmail: r.avisouPorEmail,
    criadoEm: r.criadoEm,
    revogadoEm: r.revogadoEm,
    erro: r.erro,
  };
}

function mensagemDe(e: unknown): string {
  if (e instanceof GoogleError) {
    if (e.motivo === "compartilhamento_bloqueado") return BLOQUEADO;
    if (e.motivo === "reconectar") return "A conexão com o Google expirou. Reconecte em Ajustes.";
    if (e.motivo === "sem_google" || e.motivo === "sem_config") return "Conecte o Google Drive em Ajustes.";
    if (e.motivo === "sem_permissao") return "A conta conectada não pode compartilhar esta pasta.";
  }
  return "O Google não respondeu. Tente de novo.";
}

/** Texto do e-mail do Google (≤ 400 caracteres, sem exclamação). */
export function mensagemDoEmailDeEntrega(projeto: string, urlArea: string | null): string {
  const base = `Olá. Os arquivos finais de ${projeto} estão nesta pasta.`;
  const texto = urlArea ? `${base} Tudo do seu projeto com a ZRO também fica na sua área: ${urlArea}` : base;
  return texto.slice(0, 400);
}

export async function liberarEntregas(
  projectId: string,
  userId: string,
): Promise<{ ok: true; publico: boolean; emailAvisado: string | null; areaCriada: boolean } | { ok: false; mensagem: string }> {
  const projeto = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!projeto) return { ok: false, mensagem: "Projeto não encontrado." };
  if (!projeto.clientId) return { ok: false, mensagem: "Projeto sem cliente." };
  const cliente = await db.query.clients.findFirst({ where: eq(clients.id, projeto.clientId) });
  if (!cliente) return { ok: false, mensagem: "Projeto sem cliente." };

  const r = await garantirPastasDoProjeto(projectId, { userId });
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  const dp = await db.query.driveProjetos.findFirst({ where: eq(driveProjetos.id, r.driveProjetoId) });
  if (!dp?.entregasId) return { ok: false, mensagem: "A pasta 06 Entregas não existe. Use Tentar de novo na aba Drive." };
  const entregasId = dp.entregasId;

  // A área do cliente: criada sem senha só se nunca existiu (uma área desativada continua desativada).
  const antes = await areaDoCliente(cliente.id, { criar: false, userId });
  const area = antes.ok && !antes.link ? await areaDoCliente(cliente.id, { criar: true, userId }) : antes;
  const areaCriada = antes.ok && !antes.link && area.ok && Boolean(area.link);
  const urlArea = area.ok && area.link?.estado === "ativo" ? area.link.url : null;

  const ativas = await db
    .select()
    .from(driveCompartilhamentos)
    .where(
      and(
        eq(driveCompartilhamentos.arquivoId, entregasId),
        eq(driveCompartilhamentos.motivo, "entregas"),
        isNull(driveCompartilhamentos.revogadoEm),
        isNotNull(driveCompartilhamentos.permissaoId),
      ),
    );
  const registro = { motivo: "entregas", arquivoId: entregasId, projectId, clientId: cliente.id, driveProjetoId: dp.id, criadoPorId: userId };

  // 1. Link público só em 06 Entregas.
  let publico = ativas.some((a) => a.tipo === "anyone");
  let erroPublico: string | null = null;
  if (!publico) {
    try {
      const permissaoId = await criarPermissao({ arquivoId: entregasId, tipo: "anyone", papel: "reader" });
      await db.insert(driveCompartilhamentos).values({ ...registro, tipo: "anyone", papel: "reader", permissaoId });
      publico = true;
    } catch (e) {
      erroPublico = mensagemDe(e);
      await db.insert(driveCompartilhamentos).values({ ...registro, tipo: "anyone", papel: "reader", erro: erroPublico });
    }
  }

  // 2. O e-mail do cliente no CRM, com o aviso do próprio Google.
  let emailAvisado: string | null = null;
  const email = cliente.email?.trim().toLowerCase();
  if (email && z.email().safeParse(email).success) {
    if (ativas.some((a) => a.tipo === "user" && a.email === email)) {
      emailAvisado = null; // já tinha acesso: o Google não manda outro e-mail
    } else {
      try {
        const permissaoId = await criarPermissao({
          arquivoId: entregasId,
          tipo: "user",
          papel: "reader",
          email,
          avisar: true,
          mensagem: mensagemDoEmailDeEntrega(projeto.title, urlArea),
        });
        await db.insert(driveCompartilhamentos).values({ ...registro, tipo: "user", papel: "reader", email, avisouPorEmail: true, permissaoId });
        emailAvisado = email;
      } catch (e) {
        await db.insert(driveCompartilhamentos).values({
          ...registro,
          tipo: "user",
          papel: "reader",
          email,
          erro: mensagemDe(e),
        });
      }
    }
  }

  if (!publico) return { ok: false, mensagem: erroPublico ?? BLOQUEADO };

  await db.update(driveProjetos).set({ entregasLiberadasEm: new Date(), entregasLiberadasPorId: userId }).where(eq(driveProjetos.id, dp.id));
  await logProjectActivity(
    projectId,
    "arquivos",
    `Entregas liberadas para o cliente.${emailAvisado ? ` ${emailAvisado} avisado pelo Google.` : ""}`,
    userId,
  );
  return { ok: true, publico, emailAvisado, areaCriada };
}

/** Desfaz pelas permissões registradas. Os arquivos continuam no Drive. */
export async function recolherEntregas(projectId: string, userId: string): Promise<{ ok: true; removidas: number } | { ok: false; mensagem: string }> {
  const registros = await db
    .select()
    .from(driveCompartilhamentos)
    .where(
      and(eq(driveCompartilhamentos.projectId, projectId), eq(driveCompartilhamentos.motivo, "entregas"), isNull(driveCompartilhamentos.revogadoEm)),
    );
  let removidas = 0;
  for (const r of registros) {
    if (r.permissaoId) {
      try {
        await removerPermissao(r.arquivoId, r.permissaoId);
      } catch (e) {
        return { ok: false, mensagem: mensagemDe(e) };
      }
      removidas++;
    }
    await db.update(driveCompartilhamentos).set({ revogadoEm: new Date(), revogadoPorId: userId }).where(eq(driveCompartilhamentos.id, r.id));
  }
  await db
    .update(driveProjetos)
    .set({ entregasLiberadasEm: null, entregasLiberadasPorId: null })
    .where(eq(driveProjetos.projectId, projectId));
  await logProjectActivity(projectId, "arquivos", "Entregas recolhidas.", userId);
  return { ok: true, removidas };
}

export async function compartilhamentosDoProjeto(projectId: string): Promise<CompartilhamentoDTO[]> {
  const rows = await db
    .select()
    .from(driveCompartilhamentos)
    .where(eq(driveCompartilhamentos.projectId, projectId))
    .orderBy(desc(driveCompartilhamentos.criadoEm));
  return rows.map(paraDTO);
}

const cacheEntregas = new Map<string, { em: number; itens: EntregaArquivo[] }>();

/**
 * Arquivos de 06 Entregas (id lido DO BANCO, nunca do navegador). Até 3 níveis e 500 itens.
 * Seção = a primeira pasta (Master, Redes, Legendas). Cache de 60 s por id.
 */
export async function entregasDoProjeto(driveProjetoId: string): Promise<EntregaArquivo[]> {
  const dp = await db.query.driveProjetos.findFirst({ where: eq(driveProjetos.id, driveProjetoId), columns: { entregasId: true } });
  const raiz = dp?.entregasId;
  if (!raiz) return [];
  const guardado = cacheEntregas.get(raiz);
  if (guardado && Date.now() - guardado.em < 60_000) return guardado.itens;

  const itens: EntregaArquivo[] = [];
  const fila: { id: string; caminho: string[] }[] = [{ id: raiz, caminho: [] }];
  while (fila.length && itens.length < 500) {
    const pasta = fila.shift()!;
    let pagina: string | null = null;
    do {
      const r = await listarPasta(pasta.id, pagina);
      for (const it of r.itens) {
        if (it.pasta) {
          if (pasta.caminho.length < 2) fila.push({ id: it.id, caminho: [...pasta.caminho, it.nome] });
          continue;
        }
        const primeira = pasta.caminho[0] ?? null;
        itens.push({
          id: it.id,
          nome: it.nome,
          secao: (SECOES_ENTREGAS as readonly string[]).includes(primeira ?? "") ? (primeira as EntregaArquivo["secao"]) : null,
          caminho: pasta.caminho.join("/"),
          tamanho: it.tamanho,
          modificadoEm: it.modificadoEm,
          baixarUrl: it.baixarUrl,
          verUrl: it.verUrl,
        });
        if (itens.length >= 500) break;
      }
      pagina = r.proxima;
    } while (pagina && itens.length < 500);
  }
  cacheEntregas.set(raiz, { em: Date.now(), itens });
  if (cacheEntregas.size > 200) cacheEntregas.delete(cacheEntregas.keys().next().value!);
  return itens;
}

/* ============================== Acesso da equipe (Ajustes) ============================== */

/** Edição na pasta raiz para o e-mail Google do Victor ou do Edu, sem e-mail de aviso. */
export async function darAcessoEquipe(email: string, userId: string): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const limpo = email.trim().toLowerCase();
  if (!z.email().safeParse(limpo).success) return { ok: false, mensagem: "Digite um e-mail válido." };
  try {
    const { raizId } = await garantirRaiz();
    const [ja] = await db
      .select({ id: driveCompartilhamentos.id })
      .from(driveCompartilhamentos)
      .where(
        and(
          eq(driveCompartilhamentos.motivo, "equipe"),
          eq(driveCompartilhamentos.arquivoId, raizId),
          eq(driveCompartilhamentos.email, limpo),
          isNull(driveCompartilhamentos.revogadoEm),
        ),
      )
      .limit(1);
    if (ja) return { ok: true };
    const permissaoId = await criarPermissao({ arquivoId: raizId, tipo: "user", papel: "writer", email: limpo, avisar: false });
    await db.insert(driveCompartilhamentos).values({
      motivo: "equipe",
      arquivoId: raizId,
      permissaoId,
      tipo: "user",
      papel: "writer",
      email: limpo,
      criadoPorId: userId,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: mensagemDe(e) };
  }
}

export async function tirarAcessoEquipe(compartilhamentoId: string, userId: string): Promise<void> {
  const r = await db.query.driveCompartilhamentos.findFirst({
    where: and(eq(driveCompartilhamentos.id, compartilhamentoId), eq(driveCompartilhamentos.motivo, "equipe")),
  });
  if (!r || r.revogadoEm) return;
  if (r.permissaoId) await removerPermissao(r.arquivoId, r.permissaoId);
  await db.update(driveCompartilhamentos).set({ revogadoEm: new Date(), revogadoPorId: userId }).where(eq(driveCompartilhamentos.id, r.id));
}

/** Acessos da equipe ativos (Ajustes). */
export async function acessosDaEquipe(): Promise<CompartilhamentoDTO[]> {
  const rows = await db
    .select()
    .from(driveCompartilhamentos)
    .where(and(eq(driveCompartilhamentos.motivo, "equipe"), isNull(driveCompartilhamentos.revogadoEm)))
    .orderBy(desc(driveCompartilhamentos.criadoEm));
  return rows.map(paraDTO);
}
