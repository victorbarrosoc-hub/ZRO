/**
 * O motor do navegador (em Node, com redeFetch) contra o Google falso. O transporte chama os serviços
 * de verdade (drive-envios) no mesmo processo, com JSON de ida e volta como na rede.
 * Quedas, 5xx, sessão que expira, Range escondido, resposta final sem CORS, 0 byte, já recebido,
 * pausa, cancelamento e o diagnóstico de Ajustes.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { caminhoNoMock, ORIGEM, prepararAmbiente, type Ambiente } from "./drive-ambiente.mjs";
import type { Motor, Foto } from "../../src/lib/drive/navegador/motor";
import type { Transporte } from "../../src/lib/drive/navegador/transporte";
import type { Rede } from "../../src/lib/drive/navegador/rede";
import type { Selecao } from "../../src/lib/drive/navegador/selecao";

let amb: Ambiente;
let envios: typeof import("../../src/lib/services/drive-envios");
let pastas: typeof import("../../src/lib/services/drive-pastas");
let motorMod: typeof import("../../src/lib/drive/navegador/motor");
let redeMod: typeof import("../../src/lib/drive/navegador/rede");

before(async () => {
  amb = await prepararAmbiente();
  envios = await import("../../src/lib/services/drive-envios");
  pastas = await import("../../src/lib/services/drive-pastas");
  motorMod = await import("../../src/lib/drive/navegador/motor");
  redeMod = await import("../../src/lib/drive/navegador/rede");
});

after(async () => {
  await amb?.fechar();
});

type Contagem = { lote: number; iniciar: number; conferir: number; cancelar: number; fecharLote: number };

/** Transporte que fala direto com os serviços, com JSON de ida e volta (como a rota). */
function transporteLocal(contagem: Contagem): Transporte {
  const escopo = { origem: "painel" as const, userId: amb.ids.user };
  const fio = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    lote: async (p) => (contagem.lote++, fio(await envios.abrirLote(fio(p), escopo, ORIGEM))),
    iniciar: async (p) => (contagem.iniciar++, fio(await envios.iniciarArquivos(fio(p), escopo, ORIGEM))),
    conferir: async (p) => (contagem.conferir++, fio(await envios.conferirEnvios(fio(p), escopo))),
    cancelar: async (p) => (contagem.cancelar++, fio(await envios.cancelarEnvios(fio(p), escopo))),
    fecharLote: async (p) => (contagem.fecharLote++, fio(await envios.fecharLote(fio(p), escopo))),
    diagnostico: async (p) => fio(await envios.diagnosticoEnvio(fio(p), escopo)),
  };
}

function novaContagem(): Contagem {
  return { lote: 0, iniciar: 0, conferir: 0, cancelar: 0, fecharLote: 0 };
}

const md5 = (b: Uint8Array) => createHash("md5").update(b).digest("hex");

function arquivo(nome: string, tamanho: number, caminho = ""): { file: File; caminho: string; md5: string } {
  const dados = randomBytes(tamanho);
  return { file: new File([dados], nome, { type: "video/mp4", lastModified: 1_700_000_000_000 }), caminho, md5: md5(dados) };
}

function selecao(arqs: { file: File; caminho: string }[]): Selecao {
  return { arquivos: arqs.map(({ file, caminho }) => ({ file, caminho })), ignorados: [], cartaoNome: null };
}

function esperarFim(motor: Motor, ms = 90_000): Promise<Foto> {
  return new Promise((ok, falha) => {
    let parar = () => {};
    const tempo = setTimeout(() => {
      parar();
      const f = motor.foto();
      falha(new Error(`tempo esgotado: ${JSON.stringify({ lotes: f.lotes.map((l) => [l.estado, l.erro]), itens: f.itens.map((i) => [i.nome, i.estado, i.erro, i.nota]) })}`));
    }, ms);
    const ver = () => {
      const f = motor.foto();
      const fim = f.lotes.length > 0 && f.lotes.every((l) => ["concluido", "parcial", "cancelado", "erro"].includes(l.estado)) && !f.ativo;
      if (fim) {
        clearTimeout(tempo);
        parar();
        ok(f);
      }
    };
    parar = motor.assinar(ver);
    ver();
  });
}

function esperarQue(motor: Motor, cond: (f: Foto) => boolean, ms = 30_000): Promise<Foto> {
  return new Promise((ok, falha) => {
    let parar = () => {};
    const tempo = setTimeout(() => {
      parar();
      falha(new Error("condição não aconteceu"));
    }, ms);
    const ver = () => {
      const f = motor.foto();
      if (cond(f)) {
        clearTimeout(tempo);
        parar();
        ok(f);
      }
    };
    parar = motor.assinar(ver);
    ver();
  });
}

async function pastaDeTeste(nome: string): Promise<string> {
  const { raizId } = await pastas.garantirRaiz();
  return pastas.garantirPasta(raizId, nome);
}

async function md5NoDrive(pastaId: string, caminho: string): Promise<string | null> {
  const it = amb.mock.listAll().find((x) => !x.isFolder && caminhoNoMock(amb.mock, x.id) === `${caminhoNoMock(amb.mock, pastaId)}/${caminho}`);
  return it ? amb.mock.contentMd5(it.id) : null;
}

const opcoesBase = { escopo: "teste", voz: "painel" as const, pedacoMiB: 0.25, paralelos: 2, recuoBaseMs: 5 };

describe("motor", () => {
  test("3 arquivos com quedas e 5xx chegam inteiros (md5 igual), com as pastas do cartão", async () => {
    const pasta = await pastaDeTeste("Teste quedas");
    amb.mock.setOptions({ failures: { dropUploadProb: 0.2, error5xxProb: 0.05 } });
    try {
      const c = novaContagem();
      const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede: redeMod.redeFetch() });
      const arqs = [arquivo("A.MP4", 1_300_000, "DCIM/100CANON"), arquivo("B.MP4", 700_000, "DCIM/100CANON"), arquivo("C.MP4", 2_600_000, "DCIM/101CANON")];
      motor.adicionar(selecao(arqs), { tipo: "pasta", pastaId: pasta });
      const f = await esperarFim(motor);
      assert.equal(f.lotes[0].estado, "concluido", JSON.stringify(f.itens.map((i) => [i.nome, i.estado, i.erro])));
      assert.ok(f.itens.every((i) => i.estado === "concluido"));
      assert.ok(amb.mock.stats().faults.uploadDrops > 0, "houve quedas de verdade");
      for (const a of arqs) assert.equal(await md5NoDrive(pasta, `${a.caminho}/${a.file.name}`), a.md5, a.file.name);
      motor.destruir();
    } finally {
      amb.mock.setOptions({ failures: {} });
    }
  });

  test("sessão que expira no meio: conferir confirma, iniciar recomeça, chega inteiro", async () => {
    const pasta = await pastaDeTeste("Teste expira");
    const base = redeMod.redeFetch();
    let expirou = false;
    const rede: Rede = {
      async put(url, p) {
        const r = await base.put(url, p);
        if (!expirou && r.status === 308 && p.corpo) {
          expirou = true;
          amb.mock.expireUploadSessions();
        }
        return r;
      },
    };
    const sessoesAntes = amb.mock.stats().uploadSessionsCreated;
    const c = novaContagem();
    const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede });
    const a = arquivo("LONGO.MOV", 1_200_000);
    motor.adicionar(selecao([a]), { tipo: "pasta", pastaId: pasta });
    const f = await esperarFim(motor);
    assert.equal(f.itens[0].estado, "concluido", JSON.stringify(f.itens));
    assert.equal(amb.mock.stats().uploadSessionsCreated - sessoesAntes, 2, "uma sessão nova depois da expirada");
    assert.ok(c.conferir >= 2, "perguntou ao servidor antes de recomeçar");
    assert.equal(await md5NoDrive(pasta, a.file.name), a.md5);
    motor.destruir();
  });

  test("Range escondido pelo CORS: o ponto vem do servidor (conferir), nunca zero", async () => {
    const pasta = await pastaDeTeste("Teste range");
    const c = novaContagem();
    const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede: redeMod.redeFetch({ esconderRange: true }) });
    const a = arquivo("SEM_RANGE.MP4", 1_100_000);
    const recebidosAntes = amb.mock.stats().bytesReceived;
    motor.adicionar(selecao([a]), { tipo: "pasta", pastaId: pasta });
    const f = await esperarFim(motor);
    assert.equal(f.itens[0].estado, "concluido");
    assert.ok(c.conferir >= 4, `um conferir por pedaço (${c.conferir})`);
    assert.ok(amb.mock.stats().bytesReceived - recebidosAntes < 1.2 * a.file.size, "não reenviou do zero");
    assert.equal(await md5NoDrive(pasta, a.file.name), a.md5);
    motor.destruir();
  });

  test("resposta final sem CORS (status 0 no último pedaço): o servidor conclui", async () => {
    const pasta = await pastaDeTeste("Teste final");
    const c = novaContagem();
    const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede: redeMod.redeFetch({ finalSemCors: true }) });
    const a = arquivo("FINAL.MP4", 600_000);
    motor.adicionar(selecao([a]), { tipo: "pasta", pastaId: pasta });
    const f = await esperarFim(motor);
    assert.equal(f.itens[0].estado, "concluido");
    assert.equal(await md5NoDrive(pasta, a.file.name), a.md5);
    motor.destruir();
  });

  test("0 byte e o mesmo cartão de novo: concluído sem PUT; depois, tudo 'já recebido'", async () => {
    const pasta = await pastaDeTeste("Teste vazio");
    const c = novaContagem();
    const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede: redeMod.redeFetch() });
    const arqs = [arquivo("VAZIO.TXT", 0), arquivo("PEQUENO.WAV", 50_000), arquivo("OUTRO.WAV", 70_000)];
    motor.adicionar(selecao(arqs), { tipo: "pasta", pastaId: pasta });
    let f = await esperarFim(motor);
    assert.ok(f.itens.every((i) => i.estado === "concluido"), JSON.stringify(f.itens));
    assert.equal(c.iniciar, 1, "os pequenos foram iniciados juntos");
    const sessoes = amb.mock.stats().uploadSessionsCreated;
    motor.adicionar(selecao(arqs), { tipo: "pasta", pastaId: pasta });
    f = await esperarFim(motor);
    const segundo = f.itens.filter((i) => i.lote === f.lotes[1].chave);
    assert.ok(segundo.every((i) => i.estado === "ja-recebido"), JSON.stringify(segundo));
    assert.equal(amb.mock.stats().uploadSessionsCreated, sessoes);
    motor.destruir();
  });

  test("pausar e continuar no meio: continua de onde parou", async () => {
    const pasta = await pastaDeTeste("Teste pausa");
    amb.mock.setOptions({ perConnectionBps: 1_000_000 });
    try {
      const c = novaContagem();
      const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede: redeMod.redeFetch() });
      const a = arquivo("PAUSA.MOV", 2_000_000);
      const chave = motor.adicionar(selecao([a]), { tipo: "pasta", pastaId: pasta });
      await esperarQue(motor, (f) => f.itens[0]?.enviado >= 262_144);
      motor.pausar(chave);
      const pausada = await esperarQue(motor, (f) => f.itens[0]?.estado === "pausado" && !f.ativo);
      assert.equal(pausada.lotes[0].estado, "pausado");
      const recebidos = amb.mock.stats().bytesReceived;
      amb.mock.setOptions({ perConnectionBps: 0 });
      motor.continuar(chave);
      const f = await esperarFim(motor);
      assert.equal(f.itens[0].estado, "concluido");
      assert.ok(amb.mock.stats().bytesReceived - recebidos < a.file.size, "não recomeçou do zero");
      assert.equal(await md5NoDrive(pasta, a.file.name), a.md5);
      motor.destruir();
    } finally {
      amb.mock.setOptions({ perConnectionBps: 0 });
    }
  });

  test("cancelar no meio: sessões canceladas no Google e no banco; lote cancelado", async () => {
    const pasta = await pastaDeTeste("Teste cancelar");
    amb.mock.setOptions({ perConnectionBps: 500_000 });
    try {
      const c = novaContagem();
      const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(c), rede: redeMod.redeFetch() });
      const chave = motor.adicionar(selecao([arquivo("X1.MOV", 1_500_000), arquivo("X2.MOV", 1_500_000)]), { tipo: "pasta", pastaId: pasta });
      await esperarQue(motor, (f) => f.itens.some((i) => i.enviado > 0));
      const envioIds = () => motor.foto().itens.map((i) => i.envioId).filter(Boolean) as string[];
      await esperarQue(motor, () => envioIds().length > 0);
      const ids = envioIds();
      motor.cancelar(chave);
      await esperarQue(motor, () => c.fecharLote > 0, 15_000);
      const f = motor.foto();
      assert.equal(f.lotes[0].estado, "cancelado");
      const linhas = await amb.db.select().from(amb.schema.driveEnvios);
      for (const id of ids) {
        const l = linhas.find((x) => x.id === id)!;
        assert.ok(["cancelado", "concluido"].includes(l.estado), l.estado);
        assert.equal(l.sessaoEnc, null);
      }
      motor.destruir();
    } finally {
      amb.mock.setOptions({ perConnectionBps: 0 });
    }
  });

  test("diagnóstico de Ajustes: 512 KiB em pedaços de 256 KiB, cinco respostas e o arquivo na lixeira", async () => {
    const { raizId } = await pastas.garantirRaiz();
    const c = novaContagem();
    const transporte = transporteLocal(c);
    const motor = motorMod.criarMotor({ ...opcoesBase, transporte, rede: redeMod.redeFetch(), diagnostico: true, paralelos: 1 });
    motor.adicionar(selecao([{ file: new File([randomBytes(512 * 1024)], "zro-teste-envio.bin"), caminho: "" }]), { tipo: "pasta", pastaId: raizId });
    const f = await esperarFim(motor);
    assert.equal(f.itens[0].estado, "concluido");
    assert.deepEqual({ ...f.diagnostico, host: f.diagnostico?.host.startsWith("127.0.0.1:") }, {
      preflight: true,
      viu308: true,
      rangeLegivel: true,
      finalLegivel: true,
      host: true,
      navegador: f.diagnostico?.navegador,
    });
    const r = await transporte.diagnostico!({ op: "diagnostico", envioId: f.itens[0].envioId!, resultado: f.diagnostico! });
    assert.ok(r.ok && r.registro.ok && r.registro.conferido, JSON.stringify(r));
    const arq = amb.mock.listAll().find((x) => x.name === "zro-teste-envio.bin")!;
    assert.equal(arq.trashed, true, "vai para a lixeira, nunca apagado de vez");
    const conexao = await amb.db.query.driveConexao.findFirst();
    assert.equal(conexao!.diagnosticos.length, 1);
    assert.ok(!JSON.stringify(conexao!.diagnosticos).includes("upload_id"), "a sessão nunca aparece");
    motor.destruir();
  });

  test("diagnóstico com a resposta final sem CORS: finalLegivel falso, mas o envio conclui", async () => {
    const { raizId } = await pastas.garantirRaiz();
    const motor = motorMod.criarMotor({ ...opcoesBase, transporte: transporteLocal(novaContagem()), rede: redeMod.redeFetch({ finalSemCors: true }), diagnostico: true, paralelos: 1 });
    motor.adicionar(selecao([{ file: new File([randomBytes(512 * 1024)], "zro-teste-envio-2.bin"), caminho: "" }]), { tipo: "pasta", pastaId: raizId });
    const f = await esperarFim(motor);
    assert.equal(f.itens[0].estado, "concluido");
    assert.equal(f.diagnostico?.finalLegivel, false);
    assert.equal(f.diagnostico?.rangeLegivel, true);
    motor.destruir();
  });
});
