/**
 * Estrutura de pastas da ZRO no Drive e as fontes de material (puro).
 *
 *   ZRO/Clientes/<Cliente>/<AAAA-MM> · <Projeto>/
 *     00 Documentos · 01 Cenas · 02 Áudios · 03 Assets/ · 04 Projeto/ · 05 Render · 06 Entregas/
 *   ZRO/Clientes/<Cliente>/Arquivos da empresa
 *
 * Os nomes aqui são os mesmos em toda tela. Todos passam por `nomePasta`.
 */
import { nomePasta } from "./nomes";

export const ESTRUTURA = [
  { chave: "documentos", nome: "00 Documentos" },
  { chave: "cenas", nome: "01 Cenas" },
  { chave: "audios", nome: "02 Áudios" },
  { chave: "assets", nome: "03 Assets", sub: ["Do cliente", "Trilha e SFX", "Gráficos"] },
  { chave: "projetoEdicao", nome: "04 Projeto", sub: ["Edição", "Color", "Som", "Motion"] },
  { chave: "render", nome: "05 Render" },
  { chave: "entregas", nome: "06 Entregas", sub: ["Master", "Redes", "Legendas"] },
] as const;

export type ChaveEstrutura = (typeof ESTRUTURA)[number]["chave"];

export const CLIENTES = "Clientes";
export const SEM_CLIENTE = "Sem cliente";
export const ARQUIVOS_DA_EMPRESA = "Arquivos da empresa";
/** Chave de `drive_projetos.subpastas` onde cai o que o cliente manda. */
export const DO_CLIENTE = "03 Assets/Do cliente";
/** Seções de 06 Entregas, na ordem em que a área do cliente mostra. */
export const SECOES_ENTREGAS = ["Master", "Redes", "Legendas"] as const;

export const FONTES = [
  { chave: "cam-a", rotulo: "Câm A", letra: "A", tipo: "video" },
  { chave: "cam-b", rotulo: "Câm B", letra: "B", tipo: "video" },
  { chave: "cam-c", rotulo: "Câm C", letra: "C", tipo: "video" },
  { chave: "drone", rotulo: "Drone", letra: "D", tipo: "video" },
  { chave: "cam-e", rotulo: "Câm E", letra: "E", tipo: "video" },
  { chave: "foto", rotulo: "Foto", letra: "F", tipo: "video" }, // vai para 01 Cenas, com rolo F001
  { chave: "gravador", rotulo: "Gravador", letra: null, tipo: "audio" },
] as const;

export type Fonte = (typeof FONTES)[number];

export function acharFonte(chave: string | null | undefined): Fonte | null {
  return FONTES.find((f) => f.chave === chave) ?? null;
}

/** ("2026-03", "Verão Pipa") → "2026-03 · Verão Pipa" */
export function nomePastaProjeto(mes: string, titulo: string): string {
  return nomePasta(`${mes} · ${titulo}`);
}

/** ("2026-03-12", 2) → "2026-03-12 · Diária 02" */
export function nomeDiaria(data: string, numero: number): string {
  return nomePasta(`${data} · Diária ${String(numero).padStart(2, "0")}`);
}

/** "Diária 02" */
export function rotuloDiaria(numero: number): string {
  return `Diária ${String(numero).padStart(2, "0")}`;
}

/** ("Câm A", "Rafael Moura") → "Câm A · Rafael Moura" */
export function nomePastaCamera(rotuloFonte: string, pessoa: string): string {
  return nomePasta(`${rotuloFonte} · ${pessoa}`);
}

/** ("Zoom F6", "Carla Dias") → "Zoom F6 · Carla Dias" */
export function nomePastaGravador(gravador: string, pessoa: string): string {
  return nomePasta(`${gravador} · ${pessoa}`);
}

/** ("A", 3) → "A003"; passa de 999 sem cortar ("A1000"). */
export function rotuloRolo(letra: string, n: number): string {
  return `${letra}${String(n).padStart(3, "0")}`;
}

/** ("2026-03-13", "Manual de marca") → "2026-03-13 · Manual de marca" */
export function nomePastaAssunto(data: string, assunto: string): string {
  return nomePasta(`${data} · ${assunto}`);
}
