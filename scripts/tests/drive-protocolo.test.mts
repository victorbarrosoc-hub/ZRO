/** Contrato do envio (puro): esquemas, Range, Content-Range e alinhamento de 256 KiB. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALINHAMENTO,
  consultaRange,
  contentRange,
  ehOp,
  esquemas,
  fimDoPedaco,
  lerRange,
  MAX_POR_PEDIDO,
  MENSAGENS,
  pedacoAlinhado,
  pedacoValido,
  respErro,
  STATUS_DO_ERRO,
} from "../../src/lib/drive/protocolo";

const arquivo = (i: number, extra: Record<string, unknown> = {}) => ({
  chave: `k${i}`,
  nome: `C${i}.MP4`,
  caminho: "",
  tamanho: 1000,
  tipo: "video/mp4",
  ...extra,
});
const H = "a".repeat(64);

test("iniciar: até 50 arquivos por pedido", () => {
  const ok = esquemas.iniciar.safeParse({ op: "iniciar", loteId: "0b3c1c1e-1111-4222-8333-944445555666", arquivos: Array.from({ length: MAX_POR_PEDIDO }, (_, i) => arquivo(i)) });
  assert.equal(ok.success, true);
  const muitos = esquemas.iniciar.safeParse({ op: "iniciar", loteId: "0b3c1c1e-1111-4222-8333-944445555666", arquivos: Array.from({ length: 51 }, (_, i) => arquivo(i)) });
  assert.equal(muitos.success, false);
  const nenhum = esquemas.iniciar.safeParse({ op: "iniciar", loteId: "0b3c1c1e-1111-4222-8333-944445555666", arquivos: [] });
  assert.equal(nenhum.success, false);
});

test("iniciar: tamanho negativo, fracionado ou acima de 5 TB é recusado; campo a mais também", () => {
  for (const tamanho of [-1, 1.5, 6 * 1024 ** 4]) {
    const r = esquemas.iniciar.safeParse({ op: "iniciar", loteId: "0b3c1c1e-1111", arquivos: [arquivo(0, { tamanho })] });
    assert.equal(r.success, false, String(tamanho));
  }
  const extra = esquemas.iniciar.safeParse({ op: "iniciar", loteId: "0b3c1c1e-1111", arquivos: [arquivo(0, { pastaId: "x" })] });
  assert.equal(extra.success, false, "nenhum id de pasta vem do navegador");
});

test("iniciar: o tipo do Google passa no esquema (o servidor troca por octet-stream)", () => {
  const r = esquemas.iniciar.safeParse({ op: "iniciar", loteId: "0b3c1c1e-1111", arquivos: [arquivo(0, { tipo: "application/vnd.google-apps.document" })] });
  assert.equal(r.success, true);
});

test("lote: destinos válidos e inválidos", () => {
  const base = { op: "lote", arquivos: 1, bytes: 10, impressao: H };
  assert.equal(esquemas.lote.safeParse({ ...base, destino: { tipo: "pasta", pastaId: "root" } }).success, true);
  assert.equal(esquemas.lote.safeParse({ ...base, destino: { tipo: "pasta", pastaId: "../x" } }).success, false);
  assert.equal(esquemas.lote.safeParse({ ...base, destino: { tipo: "cartao", fonte: "cam-a", pessoa: { freelancerId: "f1" } } }).success, true);
  assert.equal(esquemas.lote.safeParse({ ...base, destino: { tipo: "cartao", fonte: "cam-z", pessoa: { nome: "Ana" } } }).success, false);
  assert.equal(esquemas.lote.safeParse({ ...base, destino: { tipo: "cliente", projetoId: null, assunto: "Logo", consentimento: true } }).success, true);
  const semOk = esquemas.lote.safeParse({ ...base, destino: { tipo: "cliente", projetoId: null, assunto: "Logo", consentimento: false } });
  assert.equal(semOk.success, false);
  assert.ok(!semOk.success && semOk.error.issues.some((i) => i.path.includes("consentimento")));
  assert.equal(esquemas.lote.safeParse({ ...base, impressao: "xyz", destino: { tipo: "pasta", pastaId: "root" } }).success, false);
  assert.equal(esquemas.lote.safeParse({ ...base, arquivos: 0, destino: { tipo: "pasta", pastaId: "root" } }).success, false);
});

test("conferir/cancelar: 1 a 50 ids; ops conhecidas", () => {
  assert.equal(esquemas.conferir.safeParse({ op: "conferir", envioIds: ["0b3c1c1e-1111"] }).success, true);
  assert.equal(esquemas.conferir.safeParse({ op: "conferir", envioIds: Array(51).fill("0b3c1c1e-1111") }).success, false);
  assert.equal(esquemas.cancelar.safeParse({ op: "cancelar", envioIds: ["'; drop table"] }).success, false);
  assert.equal(ehOp("lote"), true);
  assert.equal(ehOp("toString"), false);
  assert.equal(ehOp("__proto__"), false);
});

test("lerRange: o próximo byte; ausente ou ilegível é desconhecido (null), nunca zero", () => {
  assert.equal(lerRange("bytes=0-262143"), 262144);
  assert.equal(lerRange("bytes=0-0"), 1);
  assert.equal(lerRange(null), null);
  assert.equal(lerRange(undefined), null);
  assert.equal(lerRange(""), null);
  assert.equal(lerRange("lixo"), null);
});

test("Content-Range dos pedaços e da consulta", () => {
  assert.equal(contentRange(0, 262144, 300000), "bytes 0-262143/300000");
  assert.equal(contentRange(262144, 300000, 300000), "bytes 262144-299999/300000");
  assert.equal(consultaRange(300000), "bytes */300000");
});

test("pedaços múltiplos de 256 KiB, menos o último", () => {
  assert.equal(ALINHAMENTO, 262144);
  assert.equal(pedacoAlinhado(32 * 1024 * 1024), 32 * 1024 * 1024);
  assert.equal(pedacoAlinhado(300_000), 262144);
  assert.equal(pedacoAlinhado(1), 262144);
  const total = 1_000_000;
  let inicio = 0;
  const pedacos: [number, number][] = [];
  while (inicio < total) {
    const fim = fimDoPedaco(inicio, 300_000, total);
    pedacos.push([inicio, fim]);
    assert.ok(pedacoValido(inicio, fim, total));
    inicio = fim;
  }
  assert.deepEqual(pedacos.at(-1), [786432, 1_000_000]);
  assert.ok(pedacos.slice(0, -1).every(([a, b]) => (b - a) % ALINHAMENTO === 0));
  assert.equal(pedacoValido(0, 100_000, 1_000_000), false);
  assert.equal(pedacoValido(0, 100_000, 100_000), true);
});

test("mensagens nas duas vozes e status de cada erro", () => {
  for (const voz of ["painel", "publico"] as const) {
    for (const [codigo, texto] of Object.entries(MENSAGENS[voz])) {
      assert.ok(texto.length > 5, codigo);
      assert.ok(!texto.includes("!"), `${codigo}: sem exclamação`);
      assert.ok(STATUS_DO_ERRO[codigo as keyof typeof STATUS_DO_ERRO] >= 400, codigo);
    }
  }
  assert.equal(MENSAGENS.publico.sem_espaco, MENSAGENS.publico.sem_google, "o público não fica sabendo do espaço da ZRO");
  assert.deepEqual(respErro("limite_link", "publico", "x", 5), { ok: false, erro: "limite_link", mensagem: "x", cabem: 5 });
});
