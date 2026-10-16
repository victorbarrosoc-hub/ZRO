/**
 * Prévia do Drive (docs/dev/drive.md §16) contra o Google falso e um Postgres em memória:
 * miniatura do painel (com e sem login, cache, tamanho, lixeira), token curto do service worker (só com login,
 * sem refresh token, Range funcionando no Google), proxy de câmera (achado e não achado) e a miniatura da área
 * do cliente (link válido, expirado, revogado, com senha, sem liberação, arquivo de fora de 06 Entregas e de
 * outro cliente) e a leitura pública com chave de API.
 *
 *   npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { NextRequest } from "next/server";
import { prepararAmbiente, type Ambiente } from "./drive-ambiente.mjs";

let amb: Ambiente;
let rotas: typeof import("../../src/lib/drive/rota-previa");
let previa: typeof import("../../src/lib/services/drive-previa");
let pastas: typeof import("../../src/lib/services/drive-pastas");
let links: typeof import("../../src/lib/services/drive-links");
let entregas: typeof import("../../src/lib/services/drive-entregas");
let midia: typeof import("../../src/lib/drive/midia");
let cookieSessao = "";

const SITE = "http://localhost:3000";
const CHAVE = "AIzaTesteChaveDeApiZRO0123456789";
// PNG de 1×1 (o conteúdo não importa: a rota só repassa).
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

function req(caminho: string, o: { cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.cookie) headers.cookie = o.cookie;
  return new NextRequest(`${SITE}${caminho}`, { headers });
}
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

before(async () => {
  amb = await prepararAmbiente({ chavesApi: [CHAVE] });
  process.env.GOOGLE_API_KEY = CHAVE;
  rotas = await import("../../src/lib/drive/rota-previa");
  previa = await import("../../src/lib/services/drive-previa");
  pastas = await import("../../src/lib/services/drive-pastas");
  links = await import("../../src/lib/services/drive-links");
  entregas = await import("../../src/lib/services/drive-entregas");
  midia = await import("../../src/lib/drive/midia");
  const { signSession } = await import("../../src/lib/auth/jwt");
  const { passwordFingerprint } = await import("../../src/lib/auth/session");
  const token = await signSession({ userId: amb.ids.user, name: "Teste Victor", pv: passwordFingerprint("x"), expiresAt: Date.now() + 3600_000 });
  cookieSessao = `zro_session=${token}`;
});

after(async () => {
  delete process.env.GOOGLE_API_KEY;
  await amb?.fechar();
});

describe("midia (puro)", () => {
  test("tipos, proxy, tamanhos e duração", () => {
    assert.equal(midia.tipoDeMidia({ nome: "A001_C003.braw" }), "video");
    assert.equal(midia.tipoDeMidia({ nome: "Final.MOV", tipo: "video/quicktime" }), "video");
    assert.equal(midia.tipoDeMidia({ nome: "legenda.srt" }), "legenda");
    assert.equal(midia.tipoDeMidia({ nome: "x", pasta: true }), "pasta");
    assert.equal(midia.podeTocar({ nome: "A.R3D" }), "nao");
    assert.equal(midia.podeTocar({ nome: "A.mov" }), "talvez");
    assert.equal(midia.podeTocar({ nome: "A.mp4" }), "sim");
    assert.ok(midia.precisaDeProxy({ nome: "clip.mxf" }));
    assert.ok(!midia.precisaDeProxy({ nome: "clip.mp4" }));
    assert.ok(midia.precisaDeProxy({ nome: "clip.mov" }, true), "ProRes que falhou procura proxy");
    const orig = { id: "1", nome: "A001_C003.BRAW" };
    const p = midia.escolherProxy(
      [
        { id: "2", nome: "A001_C003.mov" },
        { id: "3", nome: "a001_c003.MP4" },
        { id: "4", nome: "A001_C003_extra.mp4" },
        { id: "1", nome: "A001_C003.BRAW" },
      ],
      orig,
    );
    assert.equal(p?.id, "3", "mp4 antes de mov; nome-base sem maiúsculas");
    assert.equal(midia.tamanhoMiniatura(500), 640);
    assert.equal(midia.tamanhoMiniatura(5000), 2000);
    assert.equal(midia.linkComTamanho("https://lh3.googleusercontent.com/abc=s220", 640), "https://lh3.googleusercontent.com/abc=s640");
    assert.equal(midia.duracaoBR(83_000), "1:23");
    assert.equal(midia.duracaoBR(3_723_000), "1:02:03");
  });

  test("vídeo pesado demais para a rede (taxa = tamanho × 8 / duração)", () => {
    const prores = { tamanho: 1_200_000_000, duracaoMs: 10_000 }; // ~960 Mb/s
    assert.equal(Math.round(midia.taxaMbps(prores)!), 960);
    assert.ok(midia.pesadoDemais(prores, true));
    assert.ok(midia.pesadoDemais(prores, false));
    const h264 = { tamanho: 150_000_000, duracaoMs: 60_000 }; // 20 Mb/s
    assert.ok(!midia.pesadoDemais(h264, true));
    const medio = { tamanho: 1_500_000_000, duracaoMs: 60_000 }; // 200 Mb/s: pesado no celular, toca no computador
    assert.ok(midia.pesadoDemais(medio, true));
    assert.ok(!midia.pesadoDemais(medio, false));
    assert.ok(!midia.pesadoDemais({ tamanho: 1_200_000_000, duracaoMs: null }, true), "sem duração: tenta tocar");
    assert.equal(midia.linkNoDrive("abc_DEF-123"), "https://drive.google.com/file/d/abc_DEF-123/view");
  });
});

describe("miniatura do painel", () => {
  let pasta: string;
  let comMiniatura: string;
  before(() => {
    pasta = amb.mock.addFolder("Teste Prévia").id;
    comMiniatura = amb.mock.addFile("frame.jpg", pasta, { content: "jpg" }).id;
    amb.mock.setMedia(comMiniatura, { miniatura: PNG, imagem: { width: 4000, height: 3000 } });
  });

  test("sem login: 401", async () => {
    const r = await rotas.rotaMiniaturaPainel()(req(`/painel/arquivos/miniatura/${comMiniatura}`), ctx({ id: comMiniatura }));
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("cache-control"), "no-store");
  });

  test("sessão com a senha antiga não vale", async () => {
    const { signSession } = await import("../../src/lib/auth/jwt");
    const velho = await signSession({ userId: amb.ids.user, name: "x", pv: "outra", expiresAt: Date.now() + 3600_000 });
    const r = await rotas.rotaMiniaturaPainel()(req(`/painel/arquivos/miniatura/${comMiniatura}`, { cookie: `zro_session=${velho}` }), ctx({ id: comMiniatura }));
    assert.equal(r.status, 401);
  });

  test("com login: a imagem, no tamanho arredondado, sem cache compartilhado; depois vem do cache", async () => {
    const antes = amb.mock.stats();
    const r = await rotas.rotaMiniaturaPainel()(req(`/painel/arquivos/miniatura/${comMiniatura}?s=500`, { cookie: cookieSessao }), ctx({ id: comMiniatura }));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "image/png");
    assert.equal(r.headers.get("cache-control"), "private, max-age=300");
    assert.match(r.headers.get("content-security-policy") ?? "", /sandbox/);
    assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG);
    const depois = amb.mock.stats();
    assert.equal(depois.miniaturas, antes.miniaturas + 1);
    assert.equal(depois.ultimaMiniatura, 640, "500 px vira 640 (tamanhos fixos)");

    // De novo, mesmo tamanho: nem o files.get nem a miniatura vão ao Google.
    const r2 = await rotas.rotaMiniaturaPainel()(req(`/painel/arquivos/miniatura/${comMiniatura}?s=600`, { cookie: cookieSessao }), ctx({ id: comMiniatura }));
    assert.equal(r2.status, 200);
    const fim = amb.mock.stats();
    assert.equal(fim.miniaturas, depois.miniaturas);
    assert.equal(fim.requests["files.get"] ?? 0, depois.requests["files.get"] ?? 0);
  });

  test("sem miniatura, id inválido, na lixeira ou inexistente: 404", async () => {
    const sem = amb.mock.addFile("roteiro.pdf", pasta, { content: "pdf" }).id;
    const lixo = amb.mock.addFile("velho.jpg", pasta, { content: "x" }).id;
    amb.mock.setMedia(lixo, { miniatura: PNG });
    const { lixeira } = await import("../../src/lib/google/drive");
    await lixeira(lixo);
    for (const id of [sem, lixo, "../../etc", "root", "1234567890abcdefNAOEXISTE"]) {
      const r = await rotas.rotaMiniaturaPainel()(req(`/painel/arquivos/miniatura/${encodeURIComponent(id)}`, { cookie: cookieSessao }), ctx({ id }));
      assert.equal(r.status, 404, id);
    }
  });
});

describe("token curto do service worker", () => {
  test("pede o cabeçalho, a sessão e o mesmo site", async () => {
    const r1 = await rotas.rotaTokenStream()(req("/painel/arquivos/token", { cookie: cookieSessao }));
    assert.equal(r1.status, 400);
    const r2 = await rotas.rotaTokenStream()(req("/painel/arquivos/token", { headers: { "x-zro-stream": "1" } }));
    assert.equal(r2.status, 401);
    const r3 = await rotas.rotaTokenStream()(req("/painel/arquivos/token", { cookie: cookieSessao, headers: { "x-zro-stream": "1", "sec-fetch-site": "cross-site" } }));
    assert.equal(r3.status, 403);
  });

  test("com login: só o token de acesso (no-store) e ele lê o arquivo com Range no Google", async () => {
    const r = await rotas.rotaTokenStream()(req("/painel/arquivos/token", { cookie: cookieSessao, headers: { "x-zro-stream": "1", "sec-fetch-site": "same-origin" } }));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    const texto = await r.text();
    assert.doesNotMatch(texto, /refresh/i);
    const j = JSON.parse(texto) as { ok: boolean; token: string; api: string; expiraEm: number };
    assert.ok(j.ok && j.token.length > 10);
    assert.equal(j.api, `${amb.mock.url}/drive/v3`);
    assert.ok(j.expiraEm > Date.now() && j.expiraEm <= Date.now() + 15 * 60_000);

    // O que o service worker faz: alt=media com o token e o Range.
    const conteudo = Buffer.from("0123456789abcdefghij");
    const id = amb.mock.addFile("clip.webm", amb.mock.addFolder("Teste Stream").id, { content: conteudo }).id;
    const antes = amb.mock.stats().rangeGets;
    const g = await fetch(`${j.api}/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${j.token}`, Range: "bytes=5-9" } });
    assert.equal(g.status, 206);
    assert.equal(Buffer.from(await g.arrayBuffer()).toString(), "56789");
    assert.equal(amb.mock.stats().rangeGets, antes + 1);
  });
});

describe("proxy de câmera", () => {
  let cartao: string;
  before(() => {
    cartao = amb.mock.addFolder("Teste Cartão A001").id;
  });

  const pedir = async (id: string, cookie = cookieSessao) => {
    const r = await rotas.rotaProxyPainel()(req(`/painel/arquivos/proxy/${id}`, { cookie }), ctx({ id }));
    return { status: r.status, j: (await r.json()) as { ok: boolean; proxy: { id: string; nome: string } | null } };
  };

  test("na mesma pasta", async () => {
    const braw = amb.mock.addFile("A001_C003_0812AB.braw", cartao, { size: 5000 }).id;
    const mp4 = amb.mock.addFile("A001_C003_0812AB.mp4", cartao, { size: 500 }).id;
    amb.mock.addFile("A001_C003_0812AB_extra.mp4", cartao, { size: 500 });
    const { status, j } = await pedir(braw);
    assert.equal(status, 200);
    assert.equal(j.proxy?.id, mp4);
  });

  test("na subpasta Proxy (ProRes .mov com proxy .mov)", async () => {
    const mov = amb.mock.addFile("B002_C001.mov", cartao, { size: 9000 }).id;
    const sub = amb.mock.addFolder("Proxy", cartao).id;
    const proxy = amb.mock.addFile("B002_C001.mov", sub, { size: 900 }).id;
    const { j } = await pedir(mov);
    assert.equal(j.proxy?.id, proxy);
  });

  test("não achado: null; sem login: 401", async () => {
    const r3d = amb.mock.addFile("C003_A001.R3D", cartao, { size: 8000 }).id;
    const { status, j } = await pedir(r3d);
    assert.equal(status, 200);
    assert.equal(j.proxy, null);
    const sem = await pedir(r3d, "");
    assert.equal(sem.status, 401);
  });
});

describe("área do cliente", () => {
  let token = "";
  let linkId = "";
  let master = "";
  let forDeEntregas = "";
  let doOutro = "";
  let legado = "";

  const pedir = async (id: string, o: { cookie?: string; tok?: string } = {}) =>
    rotas.rotaMiniaturaCliente()(
      req(`/cliente/${o.tok ?? token}/miniatura/${id}?s=640`, { cookie: o.cookie, headers: { "x-forwarded-for": "10.0.0.9" } }),
      ctx({ token: o.tok ?? token, id }),
    );

  before(async () => {
    previa.esquecerMiniaturas();
    // Pastas do projeto do cliente e do projeto de outro cliente.
    await pastas.garantirPastasDoProjeto(amb.ids.projeto, { userId: amb.ids.user });
    await pastas.garantirPastasDoProjeto(amb.ids.projetoOutro, { userId: amb.ids.user });
    const dto = (await pastas.pastasDoProjeto(amb.ids.projeto))!;
    const dtoOutro = (await pastas.pastasDoProjeto(amb.ids.projetoOutro))!;
    const pasta = (d: typeof dto, chave: string) => d.pastas.find((p) => p.chave === chave)!.id!;
    master = amb.mock.addFile("Filme_Final.mp4", pasta(dto, "06 Entregas/Master"), { content: "0123456789".repeat(10) }).id;
    amb.mock.setMedia(master, { miniatura: PNG, video: { width: 1920, height: 1080, durationMillis: "83000" } });
    legado = amb.mock.addFile("Antigo.mp4", pasta(dto, "06 Entregas/Redes"), { content: "abc", resourceKey: true }).id;
    forDeEntregas = amb.mock.addFile("Render_v1.mp4", pasta(dto, "render"), { content: "x" }).id;
    amb.mock.setMedia(forDeEntregas, { miniatura: PNG });
    doOutro = amb.mock.addFile("Outro_Final.mp4", pasta(dtoOutro, "06 Entregas/Master"), { content: "x" }).id;
    amb.mock.setMedia(doOutro, { miniatura: PNG });

    const a = await links.areaDoCliente(amb.ids.cliente, { criar: true, userId: amb.ids.user });
    assert.ok(a.ok && a.link?.url);
    token = a.link.url.split("/cliente/")[1];
    linkId = a.link.id;
  });

  test("sem liberar as entregas: 404", async () => {
    assert.equal((await pedir(master)).status, 404);
  });

  test("liberado: a miniatura da entrega; de fora de 06 Entregas e de outro cliente: 404", async () => {
    const r = await entregas.liberarEntregas(amb.ids.projeto, amb.ids.user);
    assert.ok(r.ok);
    await entregas.liberarEntregas(amb.ids.projetoOutro, amb.ids.user);
    const ok = await pedir(master);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("cache-control"), "private, max-age=120");
    assert.deepEqual(new Uint8Array(await ok.arrayBuffer()), PNG);
    assert.equal((await pedir(forDeEntregas)).status, 404, "05 Render não aparece");
    assert.equal((await pedir(doOutro)).status, 404, "06 Entregas de outro cliente não aparece (IDOR)");
    assert.equal((await pedir("root")).status, 404);
    assert.equal((await pedir(master, { tok: "x".repeat(43) })).status, 404, "token que não existe");
  });

  test("os dados de mídia chegam na entrega e a leitura pública com a chave toca com Range", async () => {
    const dto = (await pastas.pastasDoProjeto(amb.ids.projeto))!;
    const lista = await entregas.entregasDoProjeto(dto.id);
    const e = lista.find((x) => x.id === master)!;
    assert.equal(e.midia.miniatura, true);
    assert.equal(e.midia.duracaoMs, 83000);
    assert.equal(e.midia.largura, 1920);
    const url = previa.urlPublicaDeMidia(e);
    assert.ok(url?.startsWith(`${amb.mock.url}/drive/v3/files/${master}?alt=media`));
    assert.ok(url!.includes(`key=${CHAVE}`));
    const g = await fetch(url!, { headers: { Range: "bytes=0-4" } });
    assert.equal(g.status, 206);
    assert.equal(Buffer.from(await g.arrayBuffer()).toString(), "01234");
    // resourceKey: sem endereço direto (a página usa a prévia do Google).
    assert.equal(previa.urlPublicaDeMidia(lista.find((x) => x.id === legado)!), null);
    // Arquivo de fora de 06 Entregas não abre com a chave (não tem link público).
    const fora = await fetch(`${amb.mock.url}/drive/v3/files/${forDeEntregas}?alt=media&key=${CHAVE}`);
    assert.equal(fora.status, 404);
    // Sem a variável, nada de endereço direto.
    delete process.env.GOOGLE_API_KEY;
    assert.equal(previa.urlPublicaDeMidia(e), null);
    process.env.GOOGLE_API_KEY = CHAVE;
  });

  test("com senha: só com o cookie da área", async () => {
    await links.definirSenha(linkId, "senha-teste");
    assert.equal((await pedir(master)).status, 404);
    const link = (await links.buscarLinkPorToken(token, "cliente-area"))!;
    const cookie = `${links.COOKIE_AREA}=${await links.assinarCookieDaArea(link)}`;
    assert.equal((await pedir(master, { cookie })).status, 200);
    await links.definirSenha(linkId, null);
    assert.equal((await pedir(master, { cookie })).status, 200, "sem senha, abre");
  });

  test("expirado: 404", async () => {
    await links.definirValidade(linkId, new Date(Date.now() - 60_000));
    assert.equal((await pedir(master)).status, 404);
    await links.definirValidade(linkId, null);
    assert.equal((await pedir(master)).status, 200);
  });

  test("Recolher: a miniatura e a leitura pública param na hora", async () => {
    await entregas.recolherEntregas(amb.ids.projeto, amb.ids.user);
    assert.equal((await pedir(master)).status, 404);
    const g = await fetch(`${amb.mock.url}/drive/v3/files/${master}?alt=media&key=${CHAVE}`);
    assert.equal(g.status, 404, "sem o link público, a chave não lê");
    await entregas.liberarEntregas(amb.ids.projeto, amb.ids.user);
    assert.equal((await pedir(master)).status, 200);
  });

  test("revogado: 404", async () => {
    await links.desativarLink(linkId, { userId: amb.ids.user, cancelarEnvios: false });
    assert.equal((await pedir(master)).status, 404);
  });
});

describe("reserva sem service worker", () => {
  test("redireciona para o Google (ver e baixar), só com login", async () => {
    const id = "1AbCdEfGhIjKlMnOp";
    const sem = await rotas.rotaStreamReserva()(req(`/painel/stream/arquivo/${id}`), ctx({ id }));
    assert.equal(sem.status, 401);
    const ver = await rotas.rotaStreamReserva()(req(`/painel/stream/arquivo/${id}`, { cookie: cookieSessao }), ctx({ id }));
    assert.equal(ver.status, 302);
    assert.equal(ver.headers.get("location"), `https://drive.google.com/file/d/${id}/view`);
    const baixar = await rotas.rotaStreamReserva()(req(`/painel/stream/arquivo/${id}?baixar=1`, { cookie: cookieSessao }), ctx({ id }));
    assert.equal(baixar.headers.get("location"), `https://drive.google.com/uc?id=${id}&export=download`);
  });
});

describe("Google desconectado", () => {
  test("token: 409; miniatura: 404", async () => {
    previa.esquecerMiniaturas();
    amb.mock.revokeRefreshTokens();
    amb.mock.expireAccessTokens();
    const { esquecerToken } = await import("../../src/lib/google/conexao");
    esquecerToken();
    const r = await rotas.rotaTokenStream()(req("/painel/arquivos/token", { cookie: cookieSessao, headers: { "x-zro-stream": "1" } }));
    assert.equal(r.status, 409);
    const id = amb.mock.addFile("depois.jpg", "root", { content: "x" }).id;
    amb.mock.setMedia(id, { miniatura: PNG });
    const m = await rotas.rotaMiniaturaPainel()(req(`/painel/arquivos/miniatura/${id}`, { cookie: cookieSessao }), ctx({ id }));
    assert.ok(m.status === 404 || m.status === 502, String(m.status));
  });
});
