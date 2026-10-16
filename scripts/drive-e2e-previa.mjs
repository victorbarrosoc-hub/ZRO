// E2E da prévia do Drive (docs/dev/drive.md §16), com o Google falso: Arquivos em miniaturas, vídeo tocando pelo
// service worker (o tempo avança e o Range chega no Google), foto, formato que não toca, proxy de câmera, vídeo
// pesado demais para a rede (pela taxa e pelo vigia de espera) e a área do cliente (miniaturas e o player direto
// do Google pela chave de API). Screenshots em 1440×900 e 390×844. No fim, apaga os dados de teste do banco local
// (ZRO_MANTER=1 para deixar).
//
// Precisa, no ar: o Google falso com a chave de API e o Referer do site, e o `npm run dev` apontando para ele:
//   ZRO_MOCK_PORTA=54500 ZRO_MOCK_CHAVE_API=AIzaTesteChaveDeApiZRO0123456789 ZRO_MOCK_CHAVE_REFERER=http://localhost:3100/ \
//     node scripts/google-mock/servidor.mjs
//   .env.local: GOOGLE_CLIENT_ID/SECRET de teste, ZRO_GOOGLE_API_BASE=http://127.0.0.1:54500,
//               GOOGLE_API_KEY=AIzaTesteChaveDeApiZRO0123456789, NEXT_PUBLIC_SITE_URL=http://localhost:3100
//   ZRO_LOCAL_DB_PORT=54339 npm run dev -- -p 3100
//   ZRO_SITE=http://localhost:3100 ZRO_MOCK_CONTROLE_URL=http://127.0.0.1:54501 \
//     ZRO_LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54339/postgres ZRO_SHOTS=/caminho node scripts/drive-e2e-previa.mjs
//
// O Chromium do Playwright não toca H.264: a mídia de teste é VP9/Opus (gerada aqui com ffmpeg).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";

const SITE = process.env.ZRO_SITE ?? "http://localhost:3000";
const CONTROLE = process.env.ZRO_MOCK_CONTROLE_URL ?? "http://127.0.0.1:54401";
const FOTOS = process.env.ZRO_SHOTS ?? join(tmpdir(), "zro-shots-previa");
const pg = postgres(process.env.ZRO_LOCAL_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/postgres", { max: 1, prepare: false, onnotice: () => {} });
mkdirSync(FOTOS, { recursive: true });
/** O PGlite do `npm run dev` às vezes mistura duas consultas ao mesmo tempo (só no computador): tenta de novo. */
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
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function ate(fn, ms = 20_000, passoMs = 250) {
  const fim = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fim) throw new Error("tempo esgotado");
    await espera(passoMs);
  }
}

const controle = {
  post: (rota, corpo) => fetch(`${CONTROLE}${rota}`, { method: "POST", body: JSON.stringify(corpo ?? {}) }).then((r) => r.json()),
  stats: () => fetch(`${CONTROLE}/stats`).then((r) => r.json()),
};

/* ---------------- mídia de teste (ffmpeg, VP9/Opus) ---------------- */

const MIDIA = join(tmpdir(), `zro-previa-midia-${randomBytes(3).toString("hex")}`);
mkdirSync(MIDIA, { recursive: true });
const ff = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { cwd: MIDIA });
ff("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=24", "-f", "lavfi", "-i", "sine=frequency=330:duration=24",
  "-vf", "hue=s=0.35", "-c:v", "libvpx-vp9", "-b:v", "1200k", "-deadline", "realtime", "-cpu-used", "8",
  "-c:a", "libopus", "-b:a", "64k", "Filme_Final.mp4");
ff("-f", "lavfi", "-i", "testsrc=size=960x540:rate=25:duration=12", "-vf", "hue=s=0", "-c:v", "libvpx-vp9", "-b:v", "600k", "-deadline", "realtime", "-cpu-used", "8", "-an", "proxy.mp4");
ff("-f", "lavfi", "-i", "sine=frequency=220:duration=30", "-c:a", "libopus", "-b:a", "64k", "Trilha.ogg");
ff("-ss", "3", "-i", "Filme_Final.mp4", "-frames:v", "1", "-vf", "scale=640:-2", "thumb_filme.png");
ff("-ss", "2", "-i", "proxy.mp4", "-frames:v", "1", "-vf", "scale=640:-2", "thumb_braw.png");
ff("-f", "lavfi", "-i", "mandelbrot=size=3000x2000:rate=1", "-frames:v", "1", "-vf", "hue=s=0", "-q:v", "3", "Still_Pipa.jpg");
ff("-i", "Still_Pipa.jpg", "-vf", "scale=640:-2", "thumb_still.png");
ff("-f", "lavfi", "-i", "gradients=size=1280x720:duration=1:speed=0.05", "-frames:v", "1", "-vf", "hue=s=0", "-update", "1", "thumb_prores.png");
const b64 = (n) => readFileSync(join(MIDIA, n)).toString("base64");

/* ---------------- banco, login e Google ---------------- */

const inicio = new Date();
const sufixo = randomBytes(3).toString("hex");
const ids = { cliente: `teste-previa-cli-${sufixo}`, projeto: `teste-previa-prj-${sufixo}` };
const [conexaoAntes] = await sql`select refresh_token_enc is not null as tem from drive_conexao where id = 'zro'`;

const creds = readFileSync("data/credenciais-dev.txt", "utf8").split("\n").filter((l) => l.includes("@"))[0].trim().split(/\s+/);
const browser = await chromium.launch();
const erros = [];

async function contexto({ largura = 1440, altura = 900, logado = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: largura < 600 ? 2 : 1, hasTouch: largura < 600 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${largura}: ${e}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|drive\.google\.com/.test(m.text()) && erros.push(`${largura}: ${m.text()}`));
  if (logado) {
    await page.goto(`${SITE}/entrar`, { waitUntil: "networkidle" });
    await page.fill("#email", creds[0]);
    await page.fill("#password", creds[1]);
    await Promise.all([page.waitForURL("**/painel**"), page.click("button[type=submit]")]);
  }
  return { ctx, page };
}
const foto = (page, nome) => page.screenshot({ path: join(FOTOS, nome) });

/** Tempo do vídeo dentro do quadro do service worker. */
async function tempoNoQuadro(page) {
  let t = -1;
  for (const f of page.frames().filter((x) => x.url().includes("/painel/stream/quadro"))) {
    const v = await f.evaluate(() => document.querySelector("video, audio")?.currentTime ?? -1).catch(() => -1);
    t = Math.max(t, v);
  }
  return t;
}
/** Mostra os controles do player (o mouse precisa andar). */
async function mexer(page, x, y) {
  await page.mouse.move(x - 40, y - 40);
  await page.mouse.move(x, y, { steps: 4 });
}
async function abrir(page, nome) {
  if (await page.getByRole("dialog").count()) await fechar(page);
  await page.getByRole("button", { name: `Ver ${nome}` }).first().click();
  await page.getByRole("dialog").waitFor();
}
async function fechar(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
}

const { page } = await contexto({ logado: true });
let pastas = {};
let token = "";

try {
  await passo("preparar: Google conectado, projeto com pastas e mídia no Drive falso", async () => {
    await page.goto(`${SITE}/painel/ajustes/google`, { waitUntil: "networkidle" });
    if (!(await page.getByText("Conectado", { exact: true }).count())) {
      await page.locator('a[href^="/api/google/conectar"]').first().click();
      await page.waitForURL(/\/painel\/ajustes\/google/, { timeout: 20_000 });
      await page.getByText("Conectado", { exact: true }).waitFor();
    }
    await sql`insert into clients (id, name, email, created_at, updated_at) values (${ids.cliente}, ${"Teste Prévia SERHS"}, ${"cliente-previa@zro.test"}, now(), now())`;
    await sql`insert into projects (id, code, title, client_id, start_date, created_at, updated_at) values (${ids.projeto}, ${`ZRO-T-${sufixo}`}, ${"Teste Verão em Pipa"}, ${ids.cliente}, ${new Date().toISOString().slice(0, 10)}, now(), now())`;
    await page.goto(`${SITE}/painel/projetos/${ids.projeto}?aba=drive`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Criar pastas no Drive" }).first().click();
    // O PGlite do `npm run dev` às vezes mistura duas consultas ao mesmo tempo (só no computador): consulta
    // devagar e, se a árvore ficou incompleta, "Tentar de novo" (idempotente).
    let dp = null;
    for (let i = 0; i < 4 && !dp; i++) {
      const r = await ate(async () => (await sql`select * from drive_projetos where project_id = ${ids.projeto} and estado in ('pronta', 'incompleta', 'erro')`)[0], 30_000, 1000);
      if (r.estado === "pronta") dp = r;
      else {
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Tentar de novo" }).first().click();
        await espera(2500);
      }
    }
    assert.ok(dp, "pastas do projeto prontas");
    pastas = { cenas: dp.cenas_id, master: dp.subpastas["06 Entregas/Master"], redes: dp.subpastas["06 Entregas/Redes"], legendas: dp.subpastas["06 Entregas/Legendas"] };
    assert.ok(pastas.cenas && pastas.master && pastas.redes && pastas.legendas, JSON.stringify(dp.subpastas));

    const add = async (pai, nome, o = {}) => {
      const { id } = await controle.post("/adicionar", { nome, pai, ...(o.tamanho ? { tamanho: o.tamanho } : { caminho: join(MIDIA, o.arquivo ?? nome) }), ...(o.tipo ? { tipo: o.tipo } : {}) });
      if (o.thumb || o.video || o.imagem) await controle.post("/midia", { id, miniatura: o.thumb ? b64(o.thumb) : null, video: o.video ?? null, imagem: o.imagem ?? null });
      return id;
    };
    const filme = { thumb: "thumb_filme.png", video: { width: 1280, height: 720, durationMillis: "24000" } };
    const pesado = { tamanho: 1_200_000_000, tipo: "video/quicktime", thumb: "thumb_prores.png", video: { width: 3840, height: 2160, durationMillis: "10000" } };
    // 01 Cenas: material bruto.
    await add(pastas.cenas, "Filme_Final.mp4", filme);
    await add(pastas.cenas, "A001_C003.braw", { tamanho: 3_000_000, tipo: "application/octet-stream", thumb: "thumb_braw.png" });
    await add(pastas.cenas, "A001_C003.mp4", { arquivo: "proxy.mp4", thumb: "thumb_braw.png", video: { width: 960, height: 540, durationMillis: "12000" } });
    await add(pastas.cenas, "C004_R3D_sem_proxy.R3D", { tamanho: 2_000_000, tipo: "application/octet-stream" });
    await add(pastas.cenas, "ProRes_4K_pesado.mov", pesado);
    await add(pastas.cenas, "Still_Pipa.jpg", { thumb: "thumb_still.png", imagem: { width: 3000, height: 2000 } });
    await add(pastas.cenas, "Trilha.ogg", { tipo: "audio/ogg" });
    // 06 Entregas: o que o cliente vê.
    await add(pastas.master, "Filme_Final.mp4", filme);
    await add(pastas.master, "Still_Pipa.jpg", { thumb: "thumb_still.png", imagem: { width: 3000, height: 2000 } });
    await add(pastas.redes, "ProRes_4K_pesado.mov", pesado);
    await add(pastas.redes, "Reels_9x16.mp4", { arquivo: "Filme_Final.mp4", thumb: "thumb_filme.png", video: { width: 1280, height: 720, durationMillis: "24000" } });
    await controle.post("/adicionar", { nome: "Legenda_PT.srt", pai: pastas.legendas, base64: Buffer.from("1\n00:00:01,000 --> 00:00:04,000\nOnde tudo começa e o comum termina.\n").toString("base64") });
  });

  /* ---------------- painel ---------------- */

  await passo("Arquivos: Miniaturas (lembra a escolha), com duração no vídeo e ícone sem miniatura", async () => {
    await page.goto(`${SITE}/painel/arquivos?pasta=${pastas.cenas}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Miniaturas" }).click();
    await page.getByRole("button", { name: "Ver Filme_Final.mp4" }).waitFor();
    await ate(() => page.evaluate(() => [...document.querySelectorAll("li img")].filter((i) => i.complete && i.naturalWidth > 1).length >= 4));
    await page.getByText("0:24").first().waitFor();
    await foto(page, "painel-arquivos-miniaturas-1440.png");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByRole("button", { name: "Miniaturas" }).getAttribute("aria-pressed"), "true", "a escolha ficou");
  });

  await passo("Prévia de vídeo: toca pelo service worker, o tempo avança e o Range chega no Google", async () => {
    const antes = await controle.stats();
    await abrir(page, "Filme_Final.mp4");
    const palco = page.locator("[data-palco-player]");
    await palco.waitFor({ timeout: 20_000 });
    await ate(async () => (await tempoNoQuadro(page)) >= 0, 20_000);
    await palco.click();
    await ate(async () => (await tempoNoQuadro(page)) > 2.5, 20_000);
    const t1 = await tempoNoQuadro(page);
    await espera(1500);
    const t2 = await tempoNoQuadro(page);
    assert.ok(t2 > t1, `o tempo avança (${t1} → ${t2})`);
    const depois = await controle.stats();
    assert.ok(depois.rangeGets > antes.rangeGets, "o Google recebeu pedidos com Range");
    // O SW responde 206 com o pedaço pedido (lido de dentro do quadro, que ele controla).
    const quadro = page.frames().find((x) => x.url().includes("/painel/stream/quadro"));
    const r = await quadro.evaluate(async () => {
      const v = document.querySelector("video");
      const res = await fetch(v.currentSrc, { headers: { Range: "bytes=100-1099" } });
      return { status: res.status, tamanho: (await res.arrayBuffer()).byteLength, cr: res.headers.get("content-range"), sw: Boolean(navigator.serviceWorker.controller) };
    });
    assert.equal(r.status, 206);
    assert.equal(r.tamanho, 1000);
    assert.match(r.cr ?? "", /^bytes 100-1099\/\d+$/);
    assert.ok(r.sw, "o quadro está sob o service worker");
    await mexer(page, 700, 500);
    await foto(page, "painel-previa-video-tocando-1440.png");
    console.log(`        tempo ${t1.toFixed(2)} → ${t2.toFixed(2)} s · Range no Google: ${depois.rangeGets - antes.rangeGets} · SW 206 ${r.cr}`);
    await fechar(page);
  });

  await passo("Prévia de foto: grande, com o original pelo stream", async () => {
    await abrir(page, "Still_Pipa.jpg");
    await ate(() => page.evaluate(() => [...document.querySelectorAll("[role=dialog] [data-zoom] img")].some((i) => i.src.startsWith("blob:") && i.complete && i.naturalWidth === 3000)), 20_000);
    await foto(page, "painel-previa-foto-1440.png");
    await fechar(page);
  });

  await passo("Formato que não toca (R3D sem proxy)", async () => {
    await abrir(page, "C004_R3D_sem_proxy.R3D");
    await page.getByText("Este formato não toca no navegador.").waitFor();
    await foto(page, "painel-previa-formato-1440.png");
    await fechar(page);
  });

  await passo("Proxy de câmera: BRAW toca o .mp4 de mesmo nome, com o selo", async () => {
    await abrir(page, "A001_C003.braw");
    await page.getByText("Prévia em baixa resolução. O Baixar traz o original.").waitFor({ timeout: 20_000 });
    await page.getByText("Proxy", { exact: true }).waitFor();
    await ate(async () => (await tempoNoQuadro(page)) >= 0, 20_000);
    await page.locator("[data-palco-player]").click();
    await ate(async () => (await tempoNoQuadro(page)) > 1, 20_000);
    await mexer(page, 700, 500);
    await foto(page, "painel-previa-proxy-1440.png");
    await fechar(page);
  });

  await passo("Vídeo pesado demais (1,2 GB em 10 s): aviso com Ver no Google Drive", async () => {
    await abrir(page, "ProRes_4K_pesado.mov");
    await page.getByText("Vídeo pesado demais para tocar pela rede.").waitFor({ timeout: 20_000 });
    const href = await page.getByRole("link", { name: "Ver no Google Drive" }).getAttribute("href");
    assert.match(href, /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/);
    await page.getByRole("button", { name: "Tentar mesmo assim" }).waitFor();
    await foto(page, "painel-previa-pesado-1440.png");
    await fechar(page);
  });

  await passo("Vigia: a rede não acompanha (Google a 20 KB/s) → pausa e oferece o Drive", async () => {
    await controle.post("/opcoes", { perConnectionBps: 20_000 });
    try {
      await abrir(page, "Filme_Final.mp4");
      await page.locator("[data-palco-player]").waitFor({ timeout: 20_000 });
      await ate(async () => (await tempoNoQuadro(page)) >= 0, 20_000);
      await page.locator("[data-palco-player]").click();
      await page.getByText("Vídeo pesado demais para tocar pela rede.").waitFor({ timeout: 40_000 });
      await page.getByRole("button", { name: "Tentar mesmo assim" }).waitFor();
      await foto(page, "painel-previa-travou-1440.png");
      await fechar(page);
    } finally {
      await controle.post("/opcoes", { perConnectionBps: 0 });
    }
  });

  await passo("Áudio e lista com miniaturas pequenas", async () => {
    await abrir(page, "Trilha.ogg");
    await ate(async () => (await tempoNoQuadro(page)) >= 0, 20_000);
    await page.getByRole("dialog").getByRole("button", { name: "Reproduzir" }).first().click();
    await ate(async () => (await tempoNoQuadro(page)) > 1, 20_000);
    await foto(page, "painel-previa-audio-1440.png");
    await fechar(page);
    await page.getByRole("button", { name: "Lista" }).click();
    await espera(800);
    await foto(page, "painel-arquivos-lista-1440.png");
    await page.getByRole("button", { name: "Miniaturas" }).click();
  });

  await passo("Celular (390): grade, vídeo em tela cheia e o aviso de pesado", async () => {
    const { ctx: c2, page: p2 } = await contexto({ largura: 390, altura: 844, logado: true });
    await p2.goto(`${SITE}/painel/arquivos?pasta=${pastas.cenas}`, { waitUntil: "networkidle" });
    await p2.getByRole("button", { name: "Miniaturas" }).click();
    await p2.getByRole("button", { name: "Ver Filme_Final.mp4" }).waitFor();
    await p2.getByRole("button", { name: "Ver Filme_Final.mp4" }).scrollIntoViewIfNeeded();
    await ate(() => p2.evaluate(() => [...document.querySelectorAll("li img")].filter((i) => i.complete && i.naturalWidth > 1 && getComputedStyle(i).opacity === "1").length >= 4));
    await foto(p2, "painel-arquivos-miniaturas-390.png");
    const largura = await p2.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largura <= 390, `sem rolagem lateral (${largura})`);
    await abrir(p2, "Filme_Final.mp4");
    await p2.locator("[data-palco-player]").waitFor({ timeout: 20_000 });
    await ate(async () => (await tempoNoQuadro(p2)) >= 0, 20_000);
    await p2.locator("[data-palco-player]").tap();
    await ate(async () => (await tempoNoQuadro(p2)) > 1.5, 20_000);
    await foto(p2, "painel-previa-video-390.png");
    await fechar(p2);
    await abrir(p2, "ProRes_4K_pesado.mov");
    await p2.getByText("Vídeo pesado demais para tocar pela rede.").waitFor();
    await foto(p2, "painel-previa-pesado-390.png");
    await c2.close();
  });

  /* ---------------- área do cliente ---------------- */

  await passo("Liberar entregas e abrir a área do cliente", async () => {
    await page.goto(`${SITE}/painel/projetos/${ids.projeto}?aba=drive`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Liberar entregas" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Liberar entregas" }).click();
    await ate(async () => (await sql`select 1 from drive_projetos where project_id = ${ids.projeto} and entregas_liberadas_em is not null`).length);
    const [l] = await sql`select id, token_enc from drive_links where client_id = ${ids.cliente} and tipo = 'cliente-area' and revogado_em is null`;
    const [, iv, cifra, tag] = l.token_enc.split(".");
    const d = createDecipheriv("aes-256-gcm", createHash("sha256").update("zro-dev-drive-key").digest(), Buffer.from(iv, "base64url"));
    d.setAAD(Buffer.from(`drive_links.token:${l.id}`));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    token = Buffer.concat([d.update(Buffer.from(cifra, "base64url")), d.final()]).toString("utf8");
    assert.equal(token.length, 43);
  });

  for (const largura of [1440, 390]) {
    await passo(`Área do cliente (${largura}): miniaturas por seção e o filme tocando direto do Google`, async () => {
      const { ctx: c3, page: p3 } = await contexto({ largura, altura: largura < 600 ? 844 : 900 });
      await p3.goto(`${SITE}/cliente/${token}`, { waitUntil: "networkidle" });
      await p3.getByRole("button", { name: "Assistir Filme_Final.mp4" }).waitFor();
      for (const secao of ["Master", "Redes", "Legendas"]) await p3.getByText(secao, { exact: true }).first().waitFor();
      await ate(() => p3.evaluate(() => [...document.querySelectorAll("li img")].filter((i) => i.complete && i.naturalWidth > 1).length >= 4));
      await p3.screenshot({ path: join(FOTOS, `cliente-area-${largura}.png`), fullPage: true });
      const largo = await p3.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(largo <= largura, `sem rolagem lateral (${largo})`);

      const antes = await controle.stats();
      await p3.getByRole("button", { name: "Assistir Filme_Final.mp4" }).click();
      await p3.getByRole("dialog").waitFor();
      const palco = p3.locator("[data-palco-player]");
      await palco.waitFor();
      if (largura < 600) await palco.tap();
      else await palco.click();
      const tempo = () => p3.evaluate(() => document.querySelector("[role=dialog] video")?.currentTime ?? -1);
      await ate(async () => (await tempo()) > 2, 20_000);
      const depois = await controle.stats();
      assert.ok(depois.midiaPorChave > antes.midiaPorChave, "o vídeo veio do Google pela chave (e o Referer passou)");
      const src = await p3.evaluate(() => document.querySelector("[role=dialog] video")?.src ?? "");
      assert.match(src, /alt=media.*key=/);
      if (largura >= 600) await mexer(p3, Math.round(largura / 2), 400);
      const topo = await p3.evaluate(() => document.querySelector("[role=dialog]")?.getBoundingClientRect().top ?? -1);
      assert.ok(topo >= 0 && topo < 40, `a janela fica no lugar (topo ${topo})`);
      await foto(p3, `cliente-previa-video-${largura}.png`);
      await p3.keyboard.press("Escape");
      await p3.getByRole("dialog").waitFor({ state: "detached" });

      // Pesado: o player do próprio Google Drive embutido (a cópia leve dele).
      await p3.getByRole("button", { name: "Assistir ProRes_4K_pesado.mov" }).click();
      const iframe = p3.locator("iframe[data-drive-previa]");
      await iframe.waitFor();
      assert.match(await iframe.getAttribute("src"), /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/preview$/);
      await p3.getByText("Arquivo pesado: tocando pela cópia leve do Google Drive.").waitFor();
      await espera(600); // a janela termina de entrar
      await foto(p3, `cliente-previa-pesado-${largura}.png`);
      await p3.keyboard.press("Escape");
      await p3.getByRole("dialog").waitFor({ state: "detached" });

      await p3.getByRole("button", { name: "Ver Still_Pipa.jpg" }).click();
      await ate(() => p3.evaluate(() => [...document.querySelectorAll("[role=dialog] [data-zoom] img")].some((i) => i.complete && i.naturalWidth >= 2000)), 20_000);
      await foto(p3, `cliente-previa-foto-${largura}.png`);
      await c3.close();
    });
  }

  await passo("Cliente: miniatura de fora de 06 Entregas é recusada; cabeçalhos da página", async () => {
    assert.ok(token, "token da área");
    const [fora] = (await fetch(`${CONTROLE}/arquivos?pasta=${pastas.cenas}`).then((r) => r.json())).filter((i) => i.nome === "Still_Pipa.jpg");
    const r = await fetch(`${SITE}/cliente/${token}/miniatura/${fora.id}?s=640`);
    assert.equal(r.status, 404);
    const h = await fetch(`${SITE}/cliente/${token}`);
    assert.equal(h.headers.get("referrer-policy"), "strict-origin");
    assert.match(h.headers.get("content-security-policy") ?? "", /frame-src 'self' https:\/\/drive\.google\.com/);
  });
} finally {
  await browser.close();
  if (process.env.ZRO_MANTER !== "1") {
    // Dados de teste fora do banco local (o Drive falso some quando o servidor dele para).
    await sql`delete from drive_compartilhamentos where project_id = ${ids.projeto} or client_id = ${ids.cliente}`;
    await sql`delete from login_attempts where email in (select 'area:' || id from drive_links where client_id = ${ids.cliente})`;
    await sql`delete from drive_links where client_id = ${ids.cliente}`;
    await sql`delete from drive_lotes where project_id = ${ids.projeto} or client_id = ${ids.cliente}`;
    await sql`delete from drive_projetos where project_id = ${ids.projeto}`;
    await sql`delete from drive_pastas where criado_em >= ${inicio}`;
    await sql`delete from activities where project_id = ${ids.projeto} or client_id = ${ids.cliente}`;
    await sql`delete from projects where id = ${ids.projeto}`;
    await sql`delete from clients where id = ${ids.cliente}`;
    if (!conexaoAntes?.tem) {
      await sql`update drive_conexao set conta = null, conta_nome = null, escopo = null, refresh_token_enc = null, raiz_id = null, clientes_id = null, conectado_por_id = null, conectado_em = null, erro = null, erro_em = null, diagnosticos = '[]'::jsonb where id = 'zro'`;
    }
    console.log("dados de teste apagados do banco local");
  }
  await pg.end();
}

console.log(`\n${resultados.filter((r) => r[0] === "ok").length} de ${resultados.length} ok · fotos em ${FOTOS}`);
if (erros.length) console.log(`erros no console:\n  ${[...new Set(erros)].slice(0, 15).join("\n  ")}`);
process.exit(resultados.every((r) => r[0] === "ok") ? 0 : 1);
