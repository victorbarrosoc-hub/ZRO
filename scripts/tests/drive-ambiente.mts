/**
 * Ambiente dos testes do Drive: Google falso (scripts/google-mock), Postgres em memória (PGlite servido
 * por socket numa porta livre, como o `npm run dev`), variáveis de teste e as migrações do repositório.
 * Nada toca em data/pglite nem no Google de verdade.
 *
 * Importe ANTES de qualquer módulo de src/ (as variáveis precisam existir quando o banco conecta).
 */
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { startMockDrive } from "../google-mock/mock-drive.mjs";
import { addDaysISO, todayISO } from "../../src/lib/format";

export const CLIENTE_OAUTH = { clientId: "zro-teste.apps.googleusercontent.com", clientSecret: "GOCSPX-zro-teste" };
export const CONTA = "contato@dissesim.com.br";
export const ORIGEM = "http://localhost:3000";

async function portaLivre(): Promise<number> {
  return new Promise((ok, falha) => {
    const s = net.createServer();
    s.once("error", falha);
    s.listen(0, "127.0.0.1", () => {
      const porta = (s.address() as net.AddressInfo).port;
      s.close(() => ok(porta));
    });
  });
}

export type Ambiente = Awaited<ReturnType<typeof prepararAmbiente>>;

/** O que os testes usam do Google falso (scripts/google-mock/mock-drive.mjs é JavaScript). */
export type ItemMock = {
  id: string;
  name: string;
  parents: string[];
  isFolder: boolean;
  trashed: boolean;
  size: number | null;
  description: string | null;
  appProperties: Record<string, string> | null;
  permissions: { id: string; type: string; role: string; emailAddress?: string }[];
};
export type MockDrive = {
  url: string;
  listAll(): ItemMock[];
  getItem(id: string): ItemMock | null;
  addFolder(nome: string, pai?: string): ItemMock;
  addFile(nome: string, pai?: string, o?: { size?: number; content?: string | Uint8Array }): ItemMock;
  permissionsOf(id: string): ItemMock["permissions"];
  contentMd5(id: string): Promise<string>;
  setOptions(o: Record<string, unknown>): unknown;
  stats(): { uploadSessionsCreated: number; bytesReceived: number; emailsDeCompartilhamento: number; faults: { uploadDrops: number } };
  issueTokens(): { accessToken: string; refreshToken: string };
  expireUploadSessions(): void;
  revokeRefreshTokens(): void;
  expireAccessTokens(): void;
  close(): Promise<void>;
};

export async function prepararAmbiente(opcoesMock: Record<string, unknown> = {}) {
  const mock = (await startMockDrive({
    corsModo: "google",
    client: CLIENTE_OAUTH,
    user: { emailAddress: CONTA, displayName: "ZRO Filmes" },
    ...opcoesMock,
  })) as unknown as MockDrive;
  const pg = await PGlite.create();
  const porta = await portaLivre();
  const servidor = new PGLiteSocketServer({ db: pg, port: porta, host: "127.0.0.1", maxConnections: 10 });
  await servidor.start();

  for (const k of ["DATABASE_URL", "POSTGRES_URL", "VERCEL", "VERCEL_ENV", "ZRO_DRIVE_KEY", "NEXT_PUBLIC_SITE_URL"]) delete process.env[k];
  Object.assign(process.env, {
    ZRO_LOCAL_DB_URL: `postgres://postgres:postgres@127.0.0.1:${porta}/postgres`,
    GOOGLE_CLIENT_ID: CLIENTE_OAUTH.clientId,
    GOOGLE_CLIENT_SECRET: CLIENTE_OAUTH.clientSecret,
    ZRO_GOOGLE_API_BASE: mock.url,
  });

  const banco = await import("../../src/lib/db/client");
  await banco.runMigrations();
  const { db, schema } = banco;

  // Dados de teste. Datas a partir de hoje (o link da diária vale 30 dias depois dela).
  const hoje = todayISO();
  const datas = { projeto: hoje, mes: hoje.slice(0, 7), d1: addDaysISO(hoje, 1), d2: addDaysISO(hoje, 2) };
  const [user] = await db.insert(schema.users).values({ name: "Teste Victor", email: "teste@zro.test", passwordHash: "x" }).returning();
  const [cliente] = await db.insert(schema.clients).values({ name: "Teste SERHS", email: "cliente@serhs.test" }).returning();
  const [outroCliente] = await db.insert(schema.clients).values({ name: "Teste Outro" }).returning();
  const [projeto] = await db
    .insert(schema.projects)
    .values({ code: "ZRO-2026-901", title: "Teste Verão Pipa", clientId: cliente.id, startDate: datas.projeto })
    .returning();
  const [projetoOutro] = await db
    .insert(schema.projects)
    .values({ code: "ZRO-2026-902", title: "Teste De Outro", clientId: outroCliente.id, startDate: datas.projeto })
    .returning();
  const [diaria1] = await db.insert(schema.events).values({ projectId: projeto.id, type: "diaria", title: "Diária 1", date: datas.d1 }).returning();
  const [diaria2] = await db.insert(schema.events).values({ projectId: projeto.id, type: "diaria", title: "Diária 2", date: datas.d2 }).returning();
  const [rafael] = await db.insert(schema.freelancers).values({ name: "Teste Rafael Moura", phone: "84999990000" }).returning();
  const [carla] = await db.insert(schema.freelancers).values({ name: "Teste Carla Dias" }).returning();
  await db.insert(schema.eventCrew).values([
    { eventId: diaria2.id, freelancerId: rafael.id, function: "captacao-camera" },
    { eventId: diaria2.id, freelancerId: carla.id, function: "som" },
  ]);

  // Conexão com o Google falso (como se o callback tivesse gravado).
  const { refreshToken } = mock.issueTokens();
  const { salvarConexao } = await import("../../src/lib/google/conexao");
  await salvarConexao({ refresh: refreshToken, conta: CONTA, nome: "ZRO Filmes", escopo: "https://www.googleapis.com/auth/drive", userId: user.id, trocar: false });

  async function fechar() {
    await banco.closeDatabase().catch(() => {});
    await servidor.stop().catch(() => {});
    await pg.close().catch(() => {});
    await mock.close();
  }

  return {
    mock,
    db,
    schema,
    fechar,
    datas,
    ids: {
      user: user.id,
      cliente: cliente.id,
      outroCliente: outroCliente.id,
      projeto: projeto.id,
      projetoOutro: projetoOutro.id,
      diaria1: diaria1.id,
      diaria2: diaria2.id,
      rafael: rafael.id,
      carla: carla.id,
    },
  };
}

/** Pastas repetidas no Drive falso (mesmo pai e mesmo nome). */
export function pastasRepetidas(mock: MockDrive): string[] {
  const vistos = new Map<string, number>();
  for (const it of mock.listAll()) {
    if (!it.isFolder || it.trashed) continue;
    const k = `${it.parents[0]}/${it.name}`;
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  return [...vistos.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

/** Caminho legível de um item do Drive falso ("ZRO/Clientes/…"). */
export function caminhoNoMock(mock: MockDrive, id: string): string {
  const partes: string[] = [];
  let atual = mock.getItem(id);
  while (atual && atual.parents.length) {
    partes.unshift(atual.name);
    atual = mock.getItem(atual.parents[0]);
  }
  return partes.join("/");
}
