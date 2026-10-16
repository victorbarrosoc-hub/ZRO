/**
 * Dados base: usuários, configurações, catálogo, modelos, kits, FAQ e equipe.
 * Só cria o que ainda não existe, então pode rodar várias vezes.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DB } from "../../src/lib/db/client";
import * as s from "../../src/lib/db/schema";
import { ensureDatabaseIdentity } from "../../src/lib/db/summary";
import { hashPassword } from "../../src/lib/auth/password";
import { cleanEquipmentName, equipmentKey, guessEquipmentCategory } from "../../src/lib/domain";
import { formatPhone } from "../../src/lib/format";
import {
  DEFAULT_CATALOG,
  DEFAULT_EQUIPMENT,
  DEFAULT_EQUIPMENT_MORE,
  DEFAULT_FAQS,
  DEFAULT_KITS,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
} from "../../src/lib/db/defaults";

type SeedUser = { key: string; name: string; envPrefix: string; email: string; password?: string };

function seedUsersFromEnv(): SeedUser[] {
  return [
    {
      key: "victor",
      name: "Victor Barroso",
      envPrefix: "ZRO_VICTOR",
      email: process.env.ZRO_VICTOR_EMAIL ?? "victor@zro.local",
      password: process.env.ZRO_VICTOR_PASSWORD,
    },
    {
      key: "edu",
      name: "Edu Cardoso",
      envPrefix: "ZRO_EDU",
      email: process.env.ZRO_EDU_EMAIL ?? "edu@zro.local",
      password: process.env.ZRO_EDU_PASSWORD,
    },
  ];
}

/**
 * Esqueceu a senha: ZRO_REDEFINIR_SENHA=victor (ou edu) + a senha nova em
 * ZRO_VICTOR_PASSWORD (ou ZRO_EDU_PASSWORD) e Redeploy. Cada senha nova vale
 * uma vez só: se as variáveis ficarem esquecidas na Vercel, os próximos deploys
 * não desfazem uma troca de senha feita depois no painel.
 */
async function resetPassword(db: DB, u: SeedUser) {
  const wanted = (process.env.ZRO_REDEFINIR_SENHA ?? "").toLowerCase().split(/[\s,;]+/);
  if (!wanted.includes(u.key)) return;
  if (!u.password || u.password.length < 10) {
    console.warn(`⚠ Senha de ${u.name} não redefinida: ${u.envPrefix}_PASSWORD precisa ter pelo menos 10 caracteres.`);
    return;
  }
  const user =
    (await db.query.users.findFirst({ where: eq(s.users.email, u.email.toLowerCase()) })) ??
    (await db.query.users.findFirst({ where: eq(s.users.name, u.name) }));
  if (!user) {
    console.warn(`⚠ Senha de ${u.name} não redefinida: conta não encontrada.`);
    return;
  }
  const marker = `senha-redefinida:${u.key}`;
  const fingerprint = createHash("sha256").update(`${user.id}:${u.password}`).digest("hex");
  const done = await db.query.settings.findFirst({ where: eq(s.settings.key, marker) });
  if (done?.value === fingerprint) return;
  await db.update(s.users).set({ passwordHash: await hashPassword(u.password) }).where(eq(s.users.id, user.id));
  await db
    .insert(s.settings)
    .values({ key: marker, value: fingerprint })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: fingerprint } });
  console.log(`✓ Senha de ${u.name} (${user.email}) redefinida.`);
}

export async function ensureUsers(db: DB, opts: { allowGenerated: boolean }) {
  const created: { email: string; password: string }[] = [];
  for (const u of seedUsersFromEnv()) {
    let exists = await db.query.users.findFirst({ where: eq(s.users.email, u.email.toLowerCase()) });
    // E-mail trocado na variável (ex.: o do Edu estava errado): renomeia a conta que já existe
    // em vez de criar outra. Mesma pessoa = mesmo nome; senha, foto e histórico continuam.
    if (!exists && process.env[`${u.envPrefix}_EMAIL`]) {
      // mesmo nome, ou mesmo primeiro nome (o nome pode ter sido ajustado em Minha conta)
      const outros = seedUsersFromEnv().filter((x) => x.key !== u.key).map((x) => x.email.toLowerCase());
      const primeiro = (n: string) => n.trim().split(/\s+/)[0]?.toLowerCase();
      const mesma = (await db.query.users.findMany()).find(
        (x) => !outros.includes(x.email) && (x.name === u.name || primeiro(x.name) === primeiro(u.name)),
      );
      if (mesma) {
        await db.update(s.users).set({ email: u.email.toLowerCase() }).where(eq(s.users.id, mesma.id));
        console.log(`✓ E-mail de ${u.name} trocado de ${mesma.email} para ${u.email.toLowerCase()}.`);
        exists = mesma;
      }
    }
    await resetPassword(db, u);
    if (exists) continue;
    let password = u.password;
    if (!password) {
      if (!opts.allowGenerated) {
        // Não derruba o deploy do site: a conta é criada no próximo deploy com a senha definida.
        console.warn(
          `⚠ Conta de ${u.name} não criada: defina ${u.envPrefix}_EMAIL e ${u.envPrefix}_PASSWORD e faça um novo deploy.`,
        );
        continue;
      }
      password = randomBytes(9).toString("base64url");
    } else if (!opts.allowGenerated && password.length < 10) {
      throw new Error(`A senha de ${u.name} (${u.envPrefix}_PASSWORD) precisa de pelo menos 10 caracteres.`);
    }
    await db.insert(s.users).values({
      name: u.name,
      email: u.email.toLowerCase(),
      passwordHash: await hashPassword(password),
    });
    created.push({ email: u.email.toLowerCase(), password: u.password ? "(definida no ambiente)" : password });
  }
  if (created.length && opts.allowGenerated) {
    mkdirSync("./data", { recursive: true });
    const lines = created.map((c) => `${c.email}  ${c.password}`).join("\n");
    writeFileSync("./data/credenciais-dev.txt", `Acesso local à área interna (não versionado)\n\n${lines}\n`, {
      flag: "a",
    });
    console.log("\nUsuários criados (senhas também em data/credenciais-dev.txt):\n" + lines + "\n");
  }
}

export async function ensureSettings(db: DB) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }
}

async function isEmpty(db: DB, table: SQLiteTable) {
  const [row] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(table);
  return Number(row?.n ?? 0) === 0;
}

export async function ensureCatalog(db: DB) {
  if (!(await isEmpty(db, s.catalogItems))) return;
  await db.insert(s.catalogItems).values(DEFAULT_CATALOG.map((c, i) => ({ ...c, sortOrder: i })));
}

export async function ensureTemplates(db: DB) {
  if (!(await isEmpty(db, s.projectTemplates))) return;
  await db.insert(s.projectTemplates).values(DEFAULT_TEMPLATES.map((t) => ({ ...t, tasks: [...t.tasks] })));
}

/*
 * Pós-produção nos modelos (out/2026): troca, nos modelos que vieram de fábrica, a parte
 * antiga (backup + etapas 05, 06 e 07) pela pós completa. Só mexe se essa parte estiver
 * igual à de fábrica: modelo que o Victor editou nessas etapas fica como está.
 */
const POS_ANTIGA: Record<string, { stage: string; title: string }[]> = {
  "Filme de marca": [
    { stage: "producao", title: "Backup do material bruto em 2 lugares" },
    { stage: "narrativa", title: "Seleção de material" },
    { stage: "narrativa", title: "Primeiro corte" },
    { stage: "narrativa", title: "Revisão interna" },
    { stage: "narrativa", title: "Envio ao cliente (1ª rodada)" },
    { stage: "finalizacao", title: "Color grading" },
    { stage: "finalizacao", title: "Mixagem e trilha" },
    { stage: "finalizacao", title: "Legendas e letterings" },
    { stage: "finalizacao", title: "Versões de formato (16:9 e 9:16)" },
    { stage: "entrega", title: "Conferir arquivos finais" },
    { stage: "entrega", title: "Enviar a entrega" },
    { stage: "entrega", title: "Arquivar projeto e material bruto" },
    { stage: "entrega", title: "Pedir autorização para usar no portfólio" },
  ],
  "Conteúdo para redes": [
    { stage: "producao", title: "Backup do material bruto em 2 lugares" },
    { stage: "narrativa", title: "Edição dos vídeos" },
    { stage: "narrativa", title: "Envio ao cliente para aprovação" },
    { stage: "finalizacao", title: "Color, trilha e legendas" },
    { stage: "finalizacao", title: 'Cortes em 15, 20, 30 e 45"' },
    { stage: "entrega", title: "Entrega dos arquivos por vídeo" },
    { stage: "entrega", title: "Controle de diárias usadas e restantes" },
  ],
  "Experiência (evento)": [
    { stage: "producao", title: "Backup do material bruto em 2 lugares" },
    { stage: "narrativa", title: "Sameday / cortes de tempo real" },
    { stage: "narrativa", title: "Primeiro corte do aftermovie" },
    { stage: "finalizacao", title: "Color, trilha e mixagem" },
    { stage: "entrega", title: "Entrega do aftermovie e do material bruto" },
  ],
  Documental: [
    { stage: "producao", title: "Backup do material bruto em 2 lugares" },
    { stage: "narrativa", title: "Decupagem das entrevistas" },
    { stage: "narrativa", title: "Montagem" },
    { stage: "finalizacao", title: "Color, som e trilha" },
    { stage: "finalizacao", title: "Legendas" },
    { stage: "entrega", title: "Entrega e versões de divulgação" },
  ],
};
const ETAPAS_POS = new Set(["narrativa", "finalizacao", "entrega"]);
const daPos = (t: { stage: string; title: string }) =>
  ETAPAS_POS.has(t.stage) || (t.stage === "producao" && t.title === "Backup do material bruto em 2 lugares");

export async function upgradePostProduction(db: DB) {
  const marker = "processos-pos:v1";
  if (await db.query.settings.findFirst({ where: eq(s.settings.key, marker) })) return;
  const templates = await db.select().from(s.projectTemplates);
  for (const novo of DEFAULT_TEMPLATES) {
    const antiga = POS_ANTIGA[novo.name];
    const atual = templates.find((t) => t.name === novo.name);
    if (!atual) {
      // modelo novo de fábrica (ex.: Pós-produção da Absolute ZRO)
      if (!antiga) await db.insert(s.projectTemplates).values({ ...novo, tasks: [...novo.tasks] });
      continue;
    }
    if (!antiga) continue;
    const chave = (l: readonly { stage: string; title: string }[]) => l.map((t) => `${t.stage}::${t.title}`).join("|");
    const posAtual = atual.tasks.filter(daPos);
    const posNova = novo.tasks.filter((t) => ETAPAS_POS.has(t.stage));
    if (chave(posAtual) === chave(posNova)) continue; // já está na versão nova
    if (chave(posAtual) !== chave(antiga)) {
      console.log(`· Modelo "${atual.name}": pós-produção editada à mão, fica como está.`);
      continue;
    }
    const tasks = [...atual.tasks.filter((t) => !daPos(t)), ...posNova];
    await db.update(s.projectTemplates).set({ tasks }).where(eq(s.projectTemplates.id, atual.id));
    console.log(`✓ Modelo "${atual.name}": pós-produção completa (${posAtual.length} → ${posNova.length} tarefas).`);
  }
  await db.insert(s.settings).values({ key: marker, value: new Date().toISOString() }).onConflictDoNothing();
}

export async function ensureKits(db: DB) {
  if (!(await isEmpty(db, s.equipmentKits))) return;
  await db.insert(s.equipmentKits).values(DEFAULT_KITS.map((k) => ({ ...k, items: [...k.items] })));
}

export async function ensureFaqs(db: DB) {
  if (!(await isEmpty(db, s.faqs))) return;
  await db.insert(s.faqs).values(DEFAULT_FAQS.map((f, i) => ({ ...f, sortOrder: i })));
}

export async function ensureTeam(db: DB) {
  if (!(await isEmpty(db, s.teamMembers))) return;
  await db.insert(s.teamMembers).values([
    { name: "Victor Barroso", role: "Sócio · Direção criativa", sortOrder: 0 },
    { name: "Edu Cardoso", role: "Sócio · Produção executiva e financeiro", sortOrder: 1 },
  ]);
}

/** Filmes do canal da ZRO no YouTube (youtube.com/@ZROFilmes). */
const CHANNEL_FILMS = [
  {
    id: "film-yt-uZWsnlQlAes",
    slug: "agae-45-anos",
    title: "AGAÉ · 45 anos",
    client: "AGAÉ",
    category: "filme-de-marca",
    year: 2026,
    duration: "1:43",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=uZWsnlQlAes",
    posterUrl: "https://i.ytimg.com/vi/uZWsnlQlAes/maxresdefault.jpg",
    featured: true,
    sortOrder: 1,
  },
  {
    id: "film-yt-Z1SVYvwo_2Y",
    slug: "agae-tudo-para-a-sua-obra",
    title: "Tudo para a sua obra",
    client: "AGAÉ",
    category: "campanha",
    year: 2026,
    duration: "0:31",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=Z1SVYvwo_2Y",
    posterUrl: "https://i.ytimg.com/vi/Z1SVYvwo_2Y/maxresdefault.jpg",
    featured: false,
    sortOrder: 2,
  },
  {
    id: "film-yt-oLqDLrwoSX4",
    slug: "agae-locacao-a-obra-nao-pode-parar",
    title: "A obra não pode parar",
    client: "AGAÉ Locação",
    category: "campanha",
    year: 2026,
    duration: "0:41",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=oLqDLrwoSX4",
    posterUrl: "https://i.ytimg.com/vi/oLqDLrwoSX4/maxresdefault.jpg",
    featured: false,
    sortOrder: 3,
  },
  {
    id: "film-yt-vphkqS7PLO8",
    slug: "philipeia-brasilidades",
    title: "Brasilidades",
    client: "Philipeia",
    category: "campanha",
    year: 2026,
    duration: "1:05",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=vphkqS7PLO8",
    posterUrl: "https://i.ytimg.com/vi/vphkqS7PLO8/maxresdefault.jpg",
    featured: false,
    sortOrder: 4,
  },
  {
    id: "film-yt-4iNsqpw9jmo",
    slug: "copa-philipeia",
    title: "Copa Philipeia",
    client: "Philipeia",
    category: "experiencia",
    year: 2026,
    duration: "0:46",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=4iNsqpw9jmo",
    posterUrl: "https://i.ytimg.com/vi/4iNsqpw9jmo/maxresdefault.jpg",
    featured: false,
    sortOrder: 5,
  },
  {
    id: "film-yt-PR-NWCrNTw0",
    slug: "copa-philipeia-apresentadora",
    title: "Apresentadora · Copa Philipeia",
    client: "Philipeia",
    category: "conteudo",
    year: 2026,
    duration: "0:47",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=PR-NWCrNTw0",
    posterUrl: "https://i.ytimg.com/vi/PR-NWCrNTw0/maxresdefault.jpg",
    featured: false,
    sortOrder: 6,
  },
  {
    id: "film-yt-Nf67wOAdaUQ",
    slug: "philipeia-making-of",
    title: "Making of",
    client: "Philipeia",
    category: "documental",
    year: 2026,
    duration: "0:33",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=Nf67wOAdaUQ",
    posterUrl: "https://i.ytimg.com/vi/Nf67wOAdaUQ/maxresdefault.jpg",
    featured: false,
    sortOrder: 7,
  },
  {
    id: "film-yt-7j4vOeXhFck",
    slug: "ocupacao-literaria-2026",
    title: "Ocupação Literária · Edição 2026",
    client: "Ocupação Literária",
    category: "experiencia",
    year: 2026,
    duration: "3:29",
    format: "16:9",
    videoUrl: "https://www.youtube.com/watch?v=7j4vOeXhFck",
    posterUrl: "https://i.ytimg.com/vi/7j4vOeXhFck/maxresdefault.jpg",
    featured: false,
    sortOrder: 8,
  },
  {
    id: "film-yt-q5r_XmehbhI",
    slug: "easyrev-crescer-70",
    title: "Crescer 70% o seu faturamento",
    client: "EasyRev",
    category: "conteudo",
    year: 2026,
    duration: null,
    format: "9:16",
    videoUrl: "https://www.youtube.com/shorts/q5r_XmehbhI",
    posterUrl: "https://i.ytimg.com/vi/q5r_XmehbhI/oar2.jpg",
    featured: false,
    sortOrder: 9,
  },
  {
    id: "film-yt-xkvcmehxOoo",
    slug: "easyrev-duas-barreiras",
    title: "2 barreiras que travam o seu faturamento",
    client: "EasyRev",
    category: "conteudo",
    year: 2026,
    duration: null,
    format: "9:16",
    videoUrl: "https://www.youtube.com/shorts/xkvcmehxOoo",
    posterUrl: "https://i.ytimg.com/vi/xkvcmehxOoo/oar2.jpg",
    featured: false,
    sortOrder: 10,
  },
];

/** Clientes que aparecem no site (autorizados pelo Victor). */
const SHOWCASE_CLIENTS = ["SERHS", "SESI", "FIEPB", "SUDECO", "Quartzo", "AGAÉ", "Philipeia", "EasyRev", "Ocupação Literária"];

export async function ensureFilms(db: DB) {
  await db.insert(s.films).values(CHANNEL_FILMS).onConflictDoNothing();
}

export async function ensureShowcaseClients(db: DB) {
  if (!(await isEmpty(db, s.showcaseClients))) return;
  await db.insert(s.showcaseClients).values(SHOWCASE_CLIENTS.map((name, i) => ({ name, sortOrder: i })));
}

/**
 * Banco de equipamentos: os modelos comuns entram uma vez (marcado em settings,
 * para não voltar o que alguém apagou). Depois, o texto antigo de equipamento
 * de cada freela vira itens do banco, um por linha, vírgula ou marcador.
 */
export async function ensureEquipment(db: DB) {
  // Cada leva entra uma vez só: o que alguém apagou depois não volta.
  for (const [marker, list] of [
    ["equipamentos-base:v1", DEFAULT_EQUIPMENT],
    ["equipamentos-base:v2", DEFAULT_EQUIPMENT_MORE],
  ] as const) {
    const seeded = await db.query.settings.findFirst({ where: eq(s.settings.key, marker) });
    if (seeded) continue;
    const rows = Object.entries(list).flatMap(([category, names]) => names.map((name: string) => ({ name, category })));
    await db.insert(s.equipment).values(rows).onConflictDoNothing();
    await db.insert(s.settings).values({ key: marker, value: new Date().toISOString() }).onConflictDoNothing();
  }
  await convertEquipmentText(db);
  await mergeDuplicateEquipment(db);
}

/**
 * Junta o mesmo modelo escrito de jeitos diferentes ("Sony A7IV" e "Sony A7 IV"):
 * fica o nome do banco padrão (ou o mais antigo), e os freelas passam para ele.
 */
async function mergeDuplicateEquipment(db: DB) {
  const standard = new Set(
    [...Object.values(DEFAULT_EQUIPMENT), ...Object.values(DEFAULT_EQUIPMENT_MORE)].flat().map((n) => equipmentKey(n) + "|" + n),
  );
  const all = await db.select().from(s.equipment).orderBy(s.equipment.createdAt);
  const groups = new Map<string, (typeof all)[number][]>();
  for (const e of all) groups.set(equipmentKey(e.name), [...(groups.get(equipmentKey(e.name)) ?? []), e]);
  for (const [key, items] of groups) {
    if (items.length < 2) continue;
    const keep = items.find((e) => standard.has(key + "|" + e.name)) ?? items[0];
    for (const dup of items.filter((e) => e.id !== keep.id)) {
      await db.transaction(async (t) => {
        const owners = await t
          .select({ freelancerId: s.freelancerEquipment.freelancerId })
          .from(s.freelancerEquipment)
          .where(eq(s.freelancerEquipment.equipmentId, dup.id));
        if (owners.length) {
          await t
            .insert(s.freelancerEquipment)
            .values(owners.map((o) => ({ freelancerId: o.freelancerId, equipmentId: keep.id })))
            .onConflictDoNothing();
        }
        await t.delete(s.equipment).where(eq(s.equipment.id, dup.id));
      });
      console.log(`✓ Equipamento repetido "${dup.name}" juntado em "${keep.name}".`);
    }
  }
}

/** "Câmera Sony FX30" → "Sony FX30": tira a palavra da categoria quando o resto já é o modelo. */
function modelName(piece: string) {
  const name = cleanEquipmentName(piece);
  if (!name) return null;
  const m = name.match(/^(c[âa]mera|lente|gimbal|drone|monitor)\s+(.+)$/i);
  return m && /^[A-Z0-9]/.test(m[2]) && /\d/.test(m[2]) ? m[2] : name;
}

async function convertEquipmentText(db: DB) {
  const pending = await db
    .select({ id: s.freelancers.id, equipment: s.freelancers.equipment })
    .from(s.freelancers)
    .where(sql`coalesce(trim(${s.freelancers.equipment}), '') <> ''`);
  for (const f of pending) {
    const names = [
      ...new Set(
        (f.equipment ?? "")
          .split(/[\n•;,]+/)
          .map(modelName)
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    await db.transaction(async (t) => {
      for (const name of names) {
        let item = await t.query.equipment.findFirst({ where: sql`lower(${s.equipment.name}) = lower(${name})` });
        if (!item) [item] = await t.insert(s.equipment).values({ name, category: guessEquipmentCategory(name) }).returning();
        await t.insert(s.freelancerEquipment).values({ freelancerId: f.id, equipmentId: item.id }).onConflictDoNothing();
      }
      await t.update(s.freelancers).set({ equipment: null }).where(eq(s.freelancers.id, f.id));
    });
    console.log(`✓ Equipamento de um freela passou para o banco de equipamentos (${names.length} itens).`);
  }
}

/**
 * CPF que ficou escrito nas observações ("CPF: 000.000.000-00") passa para o
 * campo CPF do freela, e a linha sai das observações. Só quando o campo está vazio.
 */
export async function moveFreelaCpfFromNotes(db: DB) {
  const rows = await db
    .select({ id: s.freelancers.id, notes: s.freelancers.notes })
    .from(s.freelancers)
    .where(sql`${s.freelancers.document} is null and ${s.freelancers.notes} ~* 'cpf'`);
  for (const f of rows) {
    const line = /^[ \t]*cpf[ \t]*:?[ \t]*([\d.\-\/ ]{11,20})[ \t]*$/im.exec(f.notes ?? "");
    const digits = line?.[1].replace(/\D/g, "");
    if (!line || !digits || (digits.length !== 11 && digits.length !== 14)) continue;
    const notes = (f.notes ?? "").replace(line[0], "").replace(/\n{3,}/g, "\n\n").trim() || null;
    await db.update(s.freelancers).set({ document: digits, notes }).where(eq(s.freelancers.id, f.id));
    console.log("✓ CPF de um freela saiu das observações e foi para o campo CPF.");
  }
}

/** WhatsApp de freelas, leads e clientes no formato padrão: (84) 99919-7374. Número fora do padrão fica como está. */
export async function formatPhones(db: DB) {
  for (const table of [s.freelancers, s.leads, s.clients]) {
    const rows = await db.select({ id: table.id, phone: table.phone }).from(table).where(sql`${table.phone} is not null`);
    for (const r of rows) {
      const formatted = formatPhone(r.phone);
      if (formatted && formatted !== r.phone) await db.update(table).set({ phone: formatted }).where(eq(table.id, r.id));
    }
  }
}

export async function ensureBaseData(db: DB, opts: { allowGeneratedPasswords: boolean }) {
  await ensureUsers(db, { allowGenerated: opts.allowGeneratedPasswords });
  await ensureSettings(db);
  await ensureCatalog(db);
  await ensureTemplates(db);
  await upgradePostProduction(db);
  await ensureKits(db);
  await ensureFaqs(db);
  await ensureTeam(db);
  await ensureFilms(db);
  await ensureShowcaseClients(db);
  await ensureEquipment(db);
  await moveFreelaCpfFromNotes(db);
  await formatPhones(db);
  await ensureDatabaseIdentity(db);
}
