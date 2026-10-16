/**
 * Nomes e ids do Drive (puro: navegador, servidor e testes).
 *
 * - Arquivos e pastas DE DENTRO do cartão nunca são renomeados: só saem caracteres de controle e de
 *   direção (bidi), que câmera nenhuma gera e que servem de golpe ("orcamento‮fdp.exe").
 * - Pastas criadas pela ZRO (cliente, projeto, diária, câmera…) ganham nome limpo para Drive, Mac e Windows.
 */

// Controle C0, DEL, marcas e embutidos de direção, isolados de direção e o BOM.
const CONTROLES = /[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩﻿]/g;

/** Tira controle e bidi. `mudou` diz se precisou tirar algo (o nome original fica registrado). */
export function limparControles(s: string): { nome: string; mudou: boolean } {
  const nome = String(s ?? "").replace(CONTROLES, "");
  return { nome, mudou: nome !== String(s ?? "") };
}

/** Nome de arquivo do cartão: só `limparControles`. Vazio vira "arquivo". Nada mais muda. */
export function nomeDeArquivo(nome: string): { nome: string; mudou: boolean } {
  const limpo = limparControles(nome);
  if (!limpo.nome.trim()) return { nome: "arquivo", mudou: true };
  return limpo;
}

const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Nome de pasta criada pela ZRO: NFC, sem controle/bidi, sem `/ \ : * ? " < > |`, espaços juntos,
 * sem ponto ou espaço nas pontas, até `max` caracteres e sem nome reservado do Windows.
 */
export function nomePasta(nome: string, max = 120): string {
  let s = limparControles(String(nome ?? "").normalize("NFC")).nome;
  s = s.replace(/[/\\:*?"<>|]/g, "-");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[\s.]+|[\s.]+$/g, "");
  if (s.length > max) s = Array.from(s).slice(0, max).join("").replace(/[\s.]+$/g, "");
  if (RESERVADOS_WINDOWS.test(s)) s = `${s}_`;
  return s || "Sem nome";
}

/** "DCIM/100CANON" → ["DCIM", "100CANON"]. Sem vazios, sem "." e "..", sem controle/bidi, até 32 níveis. */
export function segmentosDoCaminho(caminho: string): string[] {
  return String(caminho ?? "")
    .split(/[/\\]/)
    .map((p) => limparControles(p).nome)
    .filter((p) => p.trim() !== "" && p !== "." && p !== "..")
    .slice(0, 32);
}

const LIXO_NOMES = new Set([".ds_store", "thumbs.db", "desktop.ini", ".localized"]);
const LIXO_PASTAS = new Set([
  ".spotlight-v100",
  ".trashes",
  ".fseventsd",
  ".temporaryitems",
  ".documentrevisions-v100",
  "system volume information",
  "$recycle.bin",
]);

/** Arquivos de sistema que não são material (.DS_Store, ._*, Thumbs.db, .Spotlight-V100…). */
export function ehLixoDoSistema(caminhoCompleto: string): boolean {
  const partes = String(caminhoCompleto ?? "")
    .split(/[/\\]/)
    .filter(Boolean);
  if (!partes.length) return false;
  const nome = partes[partes.length - 1].toLowerCase();
  if (LIXO_NOMES.has(nome) || nome.startsWith("._")) return true;
  return partes.some((p) => LIXO_PASTAS.has(p.toLowerCase()));
}

/** Valor dentro de aspas simples numa consulta do Drive (`name = '…'`). */
export function escaparConsulta(v: string): string {
  return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Id de arquivo/pasta do Drive (ou o apelido "root"). */
export function idDriveValido(id: unknown): id is string {
  return typeof id === "string" && (id === "root" || /^[A-Za-z0-9_-]{10,128}$/.test(id));
}

/** Id da pasta num link do Drive (".../folders/<id>", com /u/N/ e ?usp=… ou "?id=<id>"). */
export function idDePastaDoLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const texto = String(url).trim();
  const m = /\/folders\/([A-Za-z0-9_-]+)/.exec(texto);
  let id = m?.[1] ?? null;
  if (!id) {
    try {
      id = new URL(texto).searchParams.get("id");
    } catch {
      id = null;
    }
  }
  return id && id !== "root" && idDriveValido(id) ? id : null;
}

/** MIME aceito nos metadados da sessão. Inválido ou do Google (Docs, pasta…) vira octet-stream. */
export function tipoSeguro(t: string | null | undefined): string {
  const s = String(t ?? "").trim().toLowerCase();
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(s) || s.length > 200) return "application/octet-stream";
  if (s.startsWith("application/vnd.google-apps.")) return "application/octet-stream";
  return s;
}
