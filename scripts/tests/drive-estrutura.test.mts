/** Estrutura de pastas e fontes (puro). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { bytesBR, tempoBR, velocidadeBR } from "../../src/lib/drive/bytes";
import {
  ARQUIVOS_DA_EMPRESA,
  CLIENTES,
  DO_CLIENTE,
  ESTRUTURA,
  FONTES,
  acharFonte,
  nomeDiaria,
  nomePastaAssunto,
  nomePastaCamera,
  nomePastaGravador,
  nomePastaProjeto,
  rotuloDiaria,
  rotuloRolo,
} from "../../src/lib/drive/estrutura";

test("os nomes exatos das 7 pastas e das subpastas", () => {
  assert.deepEqual(
    ESTRUTURA.map((p) => p.nome),
    ["00 Documentos", "01 Cenas", "02 Áudios", "03 Assets", "04 Projeto", "05 Render", "06 Entregas"],
  );
  const subs = Object.fromEntries(ESTRUTURA.filter((p) => "sub" in p).map((p) => [p.nome, [...(p as { sub: readonly string[] }).sub]]));
  assert.deepEqual(subs, {
    "03 Assets": ["Do cliente", "Trilha e SFX", "Gráficos"],
    "04 Projeto": ["Edição", "Color", "Som", "Motion"],
    "06 Entregas": ["Master", "Redes", "Legendas"],
  });
  assert.equal(CLIENTES, "Clientes");
  assert.equal(ARQUIVOS_DA_EMPRESA, "Arquivos da empresa");
  assert.equal(DO_CLIENTE, "03 Assets/Do cliente");
});

test("fontes e letras dos rolos", () => {
  assert.deepEqual(
    FONTES.map((f) => [f.chave, f.letra]),
    [
      ["cam-a", "A"],
      ["cam-b", "B"],
      ["cam-c", "C"],
      ["drone", "D"],
      ["cam-e", "E"],
      ["foto", "F"],
      ["gravador", null],
    ],
  );
  assert.equal(acharFonte("drone")?.rotulo, "Drone");
  assert.equal(acharFonte("xyz"), null);
});

test("rotuloRolo: 3 dígitos e passa de 999 sem cortar", () => {
  assert.equal(rotuloRolo("A", 1), "A001");
  assert.equal(rotuloRolo("D", 42), "D042");
  assert.equal(rotuloRolo("A", 999), "A999");
  assert.equal(rotuloRolo("A", 1000), "A1000");
});

test("nomes de pasta da ZRO", () => {
  assert.equal(nomePastaProjeto("2026-03", "Verão Pipa"), "2026-03 · Verão Pipa");
  assert.equal(nomePastaProjeto("2026-03", "Pipa/Tibau: verão"), "2026-03 · Pipa-Tibau- verão");
  assert.equal(nomeDiaria("2026-03-12", 2), "2026-03-12 · Diária 02");
  assert.equal(nomeDiaria("2026-03-12", 12), "2026-03-12 · Diária 12");
  assert.equal(rotuloDiaria(3), "Diária 03");
  assert.equal(nomePastaCamera("Câm A", "Rafael Moura"), "Câm A · Rafael Moura");
  assert.equal(nomePastaGravador("Zoom F6", "Carla Dias"), "Zoom F6 · Carla Dias");
  assert.equal(nomePastaAssunto("2026-03-13", "Manual de marca"), "2026-03-13 · Manual de marca");
});

test("bytesBR, velocidadeBR e tempoBR (base 1000, como os cartões)", () => {
  assert.equal(bytesBR(0), "0 B");
  assert.equal(bytesBR(512), "512 B");
  assert.equal(bytesBR(12_000_000), "12 MB");
  assert.equal(bytesBR(212_400_000_000), "212,4 GB");
  assert.equal(bytesBR(3_140_000_000), "3,1 GB");
  assert.equal(bytesBR(1_200_000_000_000), "1,2 TB");
  assert.equal(bytesBR(999_960_000), "1 GB");
  assert.equal(velocidadeBR(42_000_000), "42 MB/s");
  assert.equal(velocidadeBR(1_500_000), "1,5 MB/s");
  assert.equal(velocidadeBR(850_000), "850 KB/s");
  assert.equal(tempoBR(30), "menos de 1 min");
  assert.equal(tempoBR(52 * 60), "52 min");
  assert.equal(tempoBR(2 * 3600), "2 h");
  assert.equal(tempoBR(2 * 3600 + 10 * 60), "2 h 10 min");
});
