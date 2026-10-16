// Google falso para o computador e para os testes de ponta a ponta (docs/dev/drive.md §13.4).
//
//   node scripts/google-mock/servidor.mjs
//
// Drive + OAuth em http://127.0.0.1:54400 (cliente "zro-teste", conta contato@dissesim.com.br, CORS como o
// do Google) e um controle em http://127.0.0.1:54401:
//   POST /opcoes      setOptions(corpo)       ex.: {"failures":{"dropUploadProb":0.2}}, {"sessionTtlMs":2000}
//   POST /revogar     refresh tokens mortos (invalid_grant)
//   POST /expirar     tokens de acesso vencidos
//   POST /zerar-dia   zera o limite diário de envio
//   POST /zerar-stats zera as contagens
//   GET  /stats       contagens (sessões, PUTs, bytes, e-mails de compartilhamento…)
//   GET  /arquivos?pasta=<id>   itens (nome, tamanho, md5, pais, appProperties, permissões); sem pasta, todos
//
// No .env.local (nunca versionado):
//   GOOGLE_CLIENT_ID=zro-teste.apps.googleusercontent.com
//   GOOGLE_CLIENT_SECRET=GOCSPX-zro-teste
//   ZRO_GOOGLE_API_BASE=http://127.0.0.1:54400
import http from "node:http";
import { startMockDrive } from "./mock-drive.mjs";

const PORTA = Number(process.env.ZRO_MOCK_PORTA ?? 54400);
const CONTROLE = Number(process.env.ZRO_MOCK_CONTROLE ?? PORTA + 1);

const mock = await startMockDrive({
  port: PORTA,
  corsModo: "google",
  client: { clientId: "zro-teste.apps.googleusercontent.com", clientSecret: "GOCSPX-zro-teste" },
  user: { emailAddress: "contato@dissesim.com.br", displayName: "ZRO Filmes" },
});

async function lerJson(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  const texto = Buffer.concat(partes).toString("utf8");
  return texto ? JSON.parse(texto) : {};
}

function responder(res, status, corpo) {
  const texto = JSON.stringify(corpo ?? {});
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(texto) });
  res.end(texto);
}

async function itens(pasta) {
  const lista = pasta ? mock.listAll().filter((it) => it.parents.includes(mock.getItem(pasta)?.id ?? pasta)) : mock.listAll();
  return Promise.all(
    lista.map(async (it) => ({
      id: it.id,
      nome: it.name,
      pasta: it.isFolder,
      tamanho: it.size,
      md5: it.isFolder ? null : await mock.contentMd5(it.id).catch(() => it.md5),
      pais: it.parents,
      lixeira: it.trashed,
      descricao: it.description,
      appProperties: it.appProperties,
      permissoes: it.permissions,
    })),
  );
}

const controle = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${CONTROLE}`);
    if (req.method === "POST" && url.pathname === "/opcoes") {
      mock.setOptions(await lerJson(req));
      return responder(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/revogar") {
      mock.revokeRefreshTokens();
      return responder(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/expirar") {
      mock.expireAccessTokens();
      return responder(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/zerar-dia") {
      mock.resetDailyUsage();
      return responder(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/zerar-stats") {
      mock.resetStats();
      return responder(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/stats") return responder(res, 200, mock.stats());
    if (req.method === "GET" && url.pathname === "/arquivos") return responder(res, 200, await itens(url.searchParams.get("pasta")));
    responder(res, 404, { ok: false });
  } catch (e) {
    responder(res, 500, { ok: false, erro: String(e?.message ?? e) });
  }
});
await new Promise((ok) => controle.listen(CONTROLE, "127.0.0.1", ok));

console.log(`Google falso: ${mock.url} (controle em http://127.0.0.1:${CONTROLE})`);

const parar = async () => {
  controle.close();
  await mock.close();
  process.exit(0);
};
process.on("SIGINT", parar);
process.on("SIGTERM", parar);
