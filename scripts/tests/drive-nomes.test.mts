/** Nomes e ids do Drive (puro). npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ehLixoDoSistema,
  escaparConsulta,
  idDePastaDoLink,
  idDriveValido,
  limparControles,
  nomeDeArquivo,
  nomePasta,
  segmentosDoCaminho,
  tipoSeguro,
} from "../../src/lib/drive/nomes";

test("nomePasta: barras, dois-pontos e interrogação viram traço", () => {
  assert.equal(nomePasta("SERHS / Pipa: Verão? <final>"), "SERHS - Pipa- Verão- -final-");
  assert.equal(nomePasta('a\\b*c"d|e'), "a-b-c-d-e");
});

test("nomePasta: controles e direção (bidi) saem", () => {
  assert.equal(nomePasta("Projeto‮cod.exe"), "Projetocod.exe");
  assert.equal(nomePasta("A\u0000B\u0007C‏D⁦E﻿"), "ABCDE");
  assert.equal(nomePasta("Linha\nquebrada\tcom tab"), "Linhaquebradacom tab");
});

test("nomePasta: emoji fica, espaços juntam, pontas sem ponto e espaço", () => {
  assert.equal(nomePasta("  Verão 🌞   Pipa ...  "), "Verão 🌞 Pipa");
  assert.equal(nomePasta("..."), "Sem nome");
  assert.equal(nomePasta(""), "Sem nome");
});

test("nomePasta: corta em 120 caracteres (sem partir emoji)", () => {
  assert.equal(nomePasta("x".repeat(300)).length, 120);
  const comEmoji = nomePasta("🎬".repeat(130));
  assert.equal(Array.from(comEmoji).length, 120);
  assert.ok(!comEmoji.includes("�"));
});

test("nomePasta: nomes reservados do Windows ganham _", () => {
  assert.equal(nomePasta("CON"), "CON_");
  assert.equal(nomePasta("nul"), "nul_");
  assert.equal(nomePasta("COM1"), "COM1_");
  assert.equal(nomePasta("lpt9.txt"), "lpt9.txt_");
  assert.equal(nomePasta("CONTRATO"), "CONTRATO");
});

test("nomePasta: NFC (o mesmo nome do Mac e do Windows casa)", () => {
  assert.equal(nomePasta("Áudios"), "Áudios");
});

test("nomeDeArquivo: arquivos de câmera nunca mudam", () => {
  for (const n of ["MVI_0001.MP4", "C0001.MP4", "A001C003_230312_R1AB.mxf", "DJI_20260312_0001_D.MP4", "IMG 0001 (1).HEIC", ".hidden"]) {
    assert.deepEqual(nomeDeArquivo(n), { nome: n, mudou: false });
  }
});

test("nomeDeArquivo: só tira controle e bidi; vazio vira 'arquivo'", () => {
  assert.deepEqual(nomeDeArquivo("orcamento‮fdp.exe"), { nome: "orcamentofdp.exe", mudou: true });
  assert.deepEqual(nomeDeArquivo("a:b?.txt"), { nome: "a:b?.txt", mudou: false });
  assert.deepEqual(nomeDeArquivo("‮"), { nome: "arquivo", mudou: true });
  assert.equal(limparControles("ok").mudou, false);
});

test("segmentosDoCaminho: sem vazios, sem . e .., sem controles, até 32 níveis", () => {
  assert.deepEqual(segmentosDoCaminho("DCIM/100CANON"), ["DCIM", "100CANON"]);
  assert.deepEqual(segmentosDoCaminho("/a//b/./../c/"), ["a", "b", "c"]);
  assert.deepEqual(segmentosDoCaminho("x\\y"), ["x", "y"]);
  assert.deepEqual(segmentosDoCaminho("pa‮sta/ok"), ["pasta", "ok"]);
  assert.equal(segmentosDoCaminho(Array.from({ length: 40 }, (_, i) => `n${i}`).join("/")).length, 32);
  assert.deepEqual(segmentosDoCaminho(""), []);
});

test("ehLixoDoSistema", () => {
  for (const s of [
    "EOS_DIGITAL/.DS_Store",
    "EOS_DIGITAL/DCIM/._MVI_0001.MP4",
    "Thumbs.db",
    "CARD/.Spotlight-V100/Store-V2/x",
    "CARD/.Trashes/501/a.mov",
    "CARD/.fseventsd/0000",
    "CARD/System Volume Information/IndexerVolumeGuid",
    "CARD/$RECYCLE.BIN/S-1/desktop.ini",
  ]) {
    assert.equal(ehLixoDoSistema(s), true, s);
  }
  for (const s of ["CARD/DCIM/100CANON/MVI_0001.MP4", "PRIVATE/M4ROOT/CLIP/C0001.MP4", "audio/ZOOM0001.WAV"]) {
    assert.equal(ehLixoDoSistema(s), false, s);
  }
});

test("escaparConsulta", () => {
  assert.equal(escaparConsulta("D'Ávila \\ cia"), "D\\'Ávila \\\\ cia");
});

test("idDriveValido e idDePastaDoLink", () => {
  assert.equal(idDriveValido("root"), true);
  assert.equal(idDriveValido("1AbC-dEf_0123456789"), true);
  assert.equal(idDriveValido("curto"), false);
  assert.equal(idDriveValido("../../etc"), false);
  assert.equal(idDriveValido("a b c d e f g h i"), false);
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  assert.equal(idDePastaDoLink(`https://drive.google.com/drive/folders/${id}`), id);
  assert.equal(idDePastaDoLink(`https://drive.google.com/drive/u/1/folders/${id}?usp=sharing`), id);
  assert.equal(idDePastaDoLink(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(idDePastaDoLink("https://drive.google.com/drive/my-drive"), null);
  assert.equal(idDePastaDoLink("https://exemplo.com/folders/x"), null);
  assert.equal(idDePastaDoLink(null), null);
});

test("tipoSeguro", () => {
  assert.equal(tipoSeguro("video/mp4"), "video/mp4");
  assert.equal(tipoSeguro("Video/QuickTime"), "video/quicktime");
  assert.equal(tipoSeguro("application/vnd.google-apps.document"), "application/octet-stream");
  assert.equal(tipoSeguro("application/vnd.google-apps.folder"), "application/octet-stream");
  assert.equal(tipoSeguro("text/html; charset=utf-8"), "application/octet-stream");
  assert.equal(tipoSeguro(""), "application/octet-stream");
  assert.equal(tipoSeguro(null), "application/octet-stream");
});
