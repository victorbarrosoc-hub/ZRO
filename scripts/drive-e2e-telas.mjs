// E2E das telas do Drive (blocos PAINEL e PÚBLICO, docs/dev/drive.md §13.6 e §13.7), com o Google falso.
//
// Precisa, no ar: `node scripts/google-mock/servidor.mjs` e `npm run dev`, com o .env.local apontando para o
// Google falso (veja scripts/google-mock/servidor.mjs) e o Google já conectado em Ajustes
// (`node scripts/drive-e2e-protocolo.mjs` conecta). Cria dados com nome "Teste … E2E", tira screenshots
// (1440×900 e 390×844) e, no fim, desliga os links que criou. Apagar os dados: `--limpar`.
//
//   ZRO_SHOTS=/caminho/das/fotos node scripts/drive-e2e-telas.mjs
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";

const SITE = process.env.ZRO_SITE ?? "http://localhost:3000";
const CONTROLE = process.env.ZRO_MOCK_CONTROLE_URL ?? "http://127.0.0.1:54401";
const FOTOS = process.env.ZRO_SHOTS ?? join(tmpdir(), "zro-shots");
const pg = postgres(process.env.ZRO_LOCAL_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/postgres", { max: 1, prepare: false, onnotice: () => {} });
/**
 * O PGlite do `npm run dev` atende várias conexões num processo só e, sob carga, às vezes mistura as
 * mensagens de duas consultas ao mesmo tempo (só no computador; em produção é o Neon). As consultas do
 * teste tentam de novo nesse caso.
 */
async function sql(partes, ...valores) {
  for (let i = 0; ; i++) {
    try {
      return await pg(partes, ...valores);
    } catch (e) {
      if (i >= 5 || !/bind message|invalid input syntax|prepared statement/.test(String(e?.message))) throw e;
      await new Promise((ok) => setTimeout(ok, 200 + i * 300));
    }
  }
}
mkdirSync(FOTOS, { recursive: true });

const resultados = [];
async function passo(nome, fn) {
  const t0 = Date.now();
  try {
    await fn();
    resultados.push(["ok", nome]);
    console.log(`ok      ${nome} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    resultados.push(["FALHOU", nome, e?.message ?? String(e)]);
    console.log(`FALHOU  ${nome}\n        ${String(e?.stack ?? e).split("\n").slice(0, 6).join("\n        ")}`);
  }
}

/* ---------------- apoio ---------------- */

const controle = {
  opcoes: (o) => fetch(`${CONTROLE}/opcoes`, { method: "POST", body: JSON.stringify(o) }).then((r) => r.json()),
  stats: () => fetch(`${CONTROLE}/stats`).then((r) => r.json()),
  zerarStats: () => fetch(`${CONTROLE}/zerar-stats`, { method: "POST" }).then((r) => r.json()),
  revogar: () => fetch(`${CONTROLE}/revogar`, { method: "POST" }).then((r) => r.json()),
  arquivos: (pasta) => fetch(`${CONTROLE}/arquivos${pasta ? `?pasta=${encodeURIComponent(pasta)}` : ""}`).then((r) => r.json()),
};

/** Caminho legível de cada item do Drive falso ("ZRO/Clientes/…"). */
async function caminhos() {
  const todos = await controle.arquivos();
  const porId = new Map(todos.map((i) => [i.id, i]));
  const caminho = (it) => {
    const partes = [];
    let atual = it;
    for (let i = 0; atual && i < 40; i++) {
      partes.unshift(atual.nome);
      atual = porId.get(atual.pais?.[0]);
    }
    return partes.join("/");
  };
  return todos.filter((i) => !i.lixeira).map((i) => ({ ...i, caminho: caminho(i) }));
}

const sufixo = randomBytes(3).toString("hex");
const id = (n) => `teste-e2e-${n}-${sufixo}`;
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const md5 = (buf) => createHash("md5").update(buf).digest("hex");

/* ---------------- arquivos de teste (cartões) ---------------- */

const BASE = join(tmpdir(), `zro-e2e-${sufixo}`);
const locais = new Map(); // caminho relativo → md5
function arquivo(rel, bytes) {
  const p = join(BASE, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  const buf = randomBytes(bytes);
  writeFileSync(p, buf);
  locais.set(rel, md5(buf));
  return p;
}
arquivo("cartaoA/EOS_DIGITAL/DCIM/100CANON/MVI_0001.MP4", 300_000);
arquivo("cartaoA/EOS_DIGITAL/DCIM/100CANON/MVI_0002.MP4", 1_300_000);
arquivo("cartaoA/EOS_DIGITAL/MISC/info.xml", 2_000);
arquivo("cartaoA/EOS_DIGITAL/.DS_Store", 600);
arquivo("cartaoB/PRIVATE/M4ROOT/CLIP/C0001.MP4", 900_000);
arquivo("cartaoC/DJI_001/DJI_0001.MP4", 9_000_000);
arquivo("cartaoC/DJI_001/DJI_0002.MP4", 7_000_000);
arquivo("cartaoD/BIG/A001C003_230312_R1AB.mxf", 24_000_000);
arquivo("soltos/roteiro.pdf", 50_000);
arquivo("soltos/briefing.txt", 3_000);
arquivo("soltos/vazio.txt", 0);
arquivo("pastaPainel/Brutos/dia1/clip1.mov", 400_000);
arquivo("pastaPainel/Brutos/dia1/clip2.mov", 200_000);
arquivo("pastaPainel/Brutos/notas.txt", 1_000);
arquivo("master/Filme_Final_v3.mp4", 800_000);
arquivo("cliente/logo.svg", 4_000);
arquivo("cliente/manual-de-marca.pdf", 120_000);
for (let i = 0; i < 30; i++) arquivo(`clienteMuitos/ref-${String(i).padStart(2, "0")}.jpg`, 400_000);

/** Confere que cada arquivo local chegou no destino com o mesmo MD5 (o mock calcula do conteúdo). */
async function conferirMd5(itens, prefixoLocal, prefixoDrive) {
  const doDrive = new Map(itens.map((i) => [i.caminho, i]));
  let n = 0;
  for (const [rel, h] of locais) {
    if (!rel.startsWith(`${prefixoLocal}/`)) continue;
    if (/\.DS_Store$/.test(rel)) continue;
    const alvo = `${prefixoDrive}/${rel.slice(prefixoLocal.length).replace(/^\//, "")}`;
    const it = doDrive.get(alvo);
    assert.ok(it, `não chegou: ${alvo}`);
    assert.equal(it.md5, h, `md5 diferente: ${alvo}`);
    n++;
  }
  return n;
}

/* ---------------- navegador ---------------- */

const creds = readFileSync("data/credenciais-dev.txt", "utf8").split("\n").filter((l) => l.includes("@"))[0].trim().split(/\s+/);
const browser = await chromium.launch();
const erros = [];
async function contexto({ largura = 1440, altura = 900, logado = false } = {}) {
  // Um IP por contexto: o limite de senhas por IP (em memória) não mistura um teste com o outro.
  const ip = `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${1 + ((Math.random() * 250) | 0)}`;
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: largura < 600 ? 2 : 1 });
  // Só nas requisições para a ZRO (no Google, um cabeçalho a mais pediria outro CORS).
  await ctx.route(`${SITE}/**`, (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }));
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: SITE });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${page.url()} :: ${e}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource: the server responded with a status of (400|403|404|409|503)/.test(t)) return; // erros que o teste provoca
    // A resposta final da sessão vem sem CORS (como no Google): o navegador avisa e o servidor conclui.
    if (/blocked by CORS policy|net::ERR_FAILED/.test(t)) return;
    erros.push(`${page.url()} :: ${t}`);
  });
  if (logado) await entrar(page);
  return { ctx, page };
}
async function entrar(page) {
  await page.goto(`${SITE}/entrar`, { waitUntil: "networkidle" });
  await page.fill("#email", creds[0]);
  await page.fill("#password", creds[1]);
  await Promise.all([page.waitForURL("**/painel**"), page.click("button[type=submit]")]);
}
async function foto(page, nome, { full = true } = {}) {
  await page.waitForTimeout(500);
  const w = page.viewportSize().width;
  const caminho = join(FOTOS, `${nome}-${w}.png`);
  await page.screenshot({ path: caminho, fullPage: full });
  const larg = await page.evaluate(() => document.documentElement.scrollWidth);
  if (larg > w + 1) erros.push(`${nome}-${w}: página mais larga que a tela (${larg}px)`);
  return caminho;
}
const prancheta = (page) => page.evaluate(() => navigator.clipboard.readText());
const ir = (page, caminho) => page.goto(`${SITE}${caminho}`, { waitUntil: "networkidle" });

/* ---------------- dados ---------------- */

const ids = {
  cliente: id("cliente"),
  outro: id("outro"),
  freela: id("freela"),
  antigo: id("antigo"),
  outroProjeto: id("outro-proj"),
  diaria: id("diaria"),
};
const nomes = { cliente: `Teste Cliente E2E ${sufixo}`, outro: `Teste Outro E2E ${sufixo}`, projeto: `Teste Verão E2E ${sufixo}`, antigo: `Teste Antigo E2E ${sufixo}` };
const estado = { projeto: null, linkFreela: null, linkArea: null, senha: "segredo-teste-1" };

await sql`insert into clients (id, name, email, contact_name, created_at, updated_at) values
  (${ids.cliente}, ${nomes.cliente}, 'cliente-e2e@example.com', 'Ana Teste', now(), now()),
  (${ids.outro}, ${nomes.outro}, null, null, now(), now())`;
await sql`insert into freelancers (id, name, functions, created_at, updated_at) values (${ids.freela}, 'Teste Rafael Moura', '["camera"]'::jsonb, now(), now())`;
await sql`insert into projects (id, code, title, client_id, start_date, created_at, updated_at) values
  (${ids.antigo}, ${`TE2E-${sufixo}-A`}, ${nomes.antigo}, ${ids.cliente}, ${hoje}, now(), now()),
  (${ids.outroProjeto}, ${`TE2E-${sufixo}-B`}, 'Teste Projeto de Outro', ${ids.outro}, ${hoje}, now(), now())`;

const painel = await contexto({ logado: true });
const P = painel.page;

try {
  /* ---------------- Ajustes ---------------- */
  await passo("Ajustes → Google Drive conectado", async () => {
    await ir(P, "/painel/ajustes/google");
    // Conecta (ou reconecta) se preciso: o Google falso aprova sozinho.
    if (!(await P.getByText("Conectado", { exact: true }).count())) {
      await P.locator('a[href^="/api/google/conectar"]').first().click();
      await P.waitForURL(/\/painel\/ajustes\/google\?ok=1/, { timeout: 20000 });
    }
    await P.getByText("Conectado", { exact: true }).first().waitFor({ timeout: 10000 });
    await P.getByText("contato@dissesim.com.br").first().waitFor({ timeout: 10000 });
    await foto(P, "ajustes-google-conectado");
  });

  /* ---------------- Projeto novo → árvore ---------------- */
  await passo("projeto novo pela tela → árvore completa no Drive, nomes exatos", async () => {
    await ir(P, "/painel/projetos");
    await P.getByRole("button", { name: "Novo projeto" }).first().click();
    const dlg = P.getByRole("dialog");
    await dlg.locator('input[name="title"]').fill(nomes.projeto);
    await dlg.locator('select[name="clientId"]').selectOption(ids.cliente);
    await dlg.locator('input[name="startDate"]').fill(hoje);
    await Promise.all([P.waitForURL(/\/painel\/projetos\/[^/?]+$/), dlg.locator('button[type="submit"]').click()]);
    estado.projeto = new URL(P.url()).pathname.split("/").pop();
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await P.getByText("06 Entregas").first().waitFor({ timeout: 40000 });
    const mes = hoje.slice(0, 7);
    const raiz = `ZRO/Clientes/${nomes.cliente}/${mes} · ${nomes.projeto}`;
    const todos = await caminhos();
    const esperado = [
      "00 Documentos", "01 Cenas", "02 Áudios", "03 Assets", "03 Assets/Do cliente", "03 Assets/Trilha e SFX", "03 Assets/Gráficos",
      "04 Projeto", "04 Projeto/Edição", "04 Projeto/Color", "04 Projeto/Som", "04 Projeto/Motion",
      "05 Render", "06 Entregas", "06 Entregas/Master", "06 Entregas/Redes", "06 Entregas/Legendas",
    ];
    const dentro = todos.filter((i) => i.caminho.startsWith(`${raiz}/`)).map((i) => i.caminho.slice(raiz.length + 1)).sort();
    assert.deepEqual(dentro, [...esperado].sort());
    assert.ok(todos.filter((i) => i.caminho.startsWith(`${raiz}/`)).every((i) => i.pasta), "árvore vazia (só pastas)");
    const pastas = todos.filter((i) => i.caminho === raiz);
    assert.equal(pastas.length, 1, "uma pasta do projeto só");
    await foto(P, "projeto-drive-pronta");
  });

  await passo("projeto antigo → Criar pastas no Drive", async () => {
    await ir(P, `/painel/projetos/${ids.antigo}?aba=drive`);
    await P.getByText("Este projeto ainda não tem pasta no Drive.").waitFor();
    await foto(P, "projeto-drive-sem-pasta");
    await P.getByRole("button", { name: "Criar pastas no Drive" }).click();
    await P.getByText("06 Entregas").first().waitFor({ timeout: 40000 });
    const raiz = `ZRO/Clientes/${nomes.cliente}/${hoje.slice(0, 7)} · ${nomes.antigo}`;
    const todos = await caminhos();
    assert.equal(todos.filter((i) => i.caminho.startsWith(`${raiz}/`)).length, 17);
    const [p] = await sql`select drive_url from projects where id = ${ids.antigo}`;
    assert.match(p.drive_url ?? "", /folders\//, "driveUrl gravado");
  });

  /* ---------------- Arquivos ---------------- */
  const [dp] = await sql`select pasta_id, render_id, entregas_id, subpastas from drive_projetos where project_id = ${estado.projeto}`;
  await passo("Arquivos: subir arquivos e pasta, baixar, criar pasta", async () => {
    await ir(P, `/painel/arquivos?pasta=${dp.render_id}`);
    await P.getByText("Pasta vazia.").waitFor();
    await foto(P, "arquivos-pasta-vazia");
    await P.locator('input[type="file"]:not([webkitdirectory])').setInputFiles([join(BASE, "soltos/roteiro.pdf"), join(BASE, "soltos/briefing.txt"), join(BASE, "soltos/vazio.txt")]);
    await P.getByText("No Drive", { exact: true }).first().waitFor({ timeout: 30000 });
    await P.locator('input[webkitdirectory]').setInputFiles(join(BASE, "pastaPainel"));
    await P.waitForFunction(() => document.querySelectorAll("li").length > 0 && [...document.querySelectorAll("span")].filter((s) => s.textContent === "No Drive").length >= 2, null, { timeout: 30000 });
    await P.waitForTimeout(1500);
    await foto(P, "arquivos-concluido");
    const todos = await caminhos();
    const render = todos.find((i) => i.id === dp.render_id).caminho;
    assert.equal(await conferirMd5(todos, "soltos", render), 3);
    assert.equal(await conferirMd5(todos, "pastaPainel", `${render}/pastaPainel`), 3); // a pasta escolhida entra inteira
    // Baixar aponta para o link do Google
    await ir(P, `/painel/arquivos?pasta=${dp.render_id}`);
    const roteiro = todos.find((i) => i.caminho === `${render}/roteiro.pdf`);
    const href = await P.getByRole("link", { name: "Baixar" }).first().getAttribute("href");
    assert.match(href, /^https:\/\/drive\.google\.com\/uc\?id=.+&export=download$/);
    assert.ok((await P.locator(`a[href*="${roteiro.id}"]`).count()) >= 1, "Baixar do roteiro");
    // Nova pasta
    await P.getByRole("button", { name: "Nova pasta" }).click();
    await P.getByRole("dialog").locator('input[name="nome"]').fill("Teste Pasta Nova");
    await P.getByRole("dialog").locator('button[type="submit"]').click();
    await P.getByRole("link", { name: /Teste Pasta Nova/ }).waitFor({ timeout: 15000 });
    assert.ok((await caminhos()).some((i) => i.caminho === `${render}/Teste Pasta Nova` && i.pasta));
    await foto(P, "arquivos-pasta");
    await ir(P, "/painel/arquivos");
    await foto(P, "arquivos-raiz");
  });

  /* ---------------- Diária e link do freela ---------------- */
  await sql`insert into events (id, type, title, date, project_id, location, created_at) values (${ids.diaria}, 'diaria', 'Teste Diária E2E', ${hoje}, ${estado.projeto}, 'Pipa', now())`;
  await sql`insert into event_crew (id, event_id, freelancer_id) values (${id("crew")}, ${ids.diaria}, ${ids.freela})`;

  await passo("diária → Gerar link (aba Drive) → Copiar", async () => {
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await foto(P, "projeto-drive-diaria-sem-link");
    await P.getByRole("button", { name: "Gerar link" }).click();
    await P.getByRole("button", { name: "Copiar link", exact: true }).first().waitFor({ timeout: 20000 });
    await P.getByRole("button", { name: "Copiar link", exact: true }).first().click();
    const url = await prancheta(P);
    assert.match(url, /\/enviar\/[A-Za-z0-9_-]{43}$/);
    estado.linkFreela = url;
  });

  await passo("agenda: janela da diária mostra o link", async () => {
    await ir(P, `/painel/agenda?evento=${ids.diaria}`);
    if (!(await P.getByRole("dialog").count())) await P.getByText("Teste Diária E2E").first().click();
    await P.getByRole("dialog").getByText("Material").waitFor({ timeout: 10000 });
    await P.getByRole("dialog").getByRole("button", { name: "Copiar link", exact: true }).waitFor({ timeout: 15000 });
    await foto(P, "agenda-diaria-com-link", { full: false });
    await P.keyboard.press("Escape");
  });

  /* ---------------- Freela ---------------- */
  const freela = await contexto();
  const F = freela.page;
  const pastaDiaria = () => `ZRO/Clientes/${nomes.cliente}/${hoje.slice(0, 7)} · ${nomes.projeto}/01 Cenas/${hoje} · Diária 01/Câm A · Teste Rafael Moura`;

  async function cartaoFreela(pagina, pasta, { pessoa = "Teste M.", fonte = "Câm A" } = {}) {
    await pagina.getByRole("radio", { name: new RegExp(pessoa) }).first().click();
    await pagina.getByRole("radio", { name: fonte, exact: true }).click();
    await pagina.locator("input[webkitdirectory]").setInputFiles(join(BASE, pasta));
  }

  await passo("/enviar: quem é você, câmera, cartão (estrutura preservada, sem .DS_Store) → A001", async () => {
    await F.goto(estado.linkFreela, { waitUntil: "networkidle" });
    await F.getByText("Do cartão para a ZRO.").waitFor();
    await foto(F, "enviar-inicio");
    await F.getByRole("button", { name: "Começar envio" }).count(); // ainda não aparece
    await cartaoFreela(F, "cartaoA/EOS_DIGITAL");
    await F.getByText("Vai para Câm A · Teste M., num rolo novo.").waitFor();
    await foto(F, "enviar-resumo");
    await F.getByRole("button", { name: "Começar envio" }).click();
    await F.getByText("Rolo A001 recebido.").waitFor({ timeout: 60000 });
    await foto(F, "enviar-concluido");
    const todos = await caminhos();
    const n = await conferirMd5(todos, "cartaoA/EOS_DIGITAL", `${pastaDiaria()}/A001`);
    assert.equal(n, 3);
    assert.ok(!todos.some((i) => i.caminho.startsWith(`${pastaDiaria()}/A001/EOS_DIGITAL`)), "o nome do cartão não vira pasta");
    assert.ok(!todos.some((i) => i.nome === ".DS_Store" && i.caminho.startsWith(pastaDiaria())), ".DS_Store fica de fora");
    const rolo = todos.find((i) => i.caminho === `${pastaDiaria()}/A001`);
    assert.match(rolo.descricao ?? "", /EOS_DIGITAL/);
  });

  await passo("/enviar: outro cartão → A002; o mesmo cartão de novo → pergunta", async () => {
    await F.getByRole("button", { name: "Enviar outro cartão" }).first().click();
    await cartaoFreela(F, "cartaoB/PRIVATE");
    await F.getByRole("button", { name: "Começar envio" }).click();
    await F.getByText("Rolo A002 recebido.").waitFor({ timeout: 60000 });
    const todos = await caminhos();
    assert.equal(await conferirMd5(todos, "cartaoB/PRIVATE", `${pastaDiaria()}/A002`), 1);
    await F.getByRole("button", { name: "Enviar outro cartão" }).first().click();
    await cartaoFreela(F, "cartaoB/PRIVATE");
    await F.getByRole("button", { name: "Começar envio" }).click();
    // o cartão já chegou inteiro (A002 concluído): o servidor pergunta se é o mesmo rolo
    await F.getByText("Este cartão já subiu como rolo A002. Os arquivos novos entram no A002?").waitFor({ timeout: 30000 });
    await foto(F, "enviar-pergunta");
    await F.getByRole("button", { name: "Entrar no A002" }).click();
    await F.getByText("Rolo A002 recebido.").last().waitFor({ timeout: 30000 });
    const depois = await caminhos();
    assert.equal(depois.filter((i) => i.caminho === `${pastaDiaria()}/A002/M4ROOT/CLIP/C0001.MP4`).length, 1, "nada repetido no A002");
    assert.ok(!depois.some((i) => i.caminho === `${pastaDiaria()}/A003`), "sem rolo novo");
  });

  await passo("/enviar: queda de conexão no meio (dropUploadProb) e chega inteiro", async () => {
    const quedasAntes = (await controle.stats()).faults.uploadDrops;
    await controle.opcoes({ failures: { dropUploadProb: 0.9 } });
    try {
      await F.getByRole("button", { name: "Enviar outro cartão" }).first().click();
      await cartaoFreela(F, "cartaoC/DJI_001", { fonte: "Drone" });
      await F.getByRole("button", { name: "Começar envio" }).click();
      await F.getByText("Rolo D001 recebido.").waitFor({ timeout: 120000 });
    } finally {
      await controle.opcoes({ failures: {} });
    }
    const st = await controle.stats();
    assert.ok(st.faults.uploadDrops > quedasAntes, "houve queda");
    const camDrone = pastaDiaria().replace("Câm A ·", "Drone ·");
    assert.equal(await conferirMd5(await caminhos(), "cartaoC/DJI_001", `${camDrone}/D001`), 2);
  });

  await passo("/enviar: recarregar a página no meio e escolher o mesmo cartão → continua o mesmo rolo", async () => {
    await controle.opcoes({ perConnectionBps: 3_000_000 });
    await controle.zerarStats();
    try {
      await F.getByRole("button", { name: "Enviar outro cartão" }).first().click();
      await cartaoFreela(F, "cartaoD/BIG");
      await F.getByRole("button", { name: "Começar envio" }).click();
      await F.getByText(/Rolo A003/).first().waitFor({ timeout: 20000 });
      await F.waitForTimeout(3500);
      await foto(F, "enviar-enviando");
      await F.reload({ waitUntil: "networkidle" });
      await F.getByText(/O rolo A003 parou em \d+%/).waitFor({ timeout: 10000 });
      await foto(F, "enviar-retomavel");
      await F.getByRole("button", { name: "Continuar" }).first().click();
      await F.locator("input[webkitdirectory]").setInputFiles(join(BASE, "cartaoD/BIG"));
      await F.getByText("Continua o rolo A003 de onde parou.").waitFor();
      await controle.opcoes({ perConnectionBps: 0 });
      await F.getByRole("button", { name: "Começar envio" }).click();
      await F.getByText("Rolo A003 recebido.").waitFor({ timeout: 60000 });
    } finally {
      await controle.opcoes({ perConnectionBps: 0 });
    }
    const st = await controle.stats();
    assert.equal(st.uploadSessionsCreated, 1, "a sessão foi reaproveitada");
    assert.ok(st.bytesReceived < 1.6 * 24_000_000, `bytes recebidos ${st.bytesReceived}`);
    assert.equal(await conferirMd5(await caminhos(), "cartaoD/BIG", `${pastaDiaria()}/A003`), 1);
  });

  await passo("painel mostra o que chegou (aba Drive, Arquivos → Chegou, histórico do cliente)", async () => {
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await P.getByText(/A001 · Câm A · Teste Rafael Moura/).first().waitFor();
    await P.getByText(/D001 · Drone/).first().waitFor();
    await foto(P, "projeto-drive-rolos");
    await ir(P, "/painel/arquivos");
    await P.getByText("Chegou").first().waitFor();
    await foto(P, "arquivos-chegou");
    const hist = await sql`select content from activities where client_id = ${ids.cliente} and type = 'arquivos'`;
    assert.ok(hist.some((h) => /enviou o rolo A001 · Câm A · Diária 01: 3 arquivos/.test(h.content)), JSON.stringify(hist));
    assert.equal(hist.filter((h) => /rolo A001 /.test(h.content)).length, 1, "histórico uma vez");
  });

  /* ---------------- Área do cliente ---------------- */
  await passo("CRM → Criar área do cliente com senha → Copiar link", async () => {
    await ir(P, `/painel/crm/clientes/${ids.cliente}?aba=area`);
    await foto(P, "crm-area-sem-area");
    await P.getByRole("button", { name: "Criar área do cliente" }).click();
    const dlg = P.getByRole("dialog");
    await dlg.locator('input[name="senha"]').fill(estado.senha);
    await dlg.locator('button[type="submit"]').click();
    await P.getByRole("button", { name: "Copiar link", exact: true }).first().waitFor({ timeout: 15000 });
    await P.getByRole("button", { name: "Copiar link", exact: true }).first().click();
    estado.linkArea = await prancheta(P);
    assert.match(estado.linkArea, /\/cliente\/[A-Za-z0-9_-]{43}$/);
  });

  await passo("Liberar entregas: link público só em 06 Entregas e e-mail do Google", async () => {
    const antes = (await controle.stats()).emailsDeCompartilhamento ?? 0;
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await P.getByRole("button", { name: "Liberar entregas" }).click();
    await P.getByRole("alertdialog").getByRole("button", { name: "Liberar entregas" }).click().catch(() => P.getByRole("dialog").getByRole("button", { name: "Liberar entregas" }).click());
    await P.getByText(/Liberadas em/).waitFor({ timeout: 15000 });
    const todos = await caminhos();
    const raizProjeto = todos.find((i) => i.id === dp.pasta_id).caminho;
    const comPermissao = todos.filter((i) => (i.caminho === raizProjeto || i.caminho.startsWith(`${raizProjeto}/`) || raizProjeto.startsWith(`${i.caminho}/`)) && (i.permissoes ?? []).some((p) => (p.type === "anyone" || p.type === "user") && p.role === "reader"));
    assert.deepEqual(comPermissao.map((i) => i.id), [dp.entregas_id], "só 06 Entregas tem permissão");
    const perms = comPermissao[0].permissoes;
    assert.ok(perms.some((p) => p.type === "anyone" && p.role === "reader"));
    assert.ok(perms.some((p) => p.type === "user" && p.role === "reader" && p.emailAddress === "cliente-e2e@example.com"));
    assert.equal((await controle.stats()).emailsDeCompartilhamento, antes + 1);
    // um master em 06 Entregas/Master
    await ir(P, `/painel/arquivos?pasta=${dp.subpastas["06 Entregas/Master"]}`);
    await P.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(join(BASE, "master/Filme_Final_v3.mp4"));
    await P.getByText("No Drive", { exact: true }).first().waitFor({ timeout: 30000 });
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await foto(P, "projeto-drive-liberadas");
  });

  const cliente = await contexto();
  const C = cliente.page;
  await passo("/cliente: senha errada, senha certa, vê só 06 Entregas, baixa pelo link liberado", async () => {
    await C.goto(estado.linkArea, { waitUntil: "networkidle" });
    await C.getByText("Digite a senha.").waitFor();
    await foto(C, "cliente-senha");
    await C.fill('input[type="password"]', "errada");
    await C.click('button[type="submit"]');
    await C.getByText("A senha não confere. Confira com quem te mandou o link.").waitFor();
    await foto(C, "cliente-senha-errada");
    await C.fill('input[type="password"]', estado.senha);
    await C.click('button[type="submit"]');
    await C.getByRole("heading", { name: "Arquivos finais" }).waitFor({ timeout: 15000 });
    await C.getByText("Filme_Final_v3.mp4").waitFor({ timeout: 15000 });
    const html = await C.content();
    for (const proibido of ["roteiro.pdf", "MVI_0001", "C0001.MP4", "05 Render", dp.render_id, dp.pasta_id]) assert.ok(!html.includes(proibido), `vazou ${proibido}`);
    const todos = await caminhos();
    const master = todos.find((i) => i.nome === "Filme_Final_v3.mp4" && i.pais.includes(dp.subpastas["06 Entregas/Master"]));
    const baixar = await C.getByRole("link", { name: /Baixar/ }).first().getAttribute("href");
    assert.equal(baixar, `https://drive.google.com/uc?id=${master.id}&export=download`);
    await foto(C, "cliente-pronta");
  });

  await passo("/cliente: projeto de outro cliente → 404 (e nenhum id de pasta vem do navegador)", async () => {
    const api = `${new URL(estado.linkArea).pathname}/api`;
    const r = await C.evaluate(async ({ api, outro }) => {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "lote", destino: { tipo: "cliente", projetoId: outro, assunto: "Teste", consentimento: true }, arquivos: 1, bytes: 10, impressao: "a".repeat(64) }),
      });
      return { status: res.status, json: await res.json() };
    }, { api, outro: ids.outroProjeto });
    assert.equal(r.status, 404, JSON.stringify(r));
    const r2 = await C.evaluate(async ({ api, pasta }) => {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "lote", destino: { tipo: "pasta", pastaId: pasta }, arquivos: 1, bytes: 10, impressao: "b".repeat(64) }),
      });
      return res.status;
    }, { api, pasta: dp.render_id });
    assert.ok([400, 404].includes(r2), `destino pasta na área: ${r2}`);
  });

  await passo("/cliente: envia para 03 Assets/Do cliente → aparece no painel", async () => {
    await C.getByLabel("Para qual projeto?").selectOption({ label: new RegExp(nomes.projeto) }).catch(() => C.locator("select").first().selectOption({ index: 1 }));
    await C.getByLabel("Assunto").fill("Teste Manual");
    await C.locator('input[type="checkbox"]').check();
    await C.locator('input[type="file"]:not([webkitdirectory])').setInputFiles([join(BASE, "cliente/logo.svg"), join(BASE, "cliente/manual-de-marca.pdf")]);
    await C.getByRole("button", { name: "Enviar", exact: true }).first().click();
    await C.getByText("Recebido.").waitFor({ timeout: 60000 });
    await foto(C, "cliente-concluido");
    const raiz = `ZRO/Clientes/${nomes.cliente}/${hoje.slice(0, 7)} · ${nomes.projeto}/03 Assets/Do cliente/${hoje} · Teste Manual`;
    assert.equal(await conferirMd5(await caminhos(), "cliente", raiz), 2);
    await ir(P, `/painel/crm/clientes/${ids.cliente}?aba=area`);
    await P.getByText(/Teste Manual/).first().waitFor();
    await foto(P, "crm-area-com-envios");
  });

  await passo("/cliente: senha trocada no meio do envio → pede a senha e continua", async () => {
    await controle.opcoes({ perConnectionBps: 1_500_000 });
    try {
      await C.reload({ waitUntil: "networkidle" });
      await C.locator("select").first().selectOption({ index: 1 });
      await C.getByLabel("Assunto").fill("Teste Referências");
      await C.locator('input[type="checkbox"]').check();
      await C.locator('input[type="file"]:not([webkitdirectory])').setInputFiles([...Array(30).keys()].map((i) => join(BASE, `clienteMuitos/ref-${String(i).padStart(2, "0")}.jpg`)));
      // o Victor troca a senha: o cookie antigo cai
      await sql`update drive_links set senha_versao = senha_versao + 1 where tipo = ${"cliente-area"} and client_id = ${ids.cliente} and revogado_em is null`;
      await C.getByRole("button", { name: "Enviar", exact: true }).first().click();
      const [l] = await sql`select senha_hash from drive_links where tipo = ${"cliente-area"} and client_id = ${ids.cliente} and revogado_em is null`;
      assert.ok(l.senha_hash);
      await C.getByRole("dialog").getByText("Digite a senha.").waitFor({ timeout: 60000 });
      await foto(C, "cliente-senha-no-meio", { full: false });
      await C.getByRole("dialog").locator('input[type="password"]').fill(estado.senha);
      await C.getByRole("dialog").locator('button[type="submit"]').click();
      await C.getByText(/Enviando|%/).first().waitFor({ timeout: 15000 });
      await foto(C, "cliente-enviando");
      await controle.opcoes({ perConnectionBps: 0 });
      await C.getByText("Recebido.").last().waitFor({ timeout: 90000 });
    } finally {
      await controle.opcoes({ perConnectionBps: 0 });
    }
    const raiz = `ZRO/Clientes/${nomes.cliente}/${hoje.slice(0, 7)} · ${nomes.projeto}/03 Assets/Do cliente/${hoje} · Teste Referências`;
    assert.equal(await conferirMd5(await caminhos(), "clienteMuitos", raiz), 30);
  });

  await passo("/cliente: 6 senhas erradas → Muitas tentativas", async () => {
    const outro = await contexto();
    for (let i = 0; i < 6; i++) {
      await outro.page.goto(estado.linkArea, { waitUntil: "networkidle" });
      await outro.page.fill('input[type="password"]', `errada-${i}`);
      await outro.page.click('button[type="submit"]');
      await outro.page.getByText(/não confere|Muitas tentativas/).waitFor();
    }
    await outro.page.getByText("Muitas tentativas. Espere 15 minutos e tente de novo.").waitFor();
    await foto(outro.page, "cliente-muitas-tentativas");
    await outro.ctx.close();
  });

  /* ---------------- Painel: sessão expirada no meio ---------------- */
  await passo("painel: sessão expirada no meio do envio → Entrar e continuar", async () => {
    await controle.opcoes({ perConnectionBps: 1_500_000 });
    try {
      await ir(P, `/painel/arquivos?pasta=${dp.render_id}`);
      await P.locator('input[type="file"]:not([webkitdirectory])').setInputFiles([...Array(30).keys()].map((i) => join(BASE, `clienteMuitos/ref-${String(i).padStart(2, "0")}.jpg`)));
      await P.getByText(/Enviando/).first().waitFor({ timeout: 15000 });
      await foto(P, "arquivos-enviando");
      await painel.ctx.clearCookies();
      await P.getByText("Sua sessão expirou. Entre de novo para continuar.").waitFor({ timeout: 60000 });
      await foto(P, "arquivos-sessao-expirada");
      const aba = await painel.ctx.newPage();
      await entrar(aba);
      await aba.close();
      await controle.opcoes({ perConnectionBps: 0 });
      await P.getByRole("button", { name: "Continuar" }).first().click();
      await P.waitForFunction(() => [...document.querySelectorAll("span")].some((s) => s.textContent === "No Drive"), null, { timeout: 90000 });
    } finally {
      await controle.opcoes({ perConnectionBps: 0 });
    }
    const todos = await caminhos();
    const render = todos.find((i) => i.id === dp.render_id).caminho;
    assert.equal(await conferirMd5(todos, "clienteMuitos", render), 30);
  });

  /* ---------------- Estados dos links ---------------- */
  await passo("link desativado, expirado e indisponível", async () => {
    // freela: desativar pela aba Drive
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await P.getByRole("button", { name: "Mais ações do link" }).first().click();
    await P.getByRole("menuitem", { name: "Desativar" }).click();
    await P.getByRole("alertdialog").getByRole("button", { name: "Desativar" }).click().catch(() => P.getByRole("dialog").getByRole("button", { name: "Desativar" }).click());
    await P.getByText("Desativado").first().waitFor({ timeout: 15000 });
    await F.goto(estado.linkFreela, { waitUntil: "networkidle" });
    await F.getByText("Este link não está mais ativo.").waitFor();
    await foto(F, "enviar-desativado");
    // expirado: um link novo com a validade vencida
    await ir(P, `/painel/projetos/${estado.projeto}?aba=drive`);
    await P.getByRole("button", { name: /Gerar link/ }).first().click();
    await P.getByRole("button", { name: "Copiar link", exact: true }).first().waitFor({ timeout: 20000 });
    await P.getByRole("button", { name: "Copiar link", exact: true }).first().click();
    const novo = await prancheta(P);
    assert.notEqual(novo, estado.linkFreela);
    await sql`update drive_links set expira_em = now() - interval '1 day' where event_id = ${ids.diaria} and revogado_em is null`;
    await F.goto(novo, { waitUntil: "networkidle" });
    await F.getByText("Este link expirou.").waitFor();
    await foto(F, "enviar-expirado");
    await sql`update drive_links set expira_em = now() + interval '30 days' where event_id = ${ids.diaria} and revogado_em is null`;
    try {
      // indisponível: o Google derrubou o acesso
      await controle.revogar();
      await fetch(`${CONTROLE}/expirar`, { method: "POST" });
      await F.goto(novo, { waitUntil: "networkidle" });
      // a página só descobre quando fala com o Google; força a conexão a cair
      const r = await F.evaluate(async (api) => (await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "lote", destino: { tipo: "cartao", fonte: "cam-b", pessoa: { nome: "Teste Fulano" } }, arquivos: 1, bytes: 1, impressao: "c".repeat(64) }) })).status, `${new URL(novo).pathname}/api`);
      assert.equal(r, 503);
      await F.goto(novo, { waitUntil: "networkidle" });
      await F.getByText("Não dá para receber o material agora.").waitFor();
      await foto(F, "enviar-indisponivel");
      await C.goto(estado.linkArea, { waitUntil: "networkidle" });
      await C.getByText(/indisponíveis agora|Não dá para receber/).first().waitFor();
      await foto(C, "cliente-google-fora");
      await ir(P, "/painel/arquivos");
      await foto(P, "arquivos-reconectar");
      await ir(P, "/painel/ajustes/google");
      await foto(P, "ajustes-google-reconectar");
    } finally {
      // reconecta (o Google falso aprova sozinho)
      await ir(P, "/painel/ajustes/google");
      await P.locator('a[href^="/api/google/conectar"]').first().click();
      await P.waitForURL(/\/painel\/ajustes\/google\?ok=1/, { timeout: 20000 });
    }
    // área desativada
    await ir(P, `/painel/crm/clientes/${ids.cliente}?aba=area`);
    await P.getByRole("button", { name: "Mais ações da área" }).click();
    await P.getByRole("menuitem", { name: "Desativar área" }).click();
    await P.getByRole("alertdialog").getByRole("button", { name: "Desativar área" }).click().catch(() => P.getByRole("dialog").getByRole("button", { name: "Desativar área" }).click());
    await P.waitForTimeout(1500);
    await C.goto(estado.linkArea, { waitUntil: "networkidle" });
    await C.getByText("Esta área não está mais ativa.").waitFor();
    await foto(C, "cliente-desativada");
  });

  /* ---------------- 390 px ---------------- */
  await passo("telas a 390 px", async () => {
    const m = await contexto({ largura: 390, altura: 844, logado: true });
    for (const [rota, nome] of [
      ["/painel/ajustes/google", "ajustes-google-conectado"],
      ["/painel/arquivos", "arquivos-raiz"],
      [`/painel/arquivos?pasta=${dp.render_id}`, "arquivos-pasta"],
      [`/painel/projetos/${estado.projeto}?aba=drive`, "projeto-drive-rolos"],
      [`/painel/projetos/${ids.outroProjeto}?aba=drive`, "projeto-drive-sem-pasta"],
      [`/painel/crm/clientes/${ids.cliente}?aba=area`, "crm-area-com-envios"],
      [`/painel/crm/clientes/${ids.outro}?aba=area`, "crm-area-sem-area"],
    ]) {
      await ir(m.page, rota);
      await foto(m.page, nome);
    }
    // um link novo de diária para as telas públicas
    await ir(m.page, `/painel/projetos/${estado.projeto}?aba=drive`);
    await m.page.getByRole("button", { name: "Copiar link", exact: true }).first().click();
    const link = await prancheta(m.page);
    const pub = await contexto({ largura: 390, altura: 844 });
    await pub.page.goto(link, { waitUntil: "networkidle" });
    await foto(pub.page, "enviar-inicio");
    await pub.page.getByRole("radio", { name: /Teste M\./ }).first().click();
    await pub.page.getByRole("radio", { name: "Gravador", exact: true }).click();
    await pub.page.getByLabel("Qual gravador?").fill("Zoom F6");
    await pub.page.locator('input[type="file"]').last().setInputFiles([join(BASE, "soltos/briefing.txt")]);
    await foto(pub.page, "enviar-resumo");
    await pub.page.getByRole("button", { name: "Começar envio" }).click();
    await pub.page.getByText("Áudio recebido.").waitFor({ timeout: 30000 });
    await foto(pub.page, "enviar-concluido-audio");
    assert.ok((await caminhos()).some((i) => i.caminho.endsWith(`02 Áudios/${hoje} · Diária 01/Zoom F6 · Teste Rafael Moura/briefing.txt`)));
    await pub.page.goto(`${SITE}/enviar/${"x".repeat(43)}`, { waitUntil: "networkidle" });
    await foto(pub.page, "enviar-nao-encontrado");
    await pub.ctx.close();
    await m.ctx.close();
  });
} finally {
  await browser.close();
  console.log(`\nScreenshots em ${FOTOS}`);
  if (erros.length) console.log(`\nErros no console:\n${[...new Set(erros)].slice(0, 30).join("\n")}`);
  const ok = resultados.filter((r) => r[0] === "ok").length;
  console.log(`\n${ok} de ${resultados.length} passos ok.`);
  console.log(JSON.stringify({ projeto: estado.projeto, cliente: ids.cliente, outro: ids.outro, antigo: ids.antigo, sufixo, linkArea: estado.linkArea ? "ok" : null }));
  rmSync(BASE, { recursive: true, force: true });
  await pg.end();
  if (ok !== resultados.length) process.exitCode = 1;
}
