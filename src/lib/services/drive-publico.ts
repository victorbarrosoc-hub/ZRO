import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FUNCTIONS, optionLabel } from "@/lib/domain";
import { rotuloDiaria } from "@/lib/drive/estrutura";
import { bytesDoLink, inicioDoDia } from "@/lib/drive/limites";
import { dateLong, monthLong, todayISO, weekdayShort } from "@/lib/format";
import { contaAtual, driveConectado } from "@/lib/google/conexao";
import { ehPrevia } from "@/lib/google/previa";
import { getSetting } from "@/lib/settings";
import { entregasDoProjeto, type EntregaArquivo } from "./drive-entregas";
import { areaPedeSenha, buscarLinkPorToken, estadoDoLink, type TipoLink } from "./drive-links";

/**
 * Dados das páginas públicas /enviar/<token> e /cliente/<token> (docs/dev/drive.md §8.1).
 * A área só lista projetos do cliente do link, não cancelados, com pastas na conta atual; as entregas
 * só vêm depois de "Liberar entregas". Nenhum id de pasta vem do navegador. O freela aparece como
 * "Rafael M." (telefone, e-mail e CPF nunca saem daqui).
 */

const { driveDiarias, driveLotes, driveProjetos, events, eventCrew, freelancers, projects, clients } = schema;

export type DadosDiaria = {
  projeto: string;
  diaria: { nome: string /* "Diária 02" */; data: string; dataLonga: string };
  pessoas: { id: string; rotulo: string /* "Rafael M." */; funcao: string | null }[];
  /** Já usados no projeto, para sugerir. */
  gravadores: string[];
  limite: { bytes: number; usados: number } | null;
  expiraEm: string | null;
};

export type DadosArea = {
  cliente: string;
  googleOk: boolean;
  projetos: { id: string; titulo: string; mes: string /* "março de 2026" */; liberado: boolean; entregas: EntregaArquivo[] }[];
  /** Últimos 10. */
  envios: { data: string; assunto: string; projeto: string | null; arquivos: number; bytes: number }[];
  limiteDiario: number | null;
  enviadoHoje: number;
};

export type LinkPublico =
  | { estado: "expirado" | "desativado" | "indisponivel"; whatsapp: string | null }
  | { estado: "senha"; linkId: string }
  | { estado: "ok"; tipo: "freela-diaria"; linkId: string; diaria: DadosDiaria }
  | { estado: "ok"; tipo: "cliente-area"; linkId: string; area: DadosArea };

/** "Rafael Moura" → "Rafael M." */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return partes[0] ?? "";
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

const DIAS = { dom: "domingo", seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", "sáb": "sábado" } as Record<string, string>;

/** "quinta, 12 de março" */
function dataLonga(iso: string): string {
  const semAno = dateLong(iso).replace(/ de \d{4}$/, "");
  return `${DIAS[weekdayShort(iso)] ?? weekdayShort(iso)}, ${semAno}`;
}

/** null = token fora do formato, não achado ou de outro tipo (a página dá 404). */
export async function abrirLinkPublico(token: string, tipo: TipoLink): Promise<LinkPublico | null> {
  if (ehPrevia()) return null;
  const link = await buscarLinkPorToken(token, tipo);
  if (!link) return null;
  const whatsapp = (await getSetting("whatsapp")).number || null;
  const estado = estadoDoLink(link);
  if (estado === "desativado") return { estado: "desativado", whatsapp };
  if (estado === "expirado") return { estado: "expirado", whatsapp };

  if (tipo === "freela-diaria") {
    const evento = link.eventId ? await db.query.events.findFirst({ where: eq(events.id, link.eventId) }) : undefined;
    const projeto = evento?.projectId ? await db.query.projects.findFirst({ where: eq(projects.id, evento.projectId) }) : undefined;
    if (!evento || !projeto || !(await driveConectado())) return { estado: "indisponivel", whatsapp };
    const d = link.diariaId ? await db.query.driveDiarias.findFirst({ where: eq(driveDiarias.id, link.diariaId) }) : undefined;
    const equipe = await db
      .select({ id: freelancers.id, nome: freelancers.name, funcao: eventCrew.function })
      .from(eventCrew)
      .innerJoin(freelancers, eq(freelancers.id, eventCrew.freelancerId))
      .where(eq(eventCrew.eventId, evento.id));
    const gravadores = await db
      .selectDistinct({ g: driveLotes.gravador })
      .from(driveLotes)
      .where(and(eq(driveLotes.projectId, projeto.id), eq(driveLotes.fonte, "gravador")));
    const usados = link.limiteBytes != null ? await bytesDoLink(link.id) : 0;
    return {
      estado: "ok",
      tipo: "freela-diaria",
      linkId: link.id,
      diaria: {
        projeto: projeto.title,
        diaria: { nome: d ? rotuloDiaria(d.numero) : "Diária", data: evento.date, dataLonga: dataLonga(evento.date) },
        pessoas: equipe
          .map((p) => ({ id: p.id, rotulo: nomeCurto(p.nome), funcao: p.funcao ? optionLabel(FUNCTIONS, p.funcao) : null }))
          .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
        gravadores: gravadores.map((g) => g.g).filter((g): g is string => !!g).sort(),
        limite: link.limiteBytes != null ? { bytes: link.limiteBytes, usados } : null,
        expiraEm: link.expiraEm ? link.expiraEm.toISOString() : null,
      },
    };
  }

  // Área do cliente.
  if (!link.clientId) return { estado: "indisponivel", whatsapp };
  if (await areaPedeSenha(link)) return { estado: "senha", linkId: link.id };
  const cliente = await db.query.clients.findFirst({ where: eq(clients.id, link.clientId), columns: { id: true, name: true } });
  if (!cliente) return { estado: "indisponivel", whatsapp };

  const conectado = await driveConectado();
  const conta = conectado ? await contaAtual() : null;
  const linhas = conta
    ? await db
        .select({
          id: projects.id,
          titulo: projects.title,
          inicio: projects.startDate,
          criadoEm: projects.createdAt,
          driveProjetoId: driveProjetos.id,
          liberadas: driveProjetos.entregasLiberadasEm,
        })
        .from(projects)
        .innerJoin(driveProjetos, and(eq(driveProjetos.projectId, projects.id), eq(driveProjetos.conta, conta.conta)))
        .where(and(eq(projects.clientId, cliente.id), ne(projects.status, "cancelado")))
        .orderBy(desc(projects.startDate), desc(projects.createdAt))
    : [];
  let googleOk = conectado;
  const projetosArea: DadosArea["projetos"] = [];
  for (const p of linhas) {
    let entregas: EntregaArquivo[] = [];
    if (p.liberadas && googleOk) {
      try {
        entregas = await entregasDoProjeto(p.driveProjetoId);
      } catch {
        googleOk = false;
      }
    }
    projetosArea.push({
      id: p.id,
      titulo: p.titulo,
      mes: monthLong((p.inicio ?? todayISO(p.criadoEm)).slice(0, 7)),
      liberado: Boolean(p.liberadas),
      entregas,
    });
  }
  const enviados = await db
    .select({
      criadoEm: driveLotes.criadoEm,
      assunto: driveLotes.assunto,
      rotulo: driveLotes.rotulo,
      projeto: projects.title,
      arquivos: driveLotes.arquivosRecebidos,
      bytes: driveLotes.bytesRecebidos,
    })
    .from(driveLotes)
    .leftJoin(projects, eq(projects.id, driveLotes.projectId))
    .where(and(eq(driveLotes.clientId, cliente.id), eq(driveLotes.origem, "cliente"), ne(driveLotes.estado, "cancelado")))
    .orderBy(desc(driveLotes.criadoEm))
    .limit(10);
  return {
    estado: "ok",
    tipo: "cliente-area",
    linkId: link.id,
    area: {
      cliente: cliente.name,
      googleOk,
      projetos: projetosArea,
      envios: enviados.map((e) => ({
        data: todayISO(e.criadoEm),
        assunto: e.assunto ?? e.rotulo,
        projeto: e.projeto ?? null,
        arquivos: e.arquivos,
        bytes: e.bytes,
      })),
      limiteDiario: link.limiteBytes,
      enviadoHoje: link.limiteBytes != null ? await bytesDoLink(link.id, inicioDoDia()) : 0,
    },
  };
}
