/**
 * Link de envio por card da Pauta (docs/dev/drive.md §15), contra o Google falso e um Postgres em
 * memória: criar, um ativo por card, trocar destino, envio sem rolo na pasta certa, card com mensagem e
 * links uma vez só (fechar duas vezes), link revogado/expirado e escopo (IDOR).
 *
 *   npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { caminhoNoMock, ORIGEM, prepararAmbiente, type Ambiente } from "./drive-ambiente.mjs";

let amb: Ambiente;
let pastas: typeof import("../../src/lib/services/drive-pastas");
let envios: typeof import("../../src/lib/services/drive-envios");
let links: typeof import("../../src/lib/services/drive-links");
let quadro: typeof import("../../src/app/(painel)/painel/quadro/servidor");
let protocolo: typeof import("../../src/lib/drive/protocolo");
let drizzle: typeof import("drizzle-orm");

const CARD = "cTesteLink01";
const impressaoDe = (texto: string) => createHash("sha256").update(texto).digest("hex");
let subpastas: Record<string, string> = {};
let renderId = "";

before(async () => {
  amb = await prepararAmbiente();
  pastas = await import("../../src/lib/services/drive-pastas");
  envios = await import("../../src/lib/services/drive-envios");
  links = await import("../../src/lib/services/drive-links");
  quadro = await import("../../src/app/(painel)/painel/quadro/servidor");
  protocolo = await import("../../src/lib/drive/protocolo");
  drizzle = await import("drizzle-orm");

  const r = await pastas.garantirPastasDoProjeto(amb.ids.projeto);
  assert.ok(r.ok, r.ok ? "" : r.mensagem);
  const dto = await pastas.pastasDoProjeto(amb.ids.projeto);
  subpastas = Object.fromEntries(dto!.pastas.map((p) => [p.chave, p.id!]));
  renderId = subpastas.render;

  const criado = await quadro.quadroCriar(amb.ids.user, "zro", CARD, {
    tema: "Verão em Pipa",
    coluna: "fazendo",
    cliente: amb.ids.cliente,
    formatos: ["Reels"],
    resp: `f:${amb.ids.rafael}`,
    projeto: amb.ids.projeto,
    links: [{ url: "https://vimeo.com/123456", nome: "Corte 1" }],
  });
  assert.ok(criado.ok);
});

after(async () => {
  await amb?.fechar();
});

/** Manda os bytes para a sessão pelo Node (como o navegador faria). */
async function subir(sessao: string, dados: Uint8Array): Promise<number> {
  const r = await fetch(sessao, {
    method: "PUT",
    headers: { "Content-Range": `bytes 0-${dados.length - 1}/${dados.length}`, Origin: ORIGEM },
    body: dados.slice(),
    redirect: "manual",
  });
  await r.arrayBuffer();
  return r.status;
}

async function linhaDoLink(url: string) {
  const token = url.split("/enviar/")[1];
  const linha = await links.buscarLinkPorToken(token, "freela-card");
  assert.ok(linha, "link pelo token");
  return { token, linha: linha! };
}

async function lerCard() {
  const [row] = await amb.db
    .select()
    .from(amb.schema.quadroCards)
    .where(drizzle.and(drizzle.eq(amb.schema.quadroCards.org, "zro"), drizzle.eq(amb.schema.quadroCards.id, CARD)));
  return row;
}

describe("link do card", () => {
  test("cria com o destino escolhido, 30 dias de validade e endereço /enviar", async () => {
    const vazio = await links.linkDoCard(CARD, { userId: amb.ids.user });
    assert.ok(vazio.ok, vazio.ok ? "" : vazio.mensagem);
    assert.equal(vazio.ok && vazio.link, null);
    assert.deepEqual(
      vazio.ok && vazio.destinos.map((d) => d.rotulo),
      ["06 Entregas / Master", "06 Entregas / Redes", "06 Entregas / Legendas", "05 Render"],
    );
    assert.equal(vazio.ok && vazio.titulo, "Teste SERHS · Reels · Verão em Pipa");

    const r = await links.linkDoCard(CARD, { userId: amb.ids.user, criar: { destino: "Redes" } });
    assert.ok(r.ok && r.link, JSON.stringify(r));
    const link = r.ok ? r.link! : null;
    assert.equal(link!.tipo, "freela-card");
    assert.equal(link!.estado, "ativo");
    assert.equal(link!.destinoRotulo, "06 Entregas / Redes");
    assert.match(link!.url!, /\/enviar\/[A-Za-z0-9_-]{43}$/);
    const dias = (link!.expiraEm!.getTime() - Date.now()) / 86_400_000;
    assert.ok(dias > 29 && dias < 31.1, `validade de ~30 dias (${dias})`);
    const { linha } = await linhaDoLink(link!.url!);
    assert.equal(linha.cardId, CARD);
    assert.equal(linha.destinoPastaId, subpastas["06 Entregas/Redes"]);
    assert.equal(linha.projectId, amb.ids.projeto);
    assert.equal(linha.limiteBytes, null, "sem limite de tamanho");
    // O token do card não abre a área do cliente nem passa por link de diária.
    assert.equal(await links.buscarLinkPorToken(link!.url!.split("/enviar/")[1], "cliente-area"), null);
    assert.equal(await links.buscarLinkPorToken(link!.url!.split("/enviar/")[1], "freela-diaria"), null);
  });

  test("um ativo por card: pedir de novo devolve o mesmo; o banco recusa um segundo ativo", async () => {
    const a = await links.linkDoCard(CARD, { userId: amb.ids.user, criar: { destino: "Master" } });
    const b = await links.linkDoCard(CARD, { userId: amb.ids.user, criar: { destino: "render" } });
    assert.ok(a.ok && b.ok);
    assert.equal(a.ok && a.link!.id, b.ok && b.link!.id);
    assert.equal(b.ok && b.link!.destinoRotulo, "06 Entregas / Redes", "o destino não muda por pedir de novo");
    await assert.rejects(
      amb.db.insert(amb.schema.driveLinks).values({ tipo: "freela-card", tokenHash: "f".repeat(64), cardId: CARD, rotulo: "duplicado" }),
      "índice parcial: um ativo por card",
    );
    const ativos = await amb.db
      .select()
      .from(amb.schema.driveLinks)
      .where(drizzle.and(drizzle.eq(amb.schema.driveLinks.cardId, CARD), drizzle.isNull(amb.schema.driveLinks.revogadoEm)));
    assert.equal(ativos.length, 1);
  });

  test("trocar destino muda a pasta e mantém o mesmo token", async () => {
    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const link = r.ok ? r.link! : null;
    const t = await links.trocarDestinoDoCard(link!.id, "render");
    assert.ok(t.ok);
    const { linha } = await linhaDoLink(link!.url!);
    assert.equal(linha.destinoPastaId, renderId);
    assert.equal(linha.destinoRotulo, "05 Render");
    assert.equal(linha.id, link!.id);
    const volta = await links.trocarDestinoDoCard(link!.id, "Redes");
    assert.ok(volta.ok);
    const card = await links.linkDoCard(CARD, { userId: amb.ids.user });
    assert.equal(card.ok && card.link!.destinoRotulo, "06 Entregas / Redes");
  });

  test("WhatsApp: curto, sem exclamação, com o título, o link e o destino", () => {
    const t = links.textoWhatsAppCard({ nome: "Rafael Moura", titulo: "SERHS · Reels · Verão", url: "https://x/enviar/abc", destino: "06 Entregas / Redes" });
    assert.equal(t, "Olá, Rafael. Link para subir a peça final de “SERHS · Reels · Verão”: https://x/enviar/abc. Vai direto para 06 Entregas / Redes, com o nome original do arquivo.");
    assert.ok(!t.includes("!"));
  });
});

describe("envio pelo link do card", () => {
  test("envio completo cai na pasta do link, com o nome original e sem rolo; o card recebe mensagem e links uma vez só", async () => {
    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const { linha } = await linhaDoLink(r.ok ? r.link!.url! : "");
    const escopo = { origem: "freela" as const, link: linha };
    const antesDoMock = amb.mock.listAll().length;

    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 2, bytes: 3000, impressao: impressaoDe("peca-1") },
      escopo,
      ORIGEM,
    );
    assert.ok(lote.ok && "loteId" in lote, JSON.stringify(lote));
    const loteId = (lote as { loteId: string }).loteId;
    assert.equal((lote as { rotulo: string }).rotulo, "06 Entregas / Redes · Teste Rafael Moura");
    assert.ok((lote as { caminho: string }).caminho.endsWith(" / 06 Entregas / Redes"));
    // Mesmos arquivos de novo: o mesmo lote (retomada), sem pergunta de cartão.
    const igual = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 2, bytes: 3000, impressao: impressaoDe("peca-1") },
      escopo,
      ORIGEM,
    );
    assert.ok(igual.ok && "loteId" in igual && igual.loteId === loteId && igual.retomado);

    const l0 = await amb.db.query.driveLotes.findFirst({ where: drizzle.eq(amb.schema.driveLotes.id, loteId) });
    assert.equal(l0!.rolo, null);
    assert.equal(l0!.fonte, null);
    assert.equal(l0!.cardId, CARD);
    assert.equal(l0!.pastaId, subpastas["06 Entregas/Redes"]);
    assert.equal(amb.mock.listAll().length, antesDoMock, "nenhuma pasta de rolo criada");

    const arquivos = [
      { chave: "a", nome: "SERHS_Verao_Reels_v3.mp4", caminho: "", tamanho: 2000, tipo: "video/mp4" },
      { chave: "b", nome: "SERHS_Verao_Reels_v3.srt", caminho: "", tamanho: 1000, tipo: "text/plain" },
    ];
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos }, escopo, ORIGEM);
    assert.ok(ini.ok, JSON.stringify(ini));
    const res = (ini as { resultados: { ok: boolean; sessao?: string; envioId?: string }[] }).resultados;
    for (const [i, x] of res.entries()) assert.equal(await subir(x.sessao!, new Uint8Array(arquivos[i].tamanho).fill(7)), 200);
    const conf = await envios.conferirEnvios({ op: "conferir", envioIds: res.map((x) => x.envioId!) }, escopo);
    assert.ok(conf.ok && conf.resultados.every((x) => x.estado === "concluido"), JSON.stringify(conf));

    const historicoAntes = await amb.db.select().from(amb.schema.quadroHistorico).where(drizzle.eq(amb.schema.quadroHistorico.cardId, CARD));
    const f1 = await envios.fecharLote({ op: "fecharLote", loteId }, escopo);
    const f2 = await envios.fecharLote({ op: "fecharLote", loteId }, escopo);
    assert.ok(f1.ok && f1.estado === "concluido" && f1.arquivos === 2, JSON.stringify(f1));
    assert.ok(f2.ok && f2.estado === "concluido");

    // No Drive: os dois arquivos com o nome original, direto em 06 Entregas/Redes.
    const noDrive = amb.mock.listAll().filter((it) => !it.isFolder && it.parents.includes(subpastas["06 Entregas/Redes"]));
    assert.deepEqual(noDrive.map((it) => it.name).sort(), ["SERHS_Verao_Reels_v3.mp4", "SERHS_Verao_Reels_v3.srt"]);
    assert.match(caminhoNoMock(amb.mock, noDrive[0].id), /\/06 Entregas\/Redes\/SERHS_Verao_Reels_v3\./);

    // No card: a mensagem e os links (o link antigo fica; os novos uma vez só).
    const card = (await lerCard()).dados as Record<string, unknown>;
    const msg = card[`cm_env_${loteId}`] as { por: string; txt: string; em: number };
    assert.equal(msg.txt, "Teste subiu 2 arquivos em 06 Entregas / Redes.");
    assert.equal(msg.por, "Link de envio");
    const ls = card.links as { url: string; nome: string }[];
    assert.equal(ls.length, 3);
    assert.equal(ls[0].url, "https://vimeo.com/123456");
    const ids = noDrive.map((it) => it.id);
    for (const it of noDrive) assert.ok(ls.some((x) => x.url === `https://drive.google.com/file/d/${it.id}/view` && x.nome === it.name));
    assert.equal(new Set(ls.map((x) => x.url)).size, 3);
    assert.ok(ids.length === 2);
    const historicoDepois = await amb.db.select().from(amb.schema.quadroHistorico).where(drizzle.eq(amb.schema.quadroHistorico.cardId, CARD));
    assert.equal(historicoDepois.length - historicoAntes.length, 1, "uma gravação no card, mesmo fechando duas vezes");
    assert.equal(historicoDepois.at(-1)!.quem, `link:${linha.id}`);

    // Atividade do projeto: uma linha.
    const atividades = await amb.db
      .select()
      .from(amb.schema.activities)
      .where(drizzle.and(drizzle.eq(amb.schema.activities.projectId, amb.ids.projeto), drizzle.like(amb.schema.activities.content, "%peça de “Teste SERHS · Reels · Verão em Pipa”%")));
    assert.equal(atividades.length, 1);
    assert.match(atividades[0].content, /^Teste Rafael Moura enviou a peça de “Teste SERHS · Reels · Verão em Pipa” para 06 Entregas \/ Redes: 2 arquivos, 3 KB\.$/);

    // A conciliação (que fecha lotes parados) também não repete nada.
    await envios.conciliarParados();
    const deNovo = (await lerCard()).dados as Record<string, unknown>;
    assert.equal((deNovo.links as unknown[]).length, 3);
  });

  test("link já na lista não entra de novo (mesmo arquivo em outro lote)", async () => {
    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const { linha } = await linhaDoLink(r.ok ? r.link!.url! : "");
    const escopo = { origem: "freela" as const, link: linha };
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { nome: "Teste Ana Editora" } }, arquivos: 1, bytes: 2000, impressao: impressaoDe("peca-2") },
      escopo,
      ORIGEM,
    );
    assert.ok(lote.ok && "loteId" in lote, JSON.stringify(lote));
    const loteId = (lote as { loteId: string }).loteId;
    const ini = await envios.iniciarArquivos(
      { op: "iniciar", loteId, arquivos: [{ chave: "a", nome: "SERHS_Verao_Reels_v3.mp4", caminho: "", tamanho: 2000, tipo: "video/mp4" }] },
      escopo,
      ORIGEM,
    );
    const r0 = (ini as { resultados: { estado: string; jaRecebido?: boolean }[] }).resultados[0];
    assert.equal(r0.estado, "concluido");
    assert.equal(r0.jaRecebido, true);
    await envios.fecharLote({ op: "fecharLote", loteId }, escopo);
    const card = (await lerCard()).dados as Record<string, unknown>;
    assert.equal((card.links as unknown[]).length, 3, "o arquivo já estava nos links");
    assert.equal((card[`cm_env_${loteId}`] as { txt: string }).txt, "Teste subiu 1 arquivo em 06 Entregas / Redes.");
  });

  test("'Enviar aqui' do painel com o card: só pastas do projeto do card; o card recebe mensagem de quem enviou e os links", async () => {
    const painel = { origem: "painel" as const, userId: amb.ids.user };
    const fora = await envios.abrirLote(
      { op: "lote", destino: { tipo: "pasta", pastaId: subpastas["01 Cenas"] ?? subpastas.cenas, cardId: CARD }, arquivos: 1, bytes: 10, impressao: impressaoDe("fora") },
      painel,
      ORIGEM,
    );
    assert.equal(!fora.ok && fora.erro, "formato", "pasta que não é destino do card");
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "pasta", pastaId: subpastas["06 Entregas/Master"], cardId: CARD }, arquivos: 1, bytes: 1500, impressao: impressaoDe("painel-1") },
      painel,
      ORIGEM,
    );
    assert.ok(lote.ok && "loteId" in lote, JSON.stringify(lote));
    const loteId = (lote as { loteId: string }).loteId;
    assert.equal((lote as { rotulo: string }).rotulo, "06 Entregas / Master");
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "m", nome: "Master_Final.mov", caminho: "", tamanho: 1500, tipo: "video/quicktime" }] }, painel, ORIGEM);
    const x = (ini as { resultados: { envioId: string; sessao: string }[] }).resultados[0];
    assert.equal(await subir(x.sessao, new Uint8Array(1500).fill(9)), 200);
    await envios.conferirEnvios({ op: "conferir", envioIds: [x.envioId] }, painel);
    await envios.fecharLote({ op: "fecharLote", loteId }, painel);
    await envios.fecharLote({ op: "fecharLote", loteId }, painel);
    const card = (await lerCard()).dados as Record<string, unknown>;
    const msg = card[`cm_env_${loteId}`] as { por: string; txt: string };
    assert.equal(msg.txt, "Teste subiu 1 arquivo em 06 Entregas / Master.");
    assert.equal(msg.por, `u:${amb.ids.user}`);
    const ls = card.links as { url: string; nome: string }[];
    assert.equal(ls.filter((l) => l.nome === "Master_Final.mov").length, 1);
    // Sem cardId, o painel continua mandando para qualquer pasta, sem tocar em card.
    const solto = await envios.abrirLote(
      { op: "lote", destino: { tipo: "pasta", pastaId: subpastas["06 Entregas/Master"] }, arquivos: 1, bytes: 1, impressao: impressaoDe("solto") },
      painel,
      ORIGEM,
    );
    assert.ok(solto.ok && "rotulo" in solto && solto.rotulo === "Master");
  });

  test("pessoa: só o freela do card pelo id; outro freela é recusado; nome livre precisa de 2 letras", async () => {
    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const { linha } = await linhaDoLink(r.ok ? r.link!.url! : "");
    const escopo = { origem: "freela" as const, link: linha };
    const carla = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { freelancerId: amb.ids.carla } }, arquivos: 1, bytes: 1, impressao: impressaoDe("carla") },
      escopo,
      ORIGEM,
    );
    assert.equal(carla.ok, false);
    assert.equal(!carla.ok && carla.erro, "formato");
    const curto = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { nome: "A" } }, arquivos: 1, bytes: 1, impressao: impressaoDe("curto") },
      escopo,
      ORIGEM,
    );
    assert.equal(curto.ok, false);
  });
});

describe("escopo e validade", () => {
  test("o token do card não escolhe pasta: destino com pasta é recusado no formato, cartão também", async () => {
    const comPasta = protocolo.esquemas.lote.safeParse({
      op: "lote",
      destino: { tipo: "card", pessoa: { nome: "Teste Intruso" }, pastaId: subpastas["06 Entregas/Master"] },
      arquivos: 1,
      bytes: 1,
      impressao: impressaoDe("x"),
    });
    assert.equal(comPasta.success, false);

    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const { linha } = await linhaDoLink(r.ok ? r.link!.url! : "");
    const escopo = { origem: "freela" as const, link: linha };
    const cartao = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cartao", fonte: "cam-a", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 1, bytes: 1, impressao: impressaoDe("cartao") },
      escopo,
      ORIGEM,
    );
    assert.equal(!cartao.ok && cartao.erro, "formato");
    const pasta = await envios.abrirLote(
      { op: "lote", destino: { tipo: "pasta", pastaId: subpastas["06 Entregas/Master"] }, arquivos: 1, bytes: 1, impressao: impressaoDe("pasta") },
      escopo,
      ORIGEM,
    );
    assert.equal(!pasta.ok && pasta.erro, "formato");

    // E o link da diária não aceita destino de card.
    const diaria = await links.linkDaDiaria(amb.ids.diaria2, { criar: true, userId: amb.ids.user });
    assert.ok(diaria.ok);
    const ld = await links.buscarLinkPorToken(diaria.ok ? diaria.link!.url!.split("/enviar/")[1] : "", "freela-diaria");
    const naDiaria = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { nome: "Teste Intruso" } }, arquivos: 1, bytes: 1, impressao: impressaoDe("na-diaria") },
      { origem: "freela", link: ld! },
      ORIGEM,
    );
    assert.equal(!naDiaria.ok && naDiaria.erro, "formato");
  });

  test("IDOR: envio e lote de outro link não são vistos pelo token do card", async () => {
    const diaria = await links.linkDaDiaria(amb.ids.diaria2, { criar: false, userId: amb.ids.user });
    const ld = await links.buscarLinkPorToken(diaria.ok ? diaria.link!.url!.split("/enviar/")[1] : "", "freela-diaria");
    const escopoDiaria = { origem: "freela" as const, link: ld! };
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "cartao", fonte: "cam-c", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 1, bytes: 10, impressao: impressaoDe("idor") },
      escopoDiaria,
      ORIGEM,
    );
    assert.ok(lote.ok && "loteId" in lote, JSON.stringify(lote));
    const loteId = (lote as { loteId: string }).loteId;
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "a", nome: "C0001.MP4", caminho: "", tamanho: 10, tipo: "video/mp4" }] }, escopoDiaria, ORIGEM);
    const envioId = (ini as { resultados: { envioId: string }[] }).resultados[0].envioId;

    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const { linha } = await linhaDoLink(r.ok ? r.link!.url! : "");
    const escopoCard = { origem: "freela" as const, link: linha };
    const c = await envios.conferirEnvios({ op: "conferir", envioIds: [envioId] }, escopoCard);
    assert.equal(!c.ok && c.erro, "nao_encontrado");
    const i = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "b", nome: "x.mp4", caminho: "", tamanho: 1, tipo: "video/mp4" }] }, escopoCard, ORIGEM);
    assert.equal(!i.ok && i.erro, "nao_encontrado");
    const f = await envios.fecharLote({ op: "fecharLote", loteId }, escopoCard);
    assert.equal(!f.ok && f.erro, "nao_encontrado");
  });

  test("expirado: não abre lote, mas o envio já começado ainda confere; revogado: iniciar recusa", async () => {
    const r = await links.linkDoCard(CARD, { userId: amb.ids.user });
    const { linha } = await linhaDoLink(r.ok ? r.link!.url! : "");
    const escopo = { origem: "freela" as const, link: linha };
    const lote = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 1, bytes: 500, impressao: impressaoDe("validade") },
      escopo,
      ORIGEM,
    );
    const loteId = (lote as { loteId: string }).loteId;
    const ini = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "a", nome: "final.mov", caminho: "", tamanho: 500, tipo: "video/quicktime" }] }, escopo, ORIGEM);
    const x = (ini as { resultados: { envioId: string; sessao: string }[] }).resultados[0];
    assert.equal(await subir(x.sessao, new Uint8Array(500).fill(3)), 200);

    await links.definirValidade(linha.id, new Date(Date.now() - 1000));
    const vencido = (await links.buscarLinkPorToken(r.ok ? r.link!.url!.split("/enviar/")[1] : "", "freela-card"))!;
    assert.equal(links.estadoDoLink(vencido), "expirado");
    const novo = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 1, bytes: 1, impressao: impressaoDe("depois") },
      { origem: "freela", link: vencido },
      ORIGEM,
    );
    assert.equal(!novo.ok && novo.erro, "link_inativo");
    const conf = await envios.conferirEnvios({ op: "conferir", envioIds: [x.envioId] }, { origem: "freela", link: vencido });
    assert.ok(conf.ok && conf.resultados[0].estado === "concluido", JSON.stringify(conf));

    // Gerar de novo com o expirado: sai o velho, entra um ativo novo (outro token).
    const outro = await links.linkDoCard(CARD, { userId: amb.ids.user, criar: { destino: "Master" } });
    assert.ok(outro.ok && outro.link!.estado === "ativo" && outro.link!.id !== linha.id);
    assert.equal(outro.ok && outro.link!.destinoRotulo, "06 Entregas / Master");

    await links.desativarLink(outro.ok ? outro.link!.id : "", { userId: amb.ids.user, cancelarEnvios: false });
    const revogado = (await links.buscarLinkPorToken(outro.ok ? outro.link!.url!.split("/enviar/")[1] : "", "freela-card"))!;
    assert.equal(links.estadoDoLink(revogado), "desativado");
    const ab = await envios.abrirLote(
      { op: "lote", destino: { tipo: "card", pessoa: { freelancerId: amb.ids.rafael } }, arquivos: 1, bytes: 1, impressao: impressaoDe("revogado") },
      { origem: "freela", link: revogado },
      ORIGEM,
    );
    assert.equal(!ab.ok && ab.erro, "link_inativo");
    const ini2 = await envios.iniciarArquivos({ op: "iniciar", loteId, arquivos: [{ chave: "z", nome: "z.mov", caminho: "", tamanho: 1, tipo: "video/quicktime" }] }, { origem: "freela", link: { ...linha, revogadoEm: new Date() } }, ORIGEM);
    assert.equal(!ini2.ok && ini2.erro, "link_inativo");
    // Nunca apagado: as duas linhas continuam no banco.
    const todas = await amb.db.select().from(amb.schema.driveLinks).where(drizzle.eq(amb.schema.driveLinks.cardId, CARD));
    assert.equal(todas.length, 2);
  });

  test("trocar link mantém card e destino; card na lixeira não recebe nada", async () => {
    const r = await links.linkDoCard(CARD, { userId: amb.ids.user, criar: { destino: "Legendas" } });
    assert.ok(r.ok && r.link);
    const novo = await links.trocarLink(r.ok ? r.link!.id : "", amb.ids.user);
    assert.equal(novo.cardId, CARD);
    assert.equal(novo.destinoRotulo, "06 Entregas / Legendas");
    assert.equal(novo.estado, "ativo");

    const m = await quadro.quadroMudar(amb.ids.user, "zro", CARD, { apagadoEm: Date.now() });
    assert.ok(m.ok);
    const { registrarEnvioNoCard } = await import("../../src/lib/services/drive-card");
    const [lote] = await amb.db.select().from(amb.schema.driveLotes).where(drizzle.eq(amb.schema.driveLotes.cardId, CARD)).limit(1);
    assert.equal(await registrarEnvioNoCard(lote.id), false);
    const depois = await links.linkDoCard(CARD, { userId: amb.ids.user });
    assert.equal(depois.ok, false, "card apagado não mostra link");
  });
});
