/** Cifra dos segredos do Drive, tokens dos links e a limpeza de logs. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { afterEach, test } from "node:test";
import { abrir, ChaveErrada, chaveDerivada, FORMATO_TOKEN, hashToken, novoToken, selar } from "../../src/lib/google/cripto";
import { deResposta, redigir } from "../../src/lib/google/erros";

const ambiente = { ...process.env };
afterEach(() => {
  for (const k of ["ZRO_DRIVE_KEY", "NODE_ENV", "SESSION_SECRET"]) {
    if (ambiente[k] === undefined) delete process.env[k];
    else process.env[k] = ambiente[k];
  }
});

test("ida e volta (chave de dev e chave da variável)", () => {
  delete process.env.ZRO_DRIVE_KEY;
  const s = selar("1//refresh-secreto", "drive_conexao.refresh:zro");
  assert.match(s, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(!s.includes("refresh-secreto"));
  assert.equal(abrir(s, "drive_conexao.refresh:zro"), "1//refresh-secreto");
  process.env.ZRO_DRIVE_KEY = randomBytes(32).toString("base64");
  const t = selar("https://www.googleapis.com/upload/drive/v3/files?upload_id=abc", "drive_envios.sessao:e1");
  assert.equal(abrir(t, "drive_envios.sessao:e1"), "https://www.googleapis.com/upload/drive/v3/files?upload_id=abc");
  assert.notEqual(selar("x", "c"), selar("x", "c"), "IV novo a cada vez");
});

test("tag adulterada, contexto trocado e chave errada: ChaveErrada", () => {
  process.env.ZRO_DRIVE_KEY = randomBytes(32).toString("base64");
  const s = selar("segredo", "drive_links.token:L1");
  const partes = s.split(".");
  const tag = Buffer.from(partes[3], "base64url");
  tag[0] ^= 1;
  assert.throws(() => abrir([...partes.slice(0, 3), tag.toString("base64url")].join("."), "drive_links.token:L1"), ChaveErrada);
  const cifra = Buffer.from(partes[2], "base64url");
  cifra[0] ^= 1;
  assert.throws(() => abrir([partes[0], partes[1], cifra.toString("base64url"), partes[3]].join("."), "drive_links.token:L1"), ChaveErrada);
  assert.throws(() => abrir(s, "drive_links.token:L2"), ChaveErrada, "a cifra de uma linha não serve em outra");
  assert.throws(() => abrir("v2.x.y.z", "drive_links.token:L1"), ChaveErrada);
  assert.throws(() => abrir("lixo", "drive_links.token:L1"), ChaveErrada);
  process.env.ZRO_DRIVE_KEY = randomBytes(32).toString("base64");
  assert.throws(() => abrir(s, "drive_links.token:L1"), ChaveErrada);
});

test("produção sem chave: só selar/abrir lançam (com a instrução); chave de tamanho errado também", () => {
  delete process.env.ZRO_DRIVE_KEY;
  (process.env as Record<string, string>).NODE_ENV = "production";
  assert.throws(() => selar("x", "c"), /ZRO_DRIVE_KEY/);
  assert.throws(() => abrir("v1.a.b.c", "c"), /ZRO_DRIVE_KEY/);
  (process.env as Record<string, string>).NODE_ENV = "development";
  process.env.ZRO_DRIVE_KEY = randomBytes(16).toString("base64");
  assert.throws(() => selar("x", "c"), /32 bytes/);
});

test("token do link: 256 bits em base64url; o banco guarda só o sha256", () => {
  const t = novoToken();
  assert.match(t, FORMATO_TOKEN);
  assert.equal(t.length, 43);
  assert.notEqual(novoToken(), t);
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.equal(hashToken(t), hashToken(t));
});

test("chaves derivadas: uma por uso, 32 bytes", () => {
  const a = chaveDerivada("zro:google-oauth");
  const b = chaveDerivada("zro:area-cliente");
  assert.equal(a.length, 32);
  assert.notDeepEqual(Buffer.from(a), Buffer.from(b));
  process.env.SESSION_SECRET = "s".repeat(40);
  assert.notDeepEqual(Buffer.from(chaveDerivada("zro:google-oauth")), Buffer.from(a));
});

test("redigir apaga segredos de qualquer texto", () => {
  const texto = redigir(
    'PUT https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=ABCD1234 Bearer ya29.a0AfB_byC refresh_token=1//0gXYZ "access_token":"ya29.zzz" ?code=4/0AY123&state=x',
  );
  for (const s of ["ABCD1234", "a0AfB_byC", "1//0gXYZ", "ya29.zzz", "4/0AY123"]) assert.ok(!texto.includes(s), s);
});

test("erros do Google viram motivos", () => {
  const g = (status: number, reason: string) => deResposta(status, { error: { code: status, errors: [{ reason }] } }).motivo;
  assert.equal(g(403, "storageQuotaExceeded"), "sem_espaco");
  assert.equal(g(403, "userRateLimitExceeded"), "taxa");
  assert.equal(g(403, "publishOutNotPermitted"), "compartilhamento_bloqueado");
  assert.equal(g(403, "insufficientFilePermissions"), "sem_permissao");
  assert.equal(g(404, "notFound"), "nao_encontrado");
  assert.equal(g(503, "backendError"), "taxa");
  assert.equal(g(401, "authError"), "auth");
  assert.equal(deResposta(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }).motivo, "reconectar");
});
