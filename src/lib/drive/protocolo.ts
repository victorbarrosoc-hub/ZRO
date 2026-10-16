/**
 * Protocolo de envio para o Drive: um contrato só para o painel, o freela e o cliente (docs/dev/drive.md §5).
 * Puro (tipos, zod, mensagens e as contas de Range): roda no navegador e no servidor.
 *
 *   lote → iniciar (até 50) → PUT do navegador direto no Google → conferir → fecharLote
 */
import { z } from "zod";

/** Todo pedaço, menos o último, é múltiplo disto (regra do Google). */
export const ALINHAMENTO = 256 * 1024;
/** Teto do JSON das rotas. */
export const MAX_CORPO = 64 * 1024;
/** Arquivos por iniciar/conferir/cancelar. */
export const MAX_POR_PEDIDO = 50;
export const MAX_POR_LOTE = 20_000;
/** Teto do Drive por arquivo (5 TB). */
export const MAX_TAMANHO = 5 * 1024 ** 4;

export type FonteChave = "cam-a" | "cam-b" | "cam-c" | "drone" | "cam-e" | "foto" | "gravador";

export type Destino =
  | { tipo: "pasta"; pastaId: string } // painel
  | {
      tipo: "cartao";
      fonte: FonteChave;
      pessoa: { freelancerId: string } | { nome: string };
      gravador?: string;
      cartaoNome?: string;
      decisao?: "continuar" | "novo";
      continuarLoteId?: string;
    } // freela
  | { tipo: "cliente"; projetoId: string | null; assunto: string; consentimento: true }; // cliente

export type PedidoLote = { op: "lote"; destino: Destino; arquivos: number; bytes: number; impressao: string };
export type RespLote =
  | { ok: true; loteId: string; rotulo: string; caminho: string; retomado: boolean }
  | { ok: true; pergunta: { loteId: string; rotulo: string; arquivos: number; bytes: number } };

export type ArquivoPedido = { chave: string; nome: string; caminho: string; tamanho: number; tipo: string; modificado?: number };
export type PedidoIniciar = { op: "iniciar"; loteId: string; arquivos: ArquivoPedido[] }; // 1..50
export type ResultadoIniciar =
  | { chave: string; ok: true; envioId: string; estado: "enviar"; sessao: string; offset: number; retomado: boolean }
  | { chave: string; ok: true; envioId: string; estado: "concluido"; jaRecebido: boolean }
  | { chave: string; ok: false; erro: CodigoErro; mensagem: string };
export type RespIniciar = { ok: true; resultados: ResultadoIniciar[] };

export type PedidoConferir = { op: "conferir"; envioIds: string[] }; // 1..50
export type ResultadoConferir = { envioId: string } & (
  | { estado: "concluido" }
  | { estado: "parcial"; offset: number }
  | { estado: "expirado" }
  | { estado: "falhou"; mensagem: string }
  | { estado: "cancelado" }
);
export type RespConferir = { ok: true; resultados: ResultadoConferir[] };

export type PedidoCancelar = { op: "cancelar"; envioIds: string[] };
export type RespCancelar = { ok: true; cancelados: number; concluidos: number };
export type PedidoFecharLote = { op: "fecharLote"; loteId: string };
export type RespFecharLote = { ok: true; estado: "concluido" | "parcial" | "cancelado"; arquivos: number; bytes: number; faltam: number };

// Só painel, só o teste de Ajustes
export type PedidoDiagnostico = { op: "diagnostico"; envioId: string; resultado: ResultadoDiagnostico };
export type RespDiagnostico = { ok: true; registro: DiagnosticoRegistro };
export type ResultadoDiagnostico = {
  preflight: boolean;
  viu308: boolean;
  rangeLegivel: boolean;
  finalLegivel: boolean;
  host: string;
  navegador: string;
};
export type DiagnosticoRegistro = ResultadoDiagnostico & { em: string; ok: boolean; conferido: boolean };

export type CodigoErro =
  | "sem_acesso"
  | "formato"
  | "sem_google"
  | "reconectar"
  | "pasta"
  | "sem_espaco"
  | "limite_diario"
  | "limite_link"
  | "link_inativo"
  | "senha"
  | "muitas_tentativas"
  | "nao_encontrado"
  | "conferencia"
  | "consentimento"
  | "google";
export type RespErro = { ok: false; erro: CodigoErro; mensagem: string; cabem?: number };

export type Pedido = PedidoLote | PedidoIniciar | PedidoConferir | PedidoCancelar | PedidoFecharLote | PedidoDiagnostico;
export type Op = Pedido["op"];
export type Voz = "painel" | "publico";

/* ============================== Mensagens ============================== */

const INDISPONIVEL = "Não dá para receber arquivos agora. Avise a ZRO.";

/** O servidor escolhe a voz pelo escopo (painel ou página pública). */
export const MENSAGENS: { painel: Record<CodigoErro, string>; publico: Record<CodigoErro, string> } = {
  painel: {
    sem_acesso: "Sua sessão expirou. Entre de novo para continuar.",
    formato: "Pedido inválido. Recarregue a página e tente de novo.",
    sem_google: "Google Drive desconectado. Conecte em Ajustes.",
    reconectar: "A conexão com o Google expirou. Reconecte em Ajustes.",
    pasta: "A pasta não existe mais no Drive.",
    sem_espaco: "O Drive está cheio. Libere espaço e tente de novo.",
    limite_diario: "O Google limita 750 GB de envio por dia. Libera em até 24 horas.",
    limite_link: "Este envio passa do limite do link.",
    link_inativo: "Este link não está mais ativo.",
    senha: "Digite a senha de novo para continuar.",
    muitas_tentativas: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
    nao_encontrado: "Este envio não existe mais. Recarregue a página.",
    conferencia: "O Drive recebeu um arquivo diferente do declarado.",
    consentimento: "Falta o consentimento para receber os arquivos.",
    google: "O Google recusou. Tente de novo.",
  },
  publico: {
    sem_acesso: "Recarregue a página para continuar.",
    formato: "Não deu para entender o pedido. Recarregue a página.",
    sem_google: INDISPONIVEL,
    reconectar: INDISPONIVEL,
    pasta: INDISPONIVEL,
    sem_espaco: INDISPONIVEL,
    limite_diario: "Muito material hoje. Tente de novo amanhã ou avise a ZRO.",
    limite_link: "Este link chegou ao limite de envio.",
    link_inativo: "Este link não está mais ativo. Peça um novo para a ZRO.",
    senha: "Digite a senha da área para continuar.",
    muitas_tentativas: "Muitas tentativas. Espere 15 minutos e tente de novo.",
    nao_encontrado: "Este envio não existe mais. Recarregue a página.",
    conferencia: "Não deu para conferir este arquivo. Toque em Tentar de novo.",
    consentimento: "Precisamos do seu ok para receber os arquivos.",
    google: "Não deu para enviar agora. Tente de novo em instantes.",
  },
};

/** Status HTTP de cada erro (§5). */
export const STATUS_DO_ERRO: Record<CodigoErro, number> = {
  formato: 400,
  consentimento: 400,
  sem_acesso: 401, // o painel sem sessão; a rota usa 403 para Origin
  senha: 403,
  nao_encontrado: 404,
  link_inativo: 409,
  limite_link: 413,
  muitas_tentativas: 429,
  limite_diario: 429,
  sem_google: 503,
  reconectar: 503,
  google: 503,
  pasta: 503,
  conferencia: 409,
  sem_espaco: 507,
};

/* ============================== Range e Content-Range ============================== */

/** "bytes=0-N" → N+1 (o próximo byte). Ausente ou ilegível → null (desconhecido, nunca zero). */
export function lerRange(header: string | null | undefined): number | null {
  const m = /bytes\s*=\s*(\d+)\s*-\s*(\d+)/i.exec(header ?? "");
  return m ? Number(m[2]) + 1 : null;
}

/** Content-Range de um pedaço [inicio, fim) de um arquivo de `total` bytes. */
export function contentRange(inicio: number, fim: number, total: number): string {
  return `bytes ${inicio}-${fim - 1}/${total}`;
}

/** Content-Range da consulta de status ("quanto você já tem?"). */
export function consultaRange(total: number): string {
  return `bytes */${total}`;
}

/** Pedaço múltiplo de 256 KiB (no mínimo um). */
export function pedacoAlinhado(bytes: number): number {
  return Math.max(ALINHAMENTO, Math.floor(bytes / ALINHAMENTO) * ALINHAMENTO);
}

/** Fim (exclusivo) do próximo pedaço: `offset + pedaco`, sem passar do total. */
export function fimDoPedaco(offset: number, pedaco: number, total: number): number {
  return Math.min(offset + pedacoAlinhado(pedaco), total);
}

/** Um pedaço que não é o último precisa ter tamanho múltiplo de 256 KiB. */
export function pedacoValido(inicio: number, fim: number, total: number): boolean {
  if (fim <= inicio || fim > total) return false;
  return fim === total || (fim - inicio) % ALINHAMENTO === 0;
}

/** Texto do limite do link: "Este link aceita até 50 GB. Ainda cabem 12 GB." (`bytesBR` vem de bytes.ts). */
export function textoLimiteLink(limite: string, cabem: string): string {
  return `Este link aceita até ${limite}. Ainda cabem ${cabem}.`;
}

/** Texto do limite diário da área do cliente. */
export function textoLimiteDiario(cabem: string): string {
  return `Hoje dá para enviar mais ${cabem}. O limite volta amanhã.`;
}

/* ============================== Esquemas (zod) ============================== */

const idEnvio = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const idDrive = z.string().regex(/^(root|[A-Za-z0-9_-]{10,128})$/);
const inteiro = (max: number) => z.number().int().min(0).max(max);

const destino = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("pasta"), pastaId: idDrive }).strict(),
  z
    .object({
      tipo: z.literal("cartao"),
      fonte: z.enum(["cam-a", "cam-b", "cam-c", "drone", "cam-e", "foto", "gravador"]),
      pessoa: z.union([
        z.object({ freelancerId: z.string().min(1).max(64) }).strict(),
        z.object({ nome: z.string().max(200) }).strict(),
      ]),
      gravador: z.string().max(200).optional(),
      cartaoNome: z.string().max(255).optional(),
      decisao: z.enum(["continuar", "novo"]).optional(),
      continuarLoteId: idEnvio.optional(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("cliente"),
      projetoId: z.string().min(1).max(64).nullable(),
      assunto: z.string().max(200),
      consentimento: z.literal(true),
    })
    .strict(),
]);

const arquivo = z
  .object({
    chave: z.string().min(1).max(200),
    nome: z.string().min(1).max(1000),
    caminho: z.string().max(4096),
    tamanho: inteiro(MAX_TAMANHO),
    tipo: z.string().max(255),
    modificado: inteiro(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();

const resultadoDiagnostico = z
  .object({
    preflight: z.boolean(),
    viu308: z.boolean(),
    rangeLegivel: z.boolean(),
    finalLegivel: z.boolean(),
    host: z.string().max(200),
    navegador: z.string().max(80),
  })
  .strict();

export const esquemas = {
  lote: z
    .object({
      op: z.literal("lote"),
      destino,
      arquivos: z.number().int().min(1).max(MAX_POR_LOTE),
      bytes: inteiro(Number.MAX_SAFE_INTEGER),
      impressao: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict(),
  iniciar: z
    .object({ op: z.literal("iniciar"), loteId: idEnvio, arquivos: z.array(arquivo).min(1).max(MAX_POR_PEDIDO) })
    .strict(),
  conferir: z.object({ op: z.literal("conferir"), envioIds: z.array(idEnvio).min(1).max(MAX_POR_PEDIDO) }).strict(),
  cancelar: z.object({ op: z.literal("cancelar"), envioIds: z.array(idEnvio).min(1).max(MAX_POR_PEDIDO) }).strict(),
  fecharLote: z.object({ op: z.literal("fecharLote"), loteId: idEnvio }).strict(),
  diagnostico: z.object({ op: z.literal("diagnostico"), envioId: idEnvio, resultado: resultadoDiagnostico }).strict(),
} as const;

// Os tipos escritos à mão (contrato dos blocos) e os esquemas andam juntos.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _confere: [
  Igual<z.infer<typeof esquemas.lote>, PedidoLote>,
  Igual<z.infer<typeof esquemas.iniciar>, PedidoIniciar>,
  Igual<z.infer<typeof esquemas.conferir>, PedidoConferir>,
  Igual<z.infer<typeof esquemas.cancelar>, PedidoCancelar>,
  Igual<z.infer<typeof esquemas.fecharLote>, PedidoFecharLote>,
  Igual<z.infer<typeof esquemas.diagnostico>, PedidoDiagnostico>,
] = [true, true, true, true, true, true];
void _confere;

export function ehOp(op: unknown): op is Op {
  return typeof op === "string" && Object.prototype.hasOwnProperty.call(esquemas, op);
}

/** Erro padrão no formato do protocolo. */
export function respErro(erro: CodigoErro, voz: Voz, mensagem?: string, cabem?: number): RespErro {
  const r: RespErro = { ok: false, erro, mensagem: mensagem ?? MENSAGENS[voz][erro] };
  if (cabem != null) r.cabem = cabem;
  return r;
}
