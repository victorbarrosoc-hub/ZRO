/**
 * Serviços do Drive contra o Google falso e um Postgres em memória:
 * pastas sem duplicata, rolos atômicos, retomada e pergunta do cartão, conferir/fechar idempotentes,
 * conciliação por appProperties, links, entregas e o escopo (IDOR).
 *
 *   npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { caminhoNoMock, ORIGEM, pastasRepetidas, prepararAmbiente, type Ambiente } from "./drive-ambiente.mjs";

let amb: Ambiente;
let pastas: typeof import("../../src/lib/services/drive-pastas");
let envios: typeof import("../../src/lib/services/drive-envios");
let links: typeof import("../../src/lib/services/drive-links");
let entregas: typeof import("../../src/lib/services/drive-entregas");
let drizzle: typeof import("drizzle-orm");

const impressaoDe = (texto: string) => createHash("sha256").update(texto).digest("hex");

before(async () => {
  amb = await prepararAmbiente();
  pastas = await import("../../src/lib/services/drive-pastas");
  envios = await import("../../src/lib/services/drive-envios");
  links = await import("../../src/lib/services/drive-links");
  entregas = await import("../../src/lib/services/drive-entregas");
  drizzle = await import("drizzle-orm");
});

after(async () => {
  await amb?.fechar();
});

/** Manda os bytes para a sessão pelo Node (como o navegador faria) e devolve o md5. */
async function subir(sessao: string, dados: Uint8Array, pedaco = 256 * 1024): Promise<number> {
  let offset = 0;
  let status = 0;
  while (offset < dados.length) {
    const fim = Math.min(offset + pedaco, dados.length);
    const r = await fetch(sessao, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${offset}-${fim - 1}/${dados.length}`, Origin: ORIGEM },
      body: dados.slice(offset, fim),
      redirect: "manual",
    });
    status = r.status;
    await r.arrayBuffer();
    offset = fim;
  }
  return status;
}

async function linkDaDiaria2() {
  const r = await links.linkDaDiaria(amb.ids.diaria2, { criar: true, userId: amb.ids.user });
  assert.ok(r.ok, r.ok ? "" : r.mensagem);
  const token = r.link!.url!.split("/enviar/")[1];
  const linha = await links.buscarLinkPorToken(token, "freela-diaria");
  assert.ok(linha);
  return { r, token, linha: linha! };
}

describe("pastas", () => {
  test("garantirPastasDoProjeto 5 vezes ao mesmo tempo: a árvore uma vez só", async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => pastas.garantirPastasDoProjeto(amb.ids.projeto)));
    for (const r of rs) assert.ok(r.ok, r.ok ? "" : r.mensagem);
    assert.deepEqual(pastasRepetidas(amb.mock), []);
    const dto = await pastas.pastasDoProjeto(amb.ids.projeto);
    assert.ok(dto);
    assert.equal(dto!.estado, "pronta");
    assert.equal(caminhoNoMock(amb.mock, dto!.pastaId!), `ZRO/Clientes/Teste SERHS/${amb.datas.mes} · Teste Verão Pipa`);
    const nomes = dto!.pastas.filter((p) => !p.chave.includes("/")).map((p) => p.nome);
    assert.deepEqual(nomes, ["00 Documentos", "01 Cenas", "02 Áudios", "03 Assets", "04 Projeto", "05 Render", "06 Entregas"]);
    assert.ok(dto!.pastas.every((p) => p.id), "toda pasta com id");
    assert.deepEqual(
      dto!.pastas.filter((p) => p.chave.includes("/")).map((p) => p.chave),
      [
        "03 Assets/Do cliente",
        "03 Assets/Trilha e SFX",
        "03 Assets/Gráficos",
        "04 Projeto/Edição",
        "04 Projeto/Color",
        "04 Projeto/Som",
        "04 Projeto/Motion",
        "06 Entregas/Master",
        "06 Entregas/Redes",
        "06 Entregas/Legendas",
      ],
    );
    // O link do projeto, que estava vazio, passa a apontar para a pasta.
    const p = await amb.db.query.projects.findFirst({ where: drizzle.eq(amb.schema.projects.id, amb.ids.projeto) });
    assert.equal(p!.driveUrl, `https://drive.google.com/drive/folders/${dto!.pastaId}`);
  });

  test("chamar de novo não cria nada; pasta na lixeira é recriada com 'verificar'", async () => {
    const antes = amb.mock.listAll().length;
    const r = await pastas.garantirPastasDoProjeto(amb.ids.projeto);
    assert.ok(r.ok && r.criadas === 0);
    assert.equal(amb.mock.listAll().length, antes);
    const dto = await pastas.pastasDoProjeto(amb.ids.projeto);
    const render = dto!.pastas.find((x) => x.chave === "render")!;
    // Alguém manda 05 Render para a lixeira no Drive.
    await amb.mock.setOptions({});
    const { arquivo } = await import("../../src/lib/google/drive");
    await (await import("../../src/lib/google/drive")).lixeira(render.id!);
    assert.equal((await arquivo(render.id!)).lixeira, true);
    const v = await pastas.garantirPastasDoProjeto(amb.ids.projeto, { verificar: true });
    assert.ok(v.ok && v.criadas === 1, JSON.stringify(v));
    const novo = (await pastas.pastasDoProjeto(amb.ids.projeto))!.pastas.find((x) => x.chave === "render")!;
    assert.notEqual(novo.id, render.id);
  });

  test("projeto com link de outra pasta usa a pasta do link; link que não abre dá erro (nunca segunda árvore)", async () => {
    const externa = amb.mock.addFolder("Pasta do cliente de fora");
    await amb.db.update(amb.schema.projects).set({ driveUrl: `https://drive.google.com/drive/u/1/folders/${externa.id}?usp=sharing` }).where(drizzle.eq(amb.schema.projects.id, amb.ids.projetoOutro));
    const r = await pastas.garantirPastasDoProjeto(amb.ids.projetoOutro);
    assert.ok(r.ok, r.ok ? "" : r.mensagem);
    assert.equal(r.ok && r.pastaId, externa.id);
    const dto = await pastas.pastasDoProjeto(amb.ids.projetoOutro);
    assert.equal(dto!.deLink, true);

    const [quebrado] = await amb.db
      .insert(amb.schema.projects)
      .values({ code: "ZRO-2026-903", title: "Teste Link Quebrado", driveUrl: "https://drive.google.com/drive/folders/1naoexisteNoDriveFalso00000" })
      .returning();
    const q = await pastas.garantirPastasDoProjeto(quebrado.id);
    assert.equal(q.ok, false);
    assert.equal(!q.ok && q.erro, "link_de_fora");
    assert.equal(amb.mock.listAll().filter((it) => it.name.includes("Teste Link Quebrado")).length, 0);
  });

  test("diárias numeradas pela data e congeladas", async () => {
    const d2 = await pastas.diariaDoEvento(amb.ids.diaria2, { criarPastas: "cenas" });
    const d1 = await pastas.diariaDoEvento(amb.ids.diaria1);
    assert.equal(d1.numero, 1);
    assert.equal(d2.numero, 2);
    assert.equal(d2.nome, `${amb.datas.d2} · Diária 02`);
    assert.ok(d2.cenasPastaId);
    assert.equal(d2.audiosPastaId, null, "sem pasta vazia de áudio");
    assert.equal(caminhoNoMock(amb.mock, d2.cenasPastaId!), `ZRO/Clientes/Teste SERHS/${amb.datas.mes} · Teste Verão Pipa/01 Cenas/${amb.datas.d2} · Diária 02`);
  });
});

describe("lotes do freela", () => {
  test("10 lotes de Câm A ao mesmo tempo: rolos A001…A010 sem repetir", async () => {
    const { linha } = await linkDaDiaria2();
    const rs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        envios.abrirLote(
          {
            op: "lote",
            destino: { tipo: "cartao", fonte: "cam-a", pessoa: { freelancerId: amb.ids.rafael } },
            arquivos: 1,
            bytes: 10,
            impressao: impressaoDe(`cartao-${i}`),
          },
          { origem: "freela", link: linha },
          ORIGEM,
        ),
      ),
    );
    const rotulos = rs.map((r) => {
      assert.ok(r.ok && "loteId" in r, JSON.stringify(r));
      return (r as { rotulo: string }).rotulo.split(" · ")[0];
    });
    assert.deepEqual([...rotulos].sort(), ["A001", "A002", "A003", "A004", "A005", "A006", "A007", "A008", "A009", "A010"]);
    assert.deepEqual(pastasRepetidas(amb.mock), []);
    const r0 = rs[0] as { caminho: string };
    assert.ok(r0.caminho.endsWith(`01 Cenas / ${amb.datas.d2} · Diária 02 / Câm A · Teste Rafael Moura / ${r0.caminho.slice(-4)}`), r0.caminho);
    assert.match(r0.caminho, /A0\d\d$/);
  });

  test("mesmo cartão (mesma impressão) devolve o mesmo lote; mesmo nome em 24 h pergunta", async () => {
    const { linha } = await linkDaDiaria2();
    const escopo = { origem: "freela" as const, link: linha };
    const destino = { tipo: "cartao" as const, fonte: "cam-b" as const, pessoa: { freelancerId: amb.ids.rafael }, cartaoNome: "EOS_DIGITAL" };
    const a = await envios.abrirLote({ op: "lote", destino, arquivos: 2, bytes: 20, impressao: impressaoDe("eos-1") }, escopo, ORIGEM);
    const b = await envios.abrirLote({ op: "lote", destino, arquivos: 2, bytes: 20, impressao: impressaoDe("eos-1") }, escopo, ORIGEM);
    assert.ok(a.ok && "loteId" in a && b.ok && "loteId" in b);
    assert.equal((b as { loteId: string }).loteId, (a as { loteId: string }).loteId);
    assert.equal((b as { retomado: boolean }).retomado, true);
    assert.match((a as { rotulo: string }).rotulo, /^B001 · Câm B · Teste Rafael Moura$/);

    const c = await envios.abrirLote({ op: "lote", destino, arquivos: 3, bytes: 30, impressao: impressaoDe("eos-2") }, escopo, ORIGEM);
    assert.ok(c.ok && "pergunta" in c, JSON.stringify(c));
    assert.equal((c as { pergunta: { rotulo: string } }).pergunta.rotulo, "B001");
    const continuar = await envios.abrirLote(
      { op: "lote", destino: { ...destino, decisao: "continuar", continuarLoteId: (a as { loteId: string }).loteId }, arquivos: 3, bytes: 30, impressao: impressaoDe("eos-2") },
      escopo,
      ORIGEM,
    );
    assert.ok(continuar.ok && "loteId" in continuar && continuar.loteId === (a as { loteId: string }).loteId);
    const novo = await envios.abrirLote(
      { op: "lote", destino: { ...destino, decisao: "novo" }, arquivos: 3, bytes: 30, impressao: impressaoDe("eos-3") },
      escopo,
      ORIGEM,
    );
    assert.ok(novo.ok && "rotulo" in novo && novo.rotulo.startsWith("B002"));
  });

  test("freela fora da escala: 400; gravador vai para a pasta do áudio, sem rolo", async () => {
    const { linha } = await linkDaDiaria2();
    const escopo = { origem: "freela" as const, link: linha };
    const fora = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cartao", fonte: "cam-a", pessoa: { freelancerId: amb.ids.user } }, arquivos: 1, bytes: 1, impressao: impressaoDe("x") },
      escopo,
      ORIGEM,
    );
    assert.equal(fora.ok, false);
    const audio = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cartao", fonte: "gravador", gravador: "Zoom F6", pessoa: { freelancerId: amb.ids.carla } }, arquivos: 1, bytes: 1, impressao: impressaoDe("audio") },
      escopo,
      ORIGEM,
    );
    assert.ok(audio.ok && "caminho" in audio, JSON.stringify(audio));
    assert.ok((audio as { caminho: string }).caminho.endsWith(`02 Áudios / ${amb.datas.d2} · Diária 02 / Zoom F6 · Teste Carla Dias`));
  });
});

describe("envio, conferência e fechamento", () => {
  test("50 arquivos: iniciar, PUT, conferir duas vezes ao mesmo tempo, fechar duas vezes → uma linha no histórico", async () => {
    const { linha } = await linkDaDiaria2();
    const escopo = { origem: "freela" as const, link: linha };
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cartao", fonte: "drone", pessoa: { nome: "Teste Piloto Convidado" } }, arquivos: 50, bytes: 50 * 300_000, impressao: impressaoDe("drone") },
      escopo,
      ORIGEM,
    );
    assert.ok(lote.ok && "loteId" in lote, JSON.stringify(lote));
    const loteId = (lote as { loteId: string }).loteId;
    assert.match((lote as { rotulo: string }).rotulo, /^D001 · Drone · Teste Piloto Convidado$/);

    const arquivos = Array.from({ length: 50 }, (_, i) => ({
      chave: `k${i}`,
      nome: `DJI_${String(i).padStart(4, "0")}.MP4`,
      caminho: i < 25 ? "DCIM/100MEDIA" : "DCIM/101MEDIA",
      tamanho: 300_000,
      tipo: "video/mp4",
    }));
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos }, escopo, ORIGEM);
    assert.ok(ini.ok, JSON.stringify(ini));
    const res = (ini as { resultados: { ok: boolean; estado?: string; sessao?: string; envioId?: string }[] }).resultados;
    assert.equal(res.length, 50);
    assert.ok(res.every((r) => r.ok && r.estado === "enviar"));
    assert.deepEqual(pastasRepetidas(amb.mock), []);

    const dados = new Uint8Array(300_000).map((_, i) => i % 251);
    for (const r of res) assert.equal(await subir(r.sessao!, dados), 200);

    const ids = res.map((r) => r.envioId!);
    const [c1, c2] = await Promise.all([
      envios.conferirEnvios({ op: "conferir", envioIds: ids }, escopo),
      envios.conferirEnvios({ op: "conferir", envioIds: ids }, escopo),
    ]);
    for (const c of [c1, c2]) {
      assert.ok(c.ok, JSON.stringify(c));
      assert.ok((c as { resultados: { estado: string }[] }).resultados.every((x) => x.estado === "concluido"));
    }
    const l = await amb.db.query.driveLotes.findFirst({ where: drizzle.eq(amb.schema.driveLotes.id, loteId) });
    assert.equal(l!.arquivosRecebidos, 50, "soma uma vez só");
    assert.equal(Number(l!.bytesRecebidos), 50 * 300_000);

    const [f1, f2] = [await envios.fecharLote({ op: "fecharLote", loteId }, escopo), await envios.fecharLote({ op: "fecharLote", loteId }, escopo)];
    assert.ok(f1.ok && f1.estado === "concluido" && f1.arquivos === 50 && f1.faltam === 0, JSON.stringify(f1));
    assert.ok(f2.ok && f2.estado === "concluido");
    const historico = await amb.db
      .select()
      .from(amb.schema.activities)
      .where(drizzle.and(drizzle.eq(amb.schema.activities.projectId, amb.ids.projeto), drizzle.eq(amb.schema.activities.type, "arquivos")));
    const doDrone = historico.filter((h) => h.content.includes("D001"));
    assert.equal(doDrone.length, 1);
    assert.equal(doDrone[0].content, "Teste Piloto Convidado enviou o rolo D001 · Drone · Diária 02: 50 arquivos, 15 MB.");
    assert.equal(doDrone[0].clientId, amb.ids.cliente);

    // As pastas do cartão foram preservadas, e o arquivo carrega o envio em appProperties.
    const um = amb.mock.listAll().find((it) => it.name === "DJI_0000.MP4")!;
    assert.ok(caminhoNoMock(amb.mock, um.id).endsWith(`01 Cenas/${amb.datas.d2} · Diária 02/Drone · Teste Piloto Convidado/D001/DCIM/100MEDIA/DJI_0000.MP4`));
    assert.equal(um.appProperties?.zroEnvio, ids[0]);

    // Escolher o mesmo cartão de novo: tudo "já recebido", sem sessão nova.
    const sessoesAntes = amb.mock.stats().uploadSessionsCreated;
    const de_novo = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos }, escopo, ORIGEM);
    assert.ok(de_novo.ok && de_novo.resultados.every((r) => r.ok && r.estado === "concluido" && r.jaRecebido));
    assert.equal(amb.mock.stats().uploadSessionsCreated, sessoesAntes);
  });

  test("retomada: iniciar de novo devolve a mesma sessão com o ponto certo (consultado no Google)", async () => {
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "pasta", pastaId: (await pastas.garantirRaiz()).raizId }, arquivos: 1, bytes: 600_000, impressao: impressaoDe("retomada") },
      { origem: "painel", userId: amb.ids.user },
      ORIGEM,
    );
    assert.ok(lote.ok && "loteId" in lote);
    const escopo = { origem: "painel" as const, userId: amb.ids.user };
    const pedido = { op: "iniciar" as const, loteId: (lote as { loteId: string }).loteId, arquivos: [{ chave: "a", nome: "grande.mov", caminho: "", tamanho: 600_000, tipo: "video/quicktime", modificado: 123 }] };
    const r1 = await envios.iniciarArquivos(pedido, escopo, ORIGEM);
    assert.ok(r1.ok && r1.resultados[0].ok && r1.resultados[0].estado === "enviar");
    const s1 = r1.resultados[0] as { sessao: string; envioId: string };
    // manda só o primeiro pedaço
    const dados = new Uint8Array(600_000).fill(3);
    await fetch(s1.sessao, { method: "PUT", headers: { "Content-Range": "bytes 0-262143/600000" }, body: dados.slice(0, 262144), redirect: "manual" });
    const r2 = await envios.iniciarArquivos(pedido, escopo, ORIGEM);
    assert.ok(r2.ok && r2.resultados[0].ok && r2.resultados[0].estado === "enviar");
    const s2 = r2.resultados[0] as { sessao: string; envioId: string; offset: number; retomado: boolean };
    assert.equal(s2.envioId, s1.envioId);
    assert.equal(s2.sessao, s1.sessao);
    assert.equal(s2.offset, 262144);
    assert.equal(s2.retomado, true);
  });

  test("terminou sem conferir e a sessão morreu: a conciliação acha pelo appProperties e conclui", async () => {
    const escopo = { origem: "painel" as const, userId: amb.ids.user };
    const { raizId } = await pastas.garantirRaiz();
    const lote = await envios.abrirLote({ op: "lote", destino: { tipo: "pasta", pastaId: raizId }, arquivos: 1, bytes: 1000, impressao: impressaoDe("conciliar") }, escopo, ORIGEM);
    assert.ok(lote.ok && "loteId" in lote);
    const loteId = (lote as { loteId: string }).loteId;
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "x", nome: "perdido.wav", caminho: "", tamanho: 1000, tipo: "audio/wav" }] }, escopo, ORIGEM);
    const r = (ini as { resultados: { sessao: string; envioId: string }[] }).resultados[0];
    assert.equal(await subir(r.sessao, new Uint8Array(1000).fill(9)), 200);
    amb.mock.expireUploadSessions(); // a sessão some: só a busca por appProperties acha o arquivo
    await amb.db
      .update(amb.schema.driveEnvios)
      .set({ ultimoSinalEm: new Date(Date.now() - 3 * 60 * 60_000) })
      .where(drizzle.eq(amb.schema.driveEnvios.id, r.envioId));
    await amb.db
      .update(amb.schema.driveLotes)
      .set({ ultimoSinalEm: new Date(Date.now() - 3 * 60 * 60_000) })
      .where(drizzle.eq(amb.schema.driveLotes.id, loteId));
    const n = await envios.conciliarParados(50);
    assert.ok(n >= 1);
    const e = await amb.db.query.driveEnvios.findFirst({ where: drizzle.eq(amb.schema.driveEnvios.id, r.envioId) });
    assert.equal(e!.estado, "concluido");
    assert.equal(e!.sessaoEnc, null, "a URI da sessão sai do banco ao concluir");
    const l = await amb.db.query.driveLotes.findFirst({ where: drizzle.eq(amb.schema.driveLotes.id, loteId) });
    assert.equal(l!.estado, "concluido");
  });

  test("cancelar pergunta antes: arquivo que já chegou é concluído, não cancelado", async () => {
    const escopo = { origem: "painel" as const, userId: amb.ids.user };
    const { raizId } = await pastas.garantirRaiz();
    const lote = await envios.abrirLote({ op: "lote", destino: { tipo: "pasta", pastaId: raizId }, arquivos: 2, bytes: 2000, impressao: impressaoDe("cancelar") }, escopo, ORIGEM);
    const loteId = (lote as { loteId: string }).loteId;
    const ini = await envios.iniciarArquivos(
      {
        op: "iniciar",
        loteId,
        arquivos: [
          { chave: "a", nome: "c1.bin", caminho: "", tamanho: 1000, tipo: "application/octet-stream" },
          { chave: "b", nome: "c2.bin", caminho: "", tamanho: 1000, tipo: "application/octet-stream" },
        ],
      },
      escopo,
      ORIGEM,
    );
    const [a, b] = (ini as { resultados: { sessao: string; envioId: string }[] }).resultados;
    await subir(a.sessao, new Uint8Array(1000).fill(1));
    const c = await envios.cancelarEnvios({ op: "cancelar", envioIds: [a.envioId, b.envioId] }, escopo);
    assert.ok(c.ok && c.concluidos === 1 && c.cancelados === 1, JSON.stringify(c));
    const f = await envios.fecharLote({ op: "fecharLote", loteId }, escopo);
    assert.ok(f.ok && f.estado === "parcial" && f.faltam === 1);
  });

  test("0 byte: concluído na hora, sem sessão", async () => {
    const escopo = { origem: "painel" as const, userId: amb.ids.user };
    const { raizId } = await pastas.garantirRaiz();
    const lote = await envios.abrirLote({ op: "lote", destino: { tipo: "pasta", pastaId: raizId }, arquivos: 1, bytes: 0, impressao: impressaoDe("vazio") }, escopo, ORIGEM);
    const sessoes = amb.mock.stats().uploadSessionsCreated;
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId: (lote as { loteId: string }).loteId, arquivos: [{ chave: "z", nome: "vazio.txt", caminho: "", tamanho: 0, tipo: "text/plain" }] }, escopo, ORIGEM);
    assert.ok(ini.ok && ini.resultados[0].ok && ini.resultados[0].estado === "concluido");
    assert.equal(amb.mock.stats().uploadSessionsCreated, sessoes);
    assert.ok(amb.mock.listAll().some((it) => it.name === "vazio.txt" && it.size === 0));
  });

  test("nome com bidi (\\u202E) é limpo e o original fica registrado", async () => {
    const escopo = { origem: "painel" as const, userId: amb.ids.user };
    const { raizId } = await pastas.garantirRaiz();
    const lote = await envios.abrirLote({ op: "lote", destino: { tipo: "pasta", pastaId: raizId }, arquivos: 1, bytes: 10, impressao: impressaoDe("bidi") }, escopo, ORIGEM);
    const original = "orcamento‮fdp.exe";
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId: (lote as { loteId: string }).loteId, arquivos: [{ chave: "z", nome: original, caminho: "", tamanho: 10, tipo: "application/vnd.google-apps.document" }] }, escopo, ORIGEM);
    assert.ok(ini.ok && ini.resultados[0].ok);
    const e = await amb.db.query.driveEnvios.findFirst({ where: drizzle.eq(amb.schema.driveEnvios.id, (ini.resultados[0] as { envioId: string }).envioId) });
    assert.equal(e!.nome, "orcamentofdp.exe");
    assert.equal(e!.nomeOriginal, original);
    assert.equal(e!.tipo, "application/octet-stream", "vnd.google-apps vira octet-stream");
  });
});

describe("escopo e links", () => {
  test("envio de outro link: 404; link revogado: iniciar recusa e conferir segue", async () => {
    const { linha } = await linkDaDiaria2();
    const escopoFreela = { origem: "freela" as const, link: linha };
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cartao", fonte: "cam-c", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 1, bytes: 1000, impressao: impressaoDe("revogar") },
      escopoFreela,
      ORIGEM,
    );
    const loteId = (lote as { loteId: string }).loteId;
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "a", nome: "C0001.MP4", caminho: "", tamanho: 1000, tipo: "video/mp4" }] }, escopoFreela, ORIGEM);
    const r = (ini as { resultados: { sessao: string; envioId: string }[] }).resultados[0];

    // O painel (outro escopo) não enxerga lote nem envio de freela.
    const painel = { origem: "painel" as const, userId: amb.ids.user };
    const x = await envios.conferirEnvios({ op: "conferir", envioIds: [r.envioId] }, painel);
    assert.ok(!x.ok && x.erro === "nao_encontrado");
    const y = await envios.fecharLote({ op: "fecharLote", loteId }, painel);
    assert.ok(!y.ok && y.erro === "nao_encontrado");

    // A área do cliente também não.
    const area = await links.areaDoCliente(amb.ids.cliente, { criar: true, userId: amb.ids.user });
    assert.ok(area.ok && area.link);
    const linhaArea = await links.buscarLinkPorToken(area.link!.url!.split("/cliente/")[1], "cliente-area");
    const escopoCliente = { origem: "cliente" as const, link: linhaArea!, clientId: amb.ids.cliente };
    const z = await envios.conferirEnvios({ op: "conferir", envioIds: [r.envioId] }, escopoCliente);
    assert.ok(!z.ok && z.erro === "nao_encontrado");

    // Revoga: iniciar recusa, conferir do que já começou funciona.
    await links.desativarLink(linha.id, { userId: amb.ids.user, cancelarEnvios: false });
    const revogado = await amb.db.query.driveLinks.findFirst({ where: drizzle.eq(amb.schema.driveLinks.id, linha.id) });
    assert.ok(revogado?.revogadoEm);
    const escopoRevogado = { origem: "freela" as const, link: revogado! };
    const de_novo = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "b", nome: "C0002.MP4", caminho: "", tamanho: 10, tipo: "video/mp4" }] }, escopoRevogado, ORIGEM);
    assert.ok(!de_novo.ok && de_novo.erro === "link_inativo");
    await subir(r.sessao, new Uint8Array(1000).fill(5));
    const conf = await envios.conferirEnvios({ op: "conferir", envioIds: [r.envioId] }, escopoRevogado);
    assert.ok(conf.ok && conf.resultados[0].estado === "concluido", JSON.stringify(conf));
  });

  test("cliente: projeto de outro cliente → 404; sem consentimento → recusa; limite do dia", async () => {
    const area = await links.areaDoCliente(amb.ids.cliente, { criar: true, userId: amb.ids.user });
    const linha = await links.buscarLinkPorToken(area.ok ? area.link!.url!.split("/cliente/")[1] : "", "cliente-area");
    const escopo = { origem: "cliente" as const, link: linha!, clientId: amb.ids.cliente };
    const outro = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cliente", projetoId: amb.ids.projetoOutro, assunto: "Manual", consentimento: true }, arquivos: 1, bytes: 1, impressao: impressaoDe("c1") },
      escopo,
      ORIGEM,
    );
    assert.ok(!outro.ok && outro.erro === "nao_encontrado");
    const sem = await envios.abrirLote(
      // @ts-expect-error o navegador pode mandar qualquer coisa
      { op: "lote", destino: { tipo: "cliente", projetoId: null, assunto: "Manual", consentimento: false }, arquivos: 1, bytes: 1, impressao: impressaoDe("c2") },
      escopo,
      ORIGEM,
    );
    assert.ok(!sem.ok && sem.erro === "consentimento");
    const grande = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cliente", projetoId: amb.ids.projeto, assunto: "Brutos", consentimento: true }, arquivos: 1, bytes: 51e9, impressao: impressaoDe("c3") },
      escopo,
      ORIGEM,
    );
    assert.ok(!grande.ok && grande.erro === "limite_link" && grande.cabem === 50e9, JSON.stringify(grande));
    assert.equal(!grande.ok && grande.mensagem, "Hoje dá para enviar mais 50 GB. O limite volta amanhã.");
    const ok = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cliente", projetoId: amb.ids.projeto, assunto: "Manual de marca", consentimento: true }, arquivos: 1, bytes: 100, impressao: impressaoDe("c4") },
      escopo,
      ORIGEM,
    );
    assert.ok(ok.ok && "caminho" in ok, JSON.stringify(ok));
    assert.match((ok as { caminho: string }).caminho, /03 Assets \/ Do cliente \/ \d{4}-\d{2}-\d{2} · Manual de marca$/);
  });

  test("revogarLinksDe e trocarLink: o antigo para, nada é apagado", async () => {
    const antes = await amb.db.select().from(amb.schema.driveLinks);
    const { r } = await linkDaDiaria2();
    const novo = await links.trocarLink(r.link!.id, amb.ids.user);
    assert.notEqual(novo.url, r.link!.url);
    assert.equal(novo.estado, "ativo");
    const antigo = await links.buscarLinkPorToken(r.link!.url!.split("/enviar/")[1], "freela-diaria");
    assert.ok(antigo?.revogadoEm);
    const n = await links.revogarLinksDe({ projectId: amb.ids.projeto });
    assert.ok(n >= 1);
    const depois = await amb.db.select().from(amb.schema.driveLinks);
    assert.ok(depois.length >= antes.length + 1, "links nunca são apagados");
    assert.ok(depois.filter((l) => l.projectId === amb.ids.projeto || l.eventId === amb.ids.diaria2).every((l) => l.revogadoEm));
  });
});

describe("entregas", () => {
  test("Liberar: link público só em 06 Entregas e e-mail do Google; Recolher desfaz", async () => {
    const r = await entregas.liberarEntregas(amb.ids.projeto, amb.ids.user);
    assert.ok(r.ok, r.ok ? "" : r.mensagem);
    assert.equal(r.ok && r.emailAvisado, "cliente@serhs.test");
    const dto = await pastas.pastasDoProjeto(amb.ids.projeto);
    const entregasId = dto!.pastas.find((p) => p.chave === "entregas")!.id!;
    const perms = amb.mock.permissionsOf(entregasId);
    assert.ok(perms.some((p) => p.type === "anyone" && p.role === "reader"));
    assert.ok(perms.some((p) => p.type === "user" && p.emailAddress === "cliente@serhs.test"));
    assert.equal(amb.mock.permissionsOf(dto!.pastaId!).length, 0, "a pasta do projeto continua fechada");
    assert.equal(amb.mock.stats().emailsDeCompartilhamento, 1);

    // Entregas aparecem para a área (lidas pelo id do banco).
    amb.mock.addFile("Final.mov", dto!.pastas.find((p) => p.chave === "06 Entregas/Master")!.id!, { size: 1234 });
    const lista = await entregas.entregasDoProjeto(dto!.id);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].secao, "Master");
    assert.match(lista[0].baixarUrl ?? "", /export=download/);

    // Liberar de novo não duplica.
    await entregas.liberarEntregas(amb.ids.projeto, amb.ids.user);
    assert.equal(amb.mock.permissionsOf(entregasId).length, 2);

    const rec = await entregas.recolherEntregas(amb.ids.projeto, amb.ids.user);
    assert.ok(rec.ok && rec.removidas === 2);
    assert.equal(amb.mock.permissionsOf(entregasId).length, 0);
    assert.equal((await pastas.pastasDoProjeto(amb.ids.projeto))!.entregasLiberadasEm, null);
  });

  test("Workspace bloqueia o link público: erro claro e nada escondido", async () => {
    amb.mock.setOptions({ bloquearLinkPublico: true });
    try {
      const r = await entregas.liberarEntregas(amb.ids.projeto, amb.ids.user);
      assert.ok(!r.ok);
      assert.equal(!r.ok && r.mensagem, "O Google Workspace bloqueou o link público. Veja Ajustes → Google Drive.");
      const c = await entregas.compartilhamentosDoProjeto(amb.ids.projeto);
      assert.ok(c.some((x) => x.erro && x.tipo === "anyone"));
    } finally {
      amb.mock.setOptions({ bloquearLinkPublico: false });
    }
  });
});

describe("conexão", () => {
  test("refresh revogado no Google: reconectar, sem apagar a cifra", async () => {
    const { statusDrive, esquecerToken } = await import("../../src/lib/google/conexao");
    amb.mock.revokeRefreshTokens();
    amb.mock.expireAccessTokens();
    esquecerToken();
    const r = await pastas.garantirPastasDoProjeto(amb.ids.projetoOutro, { verificar: true });
    assert.ok(!r.ok && r.erro === "reconectar", JSON.stringify(r));
    const s = await statusDrive();
    assert.equal(s.estado, "reconectar");
    const linha = await amb.db.query.driveConexao.findFirst();
    assert.ok(linha!.refreshTokenEnc, "a cifra fica: reconectar sobrescreve");
  });
});
