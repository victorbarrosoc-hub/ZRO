// E2E do protocolo de envio (bloco BASE, sem telas): as três rotas, a conexão por Ajustes e a segurança.
// docs/dev/drive.md §13.6.
//
// Precisa, no ar: `node scripts/google-mock/servidor.mjs` e `npm run dev`, com o .env.local apontando
// para o Google falso (GOOGLE_CLIENT_ID=zro-teste.apps.googleusercontent.com, GOOGLE_CLIENT_SECRET=GOCSPX-zro-teste,
// ZRO_GOOGLE_API_BASE=http://127.0.0.1:54400). Usa o banco do dev por ZRO_LOCAL_DB_URL e apaga, no fim,
// tudo o que criou (ids começando com "teste-e2e-").
//
//   node scripts/drive-e2e-protocolo.mjs
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { openLogged } from "./lib/session.mjs";

const SITE = process.env.ZRO_SITE ?? "http://localhost:3000";
const ORIGEM = new URL(SITE).origin;
const CONTROLE = process.env.ZRO_MOCK_CONTROLE_URL ?? "http://127.0.0.1:54401";
const sql = postgres(process.env.ZRO_LOCAL_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/postgres", {
  max: 1,
  prepare: false,
  onnotice: () => {},
});

const resultados = [];
async function passo(nome, fn) {
  try {
    const r = await fn();
    resultados.push(["ok", nome]);
    console.log(`ok      ${nome}${r === "pulado" ? " (pulado)" : ""}`);
  } catch (e) {
    resultados.push(["FALHOU", nome, e?.message ?? String(e)]);
    console.log(`FALHOU  ${nome}\n        ${String(e?.message ?? e).split("\n").join("\n        ")}`);
  }
}

/* ---------------- apoio ---------------- */

const controle = {
  opcoes: (o) => fetch(`${CONTROLE}/opcoes`, { method: "POST", body: JSON.stringify(o) }).then((r) => r.json()),
  stats: () => fetch(`${CONTROLE}/stats`).then((r) => r.json()),
  arquivos: (pasta) => fetch(`${CONTROLE}/arquivos${pasta ? `?pasta=${encodeURIComponent(pasta)}` : ""}`).then((r) => r.json()),
};

const sufixo = randomBytes(4).toString("hex");
const id = (nome) => `teste-e2e-${nome}-${sufixo}`;
const token = () => randomBytes(32).toString("base64url");
const hash = (t) => createHash("sha256").update(t).digest("hex");
const impressao = (t) => createHash("sha256").update(`${t}-${sufixo}`).digest("hex");
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const maisDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function api(caminho, corpo, { origem = ORIGEM, tipo = "application/json", cookie, bruto } = {}) {
  const headers = {};
  if (origem) headers.Origin = origem;
  if (tipo) headers["Content-Type"] = tipo;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${SITE}${caminho}`, {
    method: "POST",
    headers,
    body: bruto ?? JSON.stringify(corpo),
    redirect: "manual",
  });
  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

/** Os bytes direto na sessão (como o navegador). Devolve o status do último PUT. */
async function subir(sessao, dados, pedaco = 256 * 1024) {
  let status = 0;
  for (let inicio = 0; inicio < dados.length; inicio += pedaco) {
    const fim = Math.min(inicio + pedaco, dados.length);
    const r = await fetch(sessao, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${inicio}-${fim - 1}/${dados.length}`, Origin: ORIGEM },
      body: dados.subarray(inicio, fim),
      redirect: "manual",
    });
    status = r.status;
    await r.arrayBuffer();
  }
  return status;
}

function pastasRepetidas(itens) {
  const vistos = new Map();
  for (const it of itens) {
    if (!it.pasta || it.lixeira) continue;
    const k = `${it.pais[0]}/${it.nome}`;
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  return [...vistos.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

async function esperar(cond, ms = 15_000, passoMs = 300) {
  const fim = Date.now() + ms;
  for (;;) {
    const r = await cond();
    if (r) return r;
    if (Date.now() > fim) throw new Error("tempo esgotado");
    await new Promise((ok) => setTimeout(ok, passoMs));
  }
}

/* ---------------- pré-requisitos ---------------- */

try {
  await controle.stats();
} catch {
  console.error(`O Google falso não respondeu em ${CONTROLE}. Rode: node scripts/google-mock/servidor.mjs`);
  process.exit(1);
}
try {
  const r = await fetch(`${SITE}/entrar`);
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error(`O site não respondeu em ${SITE}. Rode: npm run dev`);
  process.exit(1);
}

const criados = { lotes: new Set(), links: [], eventos: [], projetos: [], clientes: [], freelas: [] };
const { browser, page } = await openLogged({ width: 1440, height: 900 });
const cookiePainel = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

try {
  /* ---------------- 1. Conexão por Ajustes ---------------- */

  async function irParaAjustes(q = "") {
    await page.goto(`${SITE}/painel/ajustes/google${q}`, { waitUntil: "networkidle" });
  }
  async function desconectarSeConectado() {
    await irParaAjustes();
    const botao = page.getByRole("button", { name: "Desconectar" });
    if (await botao.count()) {
      await botao.first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Desconectar" }).click();
      await page.getByRole("link", { name: /Conectar Google/ }).waitFor();
    }
  }
  async function clicarConectar() {
    await irParaAjustes();
    await page.locator('a[href^="/api/google/conectar"]').first().click();
    await page.waitForURL(/\/painel\/ajustes\/google/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  }

  await passo("Ajustes: sem refresh token → aviso sem_refresh", async () => {
    await desconectarSeConectado();
    await controle.opcoes({ omitRefreshToken: true });
    await clicarConectar();
    assert.match(page.url(), /erro=sem_refresh/);
    await page.getByText("O Google não mandou o acesso contínuo").waitFor();
  });
  await passo("Ajustes: escopo só leitura (drive.readonly) → aviso de permissão", async () => {
    await controle.opcoes({ omitRefreshToken: false, grantedScope: "https://www.googleapis.com/auth/drive.readonly" });
    await clicarConectar();
    assert.match(page.url(), /erro=permissao/);
  });
  await passo("Ajustes: consentimento negado → aviso", async () => {
    await controle.opcoes({ grantedScope: null, authDeny: true });
    await clicarConectar();
    assert.match(page.url(), /erro=negado/);
  });
  await passo("Ajustes: conectar → Conectado, com a conta do about.get", async () => {
    await controle.opcoes({ authDeny: false });
    await clicarConectar();
    await page.getByText("Conectado", { exact: true }).waitFor();
    await page.getByText("contato@dissesim.com.br").first().waitFor();
    const [c] = await sql`select conta, refresh_token_enc is not null as tem, raiz_id from drive_conexao where id = 'zro'`;
    assert.equal(c.conta, "contato@dissesim.com.br");
    assert.equal(c.tem, true);
    assert.ok(c.raiz_id, "a raiz ZRO nasce na conexão");
  });

  /* ---------------- 2. Dados de teste ---------------- */

  const [conexao] = await sql`select raiz_id from drive_conexao where id = 'zro'`;
  const ids = {
    cliente: id("cliente"),
    outro: id("outro"),
    projeto: id("projeto"),
    projetoOutro: id("projeto-outro"),
    diaria: id("diaria"),
    diaria2: id("diaria2"),
    rafael: id("rafael"),
  };
  const T = { freela: token(), area: token(), freela2: token() };
  const linkIds = { freela: id("link-freela"), area: id("link-area"), freela2: id("link-freela2") };
  const agora = new Date();
  await sql`insert into clients (id, name, email, source, created_at, updated_at) values
    (${ids.cliente}, ${"Teste E2E SERHS " + sufixo}, 'cliente-e2e@serhs.test', 'outro', ${agora}, ${agora}),
    (${ids.outro}, ${"Teste E2E Outro " + sufixo}, null, 'outro', ${agora}, ${agora})`;
  criados.clientes.push(ids.cliente, ids.outro);
  await sql`insert into projects (id, code, title, client_id, start_date, created_at, updated_at) values
    (${ids.projeto}, ${"ZRO-E2E-" + sufixo}, ${"Teste E2E Verão " + sufixo}, ${ids.cliente}, ${hoje}, ${agora}, ${agora}),
    (${ids.projetoOutro}, ${"ZRO-E2E2-" + sufixo}, ${"Teste E2E De Outro " + sufixo}, ${ids.outro}, ${hoje}, ${agora}, ${agora})`;
  criados.projetos.push(ids.projeto, ids.projetoOutro);
  await sql`insert into events (id, project_id, type, title, date, created_at) values
    (${ids.diaria}, ${ids.projeto}, 'diaria', 'Teste E2E diária', ${maisDias(hoje, 1)}, ${agora}),
    (${ids.diaria2}, ${ids.projeto}, 'diaria', 'Teste E2E diária 2', ${maisDias(hoje, 2)}, ${agora})`;
  criados.eventos.push(ids.diaria, ids.diaria2);
  await sql`insert into freelancers (id, name, created_at, updated_at) values (${ids.rafael}, 'Teste E2E Rafael Moura', ${agora}, ${agora})`;
  criados.freelas.push(ids.rafael);
  await sql`insert into event_crew (id, event_id, freelancer_id, function) values
    (${id("crew")}, ${ids.diaria}, ${ids.rafael}, 'captacao-camera'),
    (${id("crew2")}, ${ids.diaria2}, ${ids.rafael}, 'captacao-camera')`;
  const daqui30 = new Date(Date.now() + 30 * 24 * 3600_000);
  await sql`insert into drive_links (id, tipo, token_hash, event_id, project_id, client_id, rotulo, expira_em, criado_em, atualizado_em) values
    (${linkIds.freela}, 'freela-diaria', ${hash(T.freela)}, ${ids.diaria}, ${ids.projeto}, ${ids.cliente}, 'Teste E2E · Diária', ${daqui30}, ${agora}, ${agora}),
    (${linkIds.freela2}, 'freela-diaria', ${hash(T.freela2)}, ${ids.diaria2}, ${ids.projeto}, ${ids.cliente}, 'Teste E2E · Diária 2', ${daqui30}, ${agora}, ${agora})`;
  await sql`insert into drive_links (id, tipo, token_hash, senha_hash, client_id, rotulo, limite_bytes, criado_em, atualizado_em) values
    (${linkIds.area}, 'cliente-area', ${hash(T.area)}, ${await bcrypt.hash("senha-certa", 10)}, ${ids.cliente}, 'Teste E2E', ${20e9}, ${agora}, ${agora})`;
  criados.links.push(...Object.values(linkIds));
  const FREELA = `/enviar/${T.freela}/api`;
  const FREELA2 = `/enviar/${T.freela2}/api`;
  const AREA = `/cliente/${T.area}/api`;

  /* ---------------- 3. Segurança por fetch cru ---------------- */

  const loteSimples = (fonte = "cam-a", t = "x") => ({
    op: "lote",
    destino: { tipo: "cartao", fonte, pessoa: { freelancerId: ids.rafael } },
    arquivos: 1,
    bytes: 1000,
    impressao: impressao(t),
  });

  await passo("segurança: sem Origin → 403", async () => {
    assert.equal((await api(FREELA, loteSimples(), { origem: null })).status, 403);
  });
  await passo("segurança: Origin de fora → 403", async () => {
    assert.equal((await api(FREELA, loteSimples(), { origem: "https://evil.test" })).status, 403);
  });
  await passo("segurança: text/plain → 415", async () => {
    assert.equal((await api(FREELA, loteSimples(), { tipo: "text/plain" })).status, 415);
  });
  await passo("segurança: corpo de 70 KB → 413", async () => {
    assert.equal((await api(FREELA, null, { bruto: JSON.stringify({ op: "lote", x: "a".repeat(70_000) }) })).status, 413);
  });
  await passo("segurança: token que não existe (ou fora do formato) → 404", async () => {
    assert.equal((await api(`/enviar/${token()}/api`, loteSimples())).status, 404);
    assert.equal((await api(`/enviar/curto/api`, loteSimples())).status, 404);
    assert.equal((await api(`/cliente/${T.freela}/api`, loteSimples())).status, 404, "token de freela na rota do cliente");
  });
  await passo("segurança: respostas com no-store", async () => {
    const r = await api(FREELA, { op: "fecharLote", loteId: "0b3c1c1e-0000" });
    assert.equal(r.headers.get("cache-control"), "no-store");
  });
  await passo("painel: rota sem sessão não responde (login)", async () => {
    const r = await api("/painel/arquivos/api", { op: "fecharLote", loteId: "0b3c1c1e-0000" });
    assert.ok([307, 308, 401].includes(r.status), String(r.status));
  });

  /* ---------------- 4. Pastas e rolos ---------------- */

  await passo("10 lotes de Câm A ao mesmo tempo → A001…A010, árvore sem duplicata", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => api(FREELA, loteSimples("cam-a", `paralelo-${i}`))));
    for (const r of rs) assert.equal(r.status, 200, JSON.stringify(r.json));
    for (const r of rs) criados.lotes.add(r.json.loteId);
    const rolos = rs.map((r) => r.json.rotulo.split(" · ")[0]).sort();
    assert.deepEqual(rolos, ["A001", "A002", "A003", "A004", "A005", "A006", "A007", "A008", "A009", "A010"]);
    assert.deepEqual(pastasRepetidas(await controle.arquivos()), []);
    const [dp] = await sql`select estado from drive_projetos where project_id = ${ids.projeto}`;
    assert.equal(dp.estado, "pronta");
  });

  await passo("mesmo cartão → mesmo lote; mesmo nome de cartão em 24 h → pergunta", async () => {
    const destino = { tipo: "cartao", fonte: "cam-b", pessoa: { freelancerId: ids.rafael }, cartaoNome: "EOS_DIGITAL" };
    const a = await api(FREELA, { op: "lote", destino, arquivos: 2, bytes: 20, impressao: impressao("eos-1") });
    const b = await api(FREELA, { op: "lote", destino, arquivos: 2, bytes: 20, impressao: impressao("eos-1") });
    assert.equal(a.status, 200);
    criados.lotes.add(a.json.loteId);
    assert.equal(b.json.loteId, a.json.loteId);
    assert.equal(b.json.retomado, true);
    const c = await api(FREELA, { op: "lote", destino, arquivos: 3, bytes: 30, impressao: impressao("eos-2") });
    assert.ok(c.json.pergunta, JSON.stringify(c.json));
    assert.equal(c.json.pergunta.rotulo, a.json.rotulo.split(" · ")[0]);
  });

  /* ---------------- 5. iniciar, PUT, conferir, fecharLote ---------------- */

  let envioDoFreela = null;
  await passo("50 arquivos: iniciar, PUT, conferir 2× ao mesmo tempo, fecharLote 2× → histórico uma vez", async () => {
    const lote = await api(FREELA, { op: "lote", destino: { tipo: "cartao", fonte: "drone", pessoa: { freelancerId: ids.rafael } }, arquivos: 50, bytes: 50 * 300_000, impressao: impressao("drone") });
    assert.equal(lote.status, 200, JSON.stringify(lote.json));
    criados.lotes.add(lote.json.loteId);
    const arquivos = Array.from({ length: 50 }, (_, i) => ({ chave: `k${i}`, nome: `DJI_${String(i).padStart(4, "0")}.MP4`, caminho: "DCIM/100MEDIA", tamanho: 300_000, tipo: "video/mp4" }));
    const ini = await api(FREELA, { op: "iniciar", loteId: lote.json.loteId, arquivos });
    assert.equal(ini.status, 200, JSON.stringify(ini.json));
    assert.ok(ini.json.resultados.every((r) => r.ok && r.estado === "enviar"));
    assert.ok(ini.json.resultados.every((r) => new URL(r.sessao).searchParams.get("upload_id")));
    const dados = randomBytes(300_000);
    for (const r of ini.json.resultados) assert.equal(await subir(r.sessao, dados), 200);
    const envioIds = ini.json.resultados.map((r) => r.envioId);
    envioDoFreela = envioIds[0];
    const [c1, c2] = await Promise.all([api(FREELA, { op: "conferir", envioIds }), api(FREELA, { op: "conferir", envioIds })]);
    for (const c of [c1, c2]) assert.ok(c.json.resultados.every((x) => x.estado === "concluido"), JSON.stringify(c.json));
    const [l] = await sql`select arquivos_recebidos, bytes_recebidos from drive_lotes where id = ${lote.json.loteId}`;
    assert.equal(l.arquivos_recebidos, 50, "soma uma vez só");
    const f1 = await api(FREELA, { op: "fecharLote", loteId: lote.json.loteId });
    const f2 = await api(FREELA, { op: "fecharLote", loteId: lote.json.loteId });
    assert.equal(f1.json.estado, "concluido");
    assert.equal(f2.json.estado, "concluido");
    const hist = await sql`select content from activities where project_id = ${ids.projeto} and type = 'arquivos' and content like '%rolo D001%'`;
    assert.equal(hist.length, 1, JSON.stringify(hist));
    const [e] = await sql`select sessao_enc from drive_envios where id = ${envioIds[0]}`;
    assert.equal(e.sessao_enc, null, "a URI da sessão sai do banco ao concluir");
  });

  await passo("envio de outro link → 404 (e o painel também não enxerga)", async () => {
    assert.ok(envioDoFreela);
    const r = await api(FREELA2, { op: "conferir", envioIds: [envioDoFreela] });
    assert.equal(r.status, 404);
    const p = await api("/painel/arquivos/api", { op: "conferir", envioIds: [envioDoFreela] }, { cookie: cookiePainel });
    assert.equal(p.status, 404);
  });

  /* ---------------- 6. Conciliação por appProperties ---------------- */

  await passo("terminou sem conferir e a sessão morreu → conciliação acha pelo appProperties (nunca expirado)", async () => {
    const lote = await api(FREELA2, { op: "lote", destino: { tipo: "cartao", fonte: "cam-c", pessoa: { freelancerId: ids.rafael } }, arquivos: 1, bytes: 5000, impressao: impressao("conciliar") });
    criados.lotes.add(lote.json.loteId);
    const ini = await api(FREELA2, { op: "iniciar", loteId: lote.json.loteId, arquivos: [{ chave: "a", nome: "C0001.MP4", caminho: "", tamanho: 5000, tipo: "video/mp4" }] });
    const r = ini.json.resultados[0];
    assert.equal(await subir(r.sessao, randomBytes(5000)), 200);
    await controle.opcoes({ sessionTtlMs: 1 }); // a sessão morre: só a busca por appProperties acha
    const tresHoras = new Date(Date.now() - 3 * 3600_000);
    await sql`update drive_envios set ultimo_sinal_em = ${tresHoras} where id = ${r.envioId}`;
    await sql`update drive_lotes set ultimo_sinal_em = ${tresHoras} where id = ${lote.json.loteId}`;
    try {
      await page.goto(`${SITE}/painel/ajustes/google`, { waitUntil: "networkidle" });
      const e = await esperar(async () => {
        const [x] = await sql`select estado from drive_envios where id = ${r.envioId}`;
        return x.estado !== "enviando" ? x : null;
      });
      assert.equal(e.estado, "concluido");
    } finally {
      await controle.opcoes({ sessionTtlMs: 7 * 24 * 3600 * 1000 });
    }
  });

  /* ---------------- 7. Link expirado e revogado ---------------- */

  await passo("link expirado: lote → 409, conferir de envio já iniciado funciona", async () => {
    const lote = await api(FREELA2, { op: "lote", destino: { tipo: "cartao", fonte: "cam-e", pessoa: { freelancerId: ids.rafael } }, arquivos: 1, bytes: 3000, impressao: impressao("expira") });
    criados.lotes.add(lote.json.loteId);
    const ini = await api(FREELA2, { op: "iniciar", loteId: lote.json.loteId, arquivos: [{ chave: "a", nome: "E0001.MP4", caminho: "", tamanho: 3000, tipo: "video/mp4" }] });
    const r = ini.json.resultados[0];
    await sql`update drive_links set expira_em = ${new Date(Date.now() - 60_000)} where id = ${linkIds.freela2}`;
    const novo = await api(FREELA2, loteSimples("cam-e", "depois-de-expirar"));
    assert.equal(novo.status, 409);
    assert.equal(novo.json.erro, "link_inativo");
    await subir(r.sessao, randomBytes(3000));
    const c = await api(FREELA2, { op: "conferir", envioIds: [r.envioId] });
    assert.equal(c.status, 200);
    assert.equal(c.json.resultados[0].estado, "concluido");
  });

  /* ---------------- 8. Área do cliente ---------------- */

  await passo("área com senha: sem cookie → 403 senha; projeto de outro cliente → 404", async () => {
    const semCookie = await api(AREA, { op: "lote", destino: { tipo: "cliente", projetoId: ids.projeto, assunto: "Logo", consentimento: true }, arquivos: 1, bytes: 10, impressao: impressao("area-1") });
    assert.equal(semCookie.status, 403);
    assert.equal(semCookie.json.erro, "senha");
  });

  await passo("área: senha errada 6× → muitas tentativas; senha certa → cookie; lote ok", async () => {
    const r = await fetch(`${SITE}/cliente/${T.area}`);
    if (r.status === 404) return "pulado"; // a página é do bloco PÚBLICO
    const senha = page.locator('input[type="password"]');
    for (let i = 0; i < 6; i++) {
      await page.goto(`${SITE}/cliente/${T.area}`, { waitUntil: "networkidle" });
      await senha.fill(`errada-${i}`);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState("networkidle");
    }
    await page.getByText(/Muitas tentativas/).waitFor({ timeout: 5000 });
    await sql`delete from login_attempts where email = ${`area:${linkIds.area}`}`;
    await page.goto(`${SITE}/cliente/${T.area}`, { waitUntil: "networkidle" });
    await senha.fill("senha-certa");
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    const cookies = await page.context().cookies(`${SITE}/cliente/${T.area}`);
    const area = cookies.find((c) => c.name === "zro_area");
    assert.ok(area, "cookie da área");
    assert.equal(area.path, `/cliente/${T.area}`);
    assert.equal(area.httpOnly, true);
    const cookie = `zro_area=${area.value}`;
    const outro = await api(AREA, { op: "lote", destino: { tipo: "cliente", projetoId: ids.projetoOutro, assunto: "Logo", consentimento: true }, arquivos: 1, bytes: 10, impressao: impressao("area-2") }, { cookie });
    assert.equal(outro.status, 404);
    const ok = await api(AREA, { op: "lote", destino: { tipo: "cliente", projetoId: ids.projeto, assunto: "Manual de marca", consentimento: true }, arquivos: 1, bytes: 10, impressao: impressao("area-3") }, { cookie });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    criados.lotes.add(ok.json.loteId);
    assert.match(ok.json.caminho, /03 Assets \/ Do cliente \/ \d{4}-\d{2}-\d{2} · Manual de marca$/);
    assert.match(ok.headers.get("set-cookie") ?? "", /zro_area=.*Path=\/cliente\//, "validade deslizante");
    const semConsentimento = await api(AREA, { op: "lote", destino: { tipo: "cliente", projetoId: null, assunto: "Logo", consentimento: false }, arquivos: 1, bytes: 10, impressao: impressao("area-4") }, { cookie });
    assert.equal(semConsentimento.status, 400);
    assert.equal(semConsentimento.json.erro, "consentimento");
  });

  /* ---------------- 9. Painel e diagnóstico ---------------- */

  await passo("painel: envio para a raiz e o diagnóstico (arquivo vai para a lixeira, resultado guardado)", async () => {
    const lote = await api("/painel/arquivos/api", { op: "lote", destino: { tipo: "pasta", pastaId: conexao.raiz_id }, arquivos: 1, bytes: 512 * 1024, impressao: impressao("diag") }, { cookie: cookiePainel });
    assert.equal(lote.status, 200, JSON.stringify(lote.json));
    criados.lotes.add(lote.json.loteId);
    const ini = await api("/painel/arquivos/api", { op: "iniciar", loteId: lote.json.loteId, arquivos: [{ chave: "d", nome: "zro-teste-envio.bin", caminho: "", tamanho: 512 * 1024, tipo: "application/octet-stream" }] }, { cookie: cookiePainel });
    const r = ini.json.resultados[0];
    assert.equal(await subir(r.sessao, randomBytes(512 * 1024)), 200);
    const c = await api("/painel/arquivos/api", { op: "conferir", envioIds: [r.envioId] }, { cookie: cookiePainel });
    assert.equal(c.json.resultados[0].estado, "concluido");
    const d = await api(
      "/painel/arquivos/api",
      { op: "diagnostico", envioId: r.envioId, resultado: { preflight: true, viu308: true, rangeLegivel: true, finalLegivel: false, host: "127.0.0.1:54400", navegador: "Node · e2e" } },
      { cookie: cookiePainel },
    );
    assert.equal(d.status, 200, JSON.stringify(d.json));
    assert.equal(d.json.registro.conferido, true);
    const itens = await controle.arquivos(conexao.raiz_id);
    assert.ok(itens.some((it) => it.nome === "zro-teste-envio.bin" && it.lixeira));
    const pub = await api(FREELA, { op: "diagnostico", envioId: r.envioId, resultado: d.json.registro });
    assert.ok([400, 403].includes(pub.status), "diagnóstico só no painel");
  });
} finally {
  /* ---------------- limpeza (só o que este teste criou) ---------------- */
  try {
    const lotes = [...criados.lotes].filter(Boolean);
    const dosLinks = criados.links.length ? await sql`select id from drive_lotes where link_id = any(${criados.links})` : [];
    const todosLotes = [...new Set([...lotes, ...dosLinks.map((l) => l.id)])];
    const pastasDoTeste = await sql`select pasta_id from drive_projetos where project_id = any(${criados.projetos})`;
    if (todosLotes.length) await sql`delete from drive_envios where lote_id = any(${todosLotes})`;
    if (todosLotes.length) await sql`delete from drive_lotes where id = any(${todosLotes})`;
    await sql`delete from login_attempts where email = any(${criados.links.map((l) => `area:${l}`)})`;
    await sql`delete from drive_compartilhamentos where project_id = any(${criados.projetos}) or client_id = any(${criados.clientes})`;
    await sql`delete from drive_links where id = any(${criados.links})`;
    await sql`delete from drive_diarias where event_id = any(${criados.eventos})`;
    await sql`delete from drive_projetos where project_id = any(${criados.projetos})`;
    // Cache de pastas do cliente de teste (as pastas ficam só no Google falso).
    const todos = await controle.arquivos().catch(() => []);
    const raizesTeste = new Set([
      ...pastasDoTeste.map((p) => p.pasta_id).filter(Boolean),
      ...(await sql`select pasta_id from drive_pastas where chave like ${"%teste-e2e-%" + sufixo}`).map((p) => p.pasta_id).filter(Boolean),
    ]);
    const descendentes = new Set(raizesTeste);
    for (let mudou = true; mudou; ) {
      mudou = false;
      for (const it of todos) if (!descendentes.has(it.id) && it.pais.some((p) => descendentes.has(p))) {
        descendentes.add(it.id);
        mudou = true;
      }
    }
    const lista = [...descendentes];
    if (lista.length) await sql`delete from drive_pastas where pasta_id = any(${lista}) or pai_id = any(${lista})`;
    await sql`delete from activities where project_id = any(${criados.projetos}) or client_id = any(${criados.clientes})`;
    await sql`delete from event_crew where event_id = any(${criados.eventos})`;
    await sql`delete from events where id = any(${criados.eventos})`;
    await sql`delete from finance_entries where project_id = any(${criados.projetos})`;
    await sql`delete from projects where id = any(${criados.projetos})`;
    await sql`delete from freelancers where id = any(${criados.freelas})`;
    await sql`delete from clients where id = any(${criados.clientes})`;
  } catch (e) {
    console.error("Limpeza incompleta:", e?.message ?? e);
  }
  await controle.opcoes({ omitRefreshToken: false, grantedScope: null, authDeny: false, sessionTtlMs: 7 * 24 * 3600 * 1000 }).catch(() => {});
  await browser.close();
  await sql.end({ timeout: 5 });
}

const falhas = resultados.filter((r) => r[0] !== "ok");
console.log(`\n${resultados.length - falhas.length} de ${resultados.length} passos ok.`);
process.exit(falhas.length ? 1 : 0);
