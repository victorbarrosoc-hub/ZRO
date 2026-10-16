/**
 * Banco da ZRO (Postgres no Neon; PGlite no computador, via Drizzle).
 * Dinheiro sempre em centavos (inteiro, bigint para não estourar). Datas de calendário em texto "AAAA-MM-DD".
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CreativeRuleAnswers } from "@/lib/domain";
import type { DiagnosticoRegistro } from "@/lib/drive/protocolo";

const id = () => text().primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/* ============================== Acesso ============================== */

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: text().notNull().default("socio"),
  /** Foto do perfil (aparece no menu e nos cards da Pauta). */
  photoId: text().references(() => images.id, { onDelete: "set null" }),
  lastLoginAt: timestamp({ mode: "date", withTimezone: true }),
  createdAt: createdAt(),
});

/** Tentativas de login, para frear força bruta. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    email: text().notNull(),
    ip: text(),
    success: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_email_idx").on(t.email, t.createdAt)],
);

/** Configurações em chave/valor (dados da empresa, WhatsApp, alíquota...). */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

/* ============================== Site ============================== */

export const films = pgTable(
  "films",
  {
    id: id(),
    slug: text().notNull(),
    title: text().notNull(),
    client: text(),
    category: text().notNull(),
    year: bigint({ mode: "number" }),
    duration: text(),
    format: text().notNull().default("16:9"),
    videoUrl: text(),
    posterUrl: text(),
    previewUrl: text(),
    summary: text(),
    intention: text(),
    credits: jsonb().$type<{ role: string; name: string }[]>(),
    stills: jsonb().$type<string[]>(),
    featured: boolean().notNull().default(false),
    published: boolean().notNull().default(true),
    sortOrder: bigint({ mode: "number" }).notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("films_slug_idx").on(t.slug)],
);

export const teamMembers = pgTable("team_members", {
  id: id(),
  name: text().notNull(),
  role: text().notNull(),
  quote: text(),
  photoUrl: text(),
  instagram: text(),
  sortOrder: bigint({ mode: "number" }).notNull().default(0),
  published: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const showcaseClients = pgTable("showcase_clients", {
  id: id(),
  name: text().notNull(),
  logoUrl: text(),
  sortOrder: bigint({ mode: "number" }).notNull().default(0),
  published: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const faqs = pgTable("faqs", {
  id: id(),
  question: text().notNull(),
  answer: text().notNull(),
  sortOrder: bigint({ mode: "number" }).notNull().default(0),
  published: boolean().notNull().default(true),
  createdAt: createdAt(),
});

/* ============================== Imagens ============================== */

/**
 * Foto de freela e logo de cliente. Chegam já reduzidas pelo navegador e ficam
 * aqui em base64 (assim entram no backup). Só abrem para quem está logado.
 */
export const images = pgTable("images", {
  id: id(),
  mime: text().notNull(),
  data: text().notNull(),
  width: bigint({ mode: "number" }).notNull(),
  height: bigint({ mode: "number" }).notNull(),
  bytes: bigint({ mode: "number" }).notNull(),
  createdAt: createdAt(),
});

/* ============================== CRM ============================== */

/**
 * Projeto recorrente do cliente: o que se faz todo mês.
 * days = diárias de captação por mês; value = valor fixo por mês (centavos);
 * deliverables = entregas de todo mês; payDay = dia do pagamento; startMonth = "AAAA-MM".
 * autoFinance / autoPauta = gerar sozinho a cobrança e os cards do mês (vazio = sim).
 */
export type ClientRecurring = {
  days: number;
  value: number;
  deliverables: { title: string; qty: number }[];
  payDay?: number | null;
  startMonth?: string | null;
  autoFinance?: boolean;
  autoPauta?: boolean;
};

export const clients = pgTable(
  "clients",
  {
    id: id(),
    name: text().notNull(),
    segment: text(),
    city: text(),
    document: text(),
    contactName: text(),
    email: text(),
    phone: text(),
    instagram: text(),
    source: text().notNull().default("outro"),
    notes: text(),
    logoId: text().references(() => images.id, { onDelete: "set null" }),
    /** Projeto recorrente (contrato mensal). Vazio = cliente sem contrato fixo. */
    recurring: jsonb().$type<ClientRecurring>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    name: text().notNull(),
    company: text(),
    segment: text(),
    email: text(),
    phone: text(),
    projectType: text(),
    idea: text(),
    timing: text(),
    city: text(),
    days: text(),
    videos: text(),
    format: text(),
    extras: jsonb().$type<string[]>(),
    budget: text(),
    stage: text().notNull().default("novo"),
    lostReason: text(),
    source: text().notNull().default("site"),
    estimatedValue: bigint({ mode: "number" }),
    followUpAt: text(),
    notes: text(),
    consentAt: timestamp({ mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("leads_stage_idx").on(t.stage), index("leads_created_idx").on(t.createdAt)],
);

/** Histórico de interações (lead, cliente ou projeto). */
export const activities = pgTable(
  "activities",
  {
    id: id(),
    leadId: text().references(() => leads.id, { onDelete: "cascade" }),
    clientId: text().references(() => clients.id, { onDelete: "cascade" }),
    projectId: text().references(() => projects.id, { onDelete: "cascade" }),
    type: text().notNull().default("nota"),
    content: text().notNull(),
    authorId: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("activities_lead_idx").on(t.leadId), index("activities_project_idx").on(t.projectId)],
);

/* ============================== Freelas ============================== */

export const freelancers = pgTable(
  "freelancers",
  {
    id: id(),
    name: text().notNull(),
    city: text(),
    phone: text(),
    email: text(),
    instagram: text(),
    /** CPF (ou CNPJ, se for MEI), só os dígitos. */
    document: text(),
    /** Mensagem que abre a conversa no WhatsApp ({nome} vira o primeiro nome). Vazia: a padrão. */
    whatsappMessage: text(),
    pixKey: text(),
    functions: jsonb().$type<string[]>().notNull().default([]),
    equipment: text(),
    notes: text(),
    active: boolean().notNull().default(true),
    photoId: text().references(() => images.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("freelancers_name_idx").on(t.name)],
);

/** Valor padrão de um freela por função (e, opcionalmente, por tipo de job). */
export const freelancerRates = pgTable(
  "freelancer_rates",
  {
    id: id(),
    freelancerId: text()
      .notNull()
      .references(() => freelancers.id, { onDelete: "cascade" }),
    function: text().notNull(),
    category: text(),
    amount: bigint({ mode: "number" }).notNull(),
    unit: text().notNull().default("diaria"),
  },
  (t) => [index("freelancer_rates_freelancer_idx").on(t.freelancerId)],
);

/** Banco de equipamentos: cada modelo uma vez só (o nome não repete, sem diferenciar maiúscula). */
export const equipment = pgTable(
  "equipment",
  {
    id: id(),
    name: text().notNull(),
    /** Chave de EQUIPMENT_CATEGORIES (camera, lente, audio...). */
    category: text().notNull().default("outro"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("equipment_name_idx").on(sql`lower(${t.name})`), index("equipment_category_idx").on(t.category)],
);

/** Equipamento próprio de cada freela. */
export const freelancerEquipment = pgTable(
  "freelancer_equipment",
  {
    id: id(),
    freelancerId: text()
      .notNull()
      .references(() => freelancers.id, { onDelete: "cascade" }),
    equipmentId: text()
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("freelancer_equipment_unique_idx").on(t.freelancerId, t.equipmentId),
    index("freelancer_equipment_equipment_idx").on(t.equipmentId),
  ],
);

/* ============================== Quadro (kanban de conteúdo) ==============================
 * O método é o da Maestro (docs/quadro). Tudo do card mora em "dados", um campo por chave:
 * grava-se por campo, apagar é lápide (apagadoEm) e toda gravação vai para o histórico.
 */

export const quadroCards = pgTable(
  "quadro_cards",
  {
    org: text().notNull(),
    id: text().notNull(),
    dados: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    versao: integer().notNull().default(1),
    /** campo → versão em que mudou por último */
    versoes: jsonb().$type<Record<string, number>>().notNull().default({}),
    criadoEm: timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.org, t.id] }), index("quadro_cards_atualizado_idx").on(t.org, t.atualizadoEm)],
);

/** Cada gravação: quem, quando e cada campo [antes, depois]. Explica qualquer sumiço. */
export const quadroHistorico = pgTable(
  "quadro_historico",
  {
    n: bigserial({ mode: "number" }).primaryKey(),
    org: text().notNull(),
    cardId: text().notNull(),
    quando: timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
    quem: text(),
    operacao: text().notNull(),
    campos: jsonb().$type<Record<string, [unknown, unknown]>>().notNull().default({}),
  },
  (t) => [index("quadro_historico_card_idx").on(t.org, t.cardId, t.quando)],
);

/* ============================== Projetos ============================== */

export const projects = pgTable(
  "projects",
  {
    id: id(),
    code: text().notNull(),
    title: text().notNull(),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    leadId: text().references(() => leads.id, { onDelete: "set null" }),
    quoteId: text(),
    category: text().notNull().default("filme-de-marca"),
    stage: text().notNull().default("origem"),
    status: text().notNull().default("ativo"),
    startDate: text(),
    dueDate: text(),
    value: bigint({ mode: "number" }).notNull().default(0),
    briefing: text(),
    creativeRule: jsonb().$type<CreativeRuleAnswers>(),
    driveUrl: text(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("projects_code_idx").on(t.code), index("projects_stage_idx").on(t.stage)],
);

export const projectDeliverables = pgTable(
  "project_deliverables",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text().notNull(),
    format: text(),
    duration: text(),
    quantity: bigint({ mode: "number" }).notNull().default(1),
    dueDate: text(),
    status: text().notNull().default("pendente"),
    revision: bigint({ mode: "number" }).notNull().default(0),
    link: text(),
    sortOrder: bigint({ mode: "number" }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("deliverables_project_idx").on(t.projectId)],
);

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stage: text().notNull(),
    title: text().notNull(),
    done: boolean().notNull().default(false),
    sortOrder: bigint({ mode: "number" }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_project_idx").on(t.projectId)],
);

/** Equipe do projeto: quem trabalha, em qual função, por quanto. */
export const projectCrew = pgTable(
  "project_crew",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    freelancerId: text().references(() => freelancers.id, { onDelete: "set null" }),
    name: text(),
    function: text().notNull(),
    work: text(),
    startDate: text(),
    dueDate: text(),
    deliveredAt: text(),
    amount: bigint({ mode: "number" }).notNull().default(0),
    /** Valor por diária. Com ele, o valor total é a diária × os dias em que a pessoa está escalada na agenda do projeto. */
    dailyRate: bigint({ mode: "number" }),
    /** "manual" (montado na aba Equipe) ou "agenda" (entrou ao ser escalado numa diária). */
    source: text().notNull().default("manual"),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [index("crew_project_idx").on(t.projectId), index("crew_freelancer_idx").on(t.freelancerId)],
);

/* ============================== Agenda ============================== */

export const events = pgTable(
  "events",
  {
    id: id(),
    projectId: text().references(() => projects.id, { onDelete: "cascade" }),
    type: text().notNull().default("diaria"),
    title: text().notNull(),
    date: text().notNull(),
    endDate: text(),
    startTime: text(),
    endTime: text(),
    location: text(),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [index("events_date_idx").on(t.date)],
);

/** Quem está escalado em cada diária (para avisar conflito de agenda). */
export const eventCrew = pgTable(
  "event_crew",
  {
    id: id(),
    eventId: text()
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    freelancerId: text()
      .notNull()
      .references(() => freelancers.id, { onDelete: "cascade" }),
    function: text(),
  },
  (t) => [
    index("event_crew_event_idx").on(t.eventId),
    uniqueIndex("event_crew_unique_idx").on(t.eventId, t.freelancerId),
  ],
);

/* ============================== Orçamentos ============================== */

export const catalogItems = pgTable("catalog_items", {
  id: id(),
  name: text().notNull(),
  description: text(),
  group: text().notNull().default("extra"),
  unit: text().notNull().default("unidade"),
  price: bigint({ mode: "number" }).notNull().default(0),
  cost: bigint({ mode: "number" }).notNull().default(0),
  active: boolean().notNull().default(true),
  sortOrder: bigint({ mode: "number" }).notNull().default(0),
  createdAt: createdAt(),
});

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    number: text().notNull(),
    version: bigint({ mode: "number" }).notNull().default(1),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    leadId: text().references(() => leads.id, { onDelete: "set null" }),
    projectId: text(),
    title: text().notNull(),
    category: text(),
    status: text().notNull().default("rascunho"),
    issueDate: text().notNull(),
    validUntil: text(),
    period: text(),
    scope: text(),
    paymentTerms: text(),
    conditions: text(),
    discount: bigint({ mode: "number" }).notNull().default(0),
    taxRate: doublePrecision().notNull().default(0),
    internalNotes: text(),
    sentAt: timestamp({ mode: "date", withTimezone: true }),
    decidedAt: timestamp({ mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("quotes_number_version_idx").on(t.number, t.version)],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: id(),
    quoteId: text()
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    catalogItemId: text().references(() => catalogItems.id, { onDelete: "set null" }),
    description: text().notNull(),
    detail: text(),
    quantity: doublePrecision().notNull().default(1),
    unit: text(),
    unitPrice: bigint({ mode: "number" }).notNull().default(0),
    unitCost: bigint({ mode: "number" }).notNull().default(0),
    sortOrder: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId)],
);

/* ============================== Financeiro ============================== */

export const financeEntries = pgTable(
  "finance_entries",
  {
    id: id(),
    kind: text().notNull(),
    category: text().notNull(),
    description: text().notNull(),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    freelancerId: text().references(() => freelancers.id, { onDelete: "set null" }),
    crewId: text().references(() => projectCrew.id, { onDelete: "set null" }),
    /** Custo de uma diária específica (alimentação, deslocamento, locação...). */
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    quoteId: text(),
    amount: bigint({ mode: "number" }).notNull(),
    paidAmount: bigint({ mode: "number" }).notNull().default(0),
    dueDate: text().notNull(),
    paidAt: text(),
    competence: text(),
    installment: text(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("finance_due_idx").on(t.dueDate),
    index("finance_project_idx").on(t.projectId),
    index("finance_kind_idx").on(t.kind),
  ],
);

/** Baixas (inclusive parciais) de um lançamento. */
export const financePayments = pgTable(
  "finance_payments",
  {
    id: id(),
    entryId: text()
      .notNull()
      .references(() => financeEntries.id, { onDelete: "cascade" }),
    amount: bigint({ mode: "number" }).notNull(),
    date: text().notNull(),
    method: text(),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [index("finance_payments_entry_idx").on(t.entryId)],
);

/**
 * O que o contrato recorrente já gerou em cada mês (cobrança e cards da Pauta).
 * Uma linha por cliente e mês: é a trava que impede gerar duas vezes.
 */
export const recurringRuns = pgTable(
  "recurring_runs",
  {
    clientId: text()
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** "AAAA-MM" */
    month: text().notNull(),
    financeAt: timestamp({ mode: "date", withTimezone: true }),
    financeEntryId: text().references(() => financeEntries.id, { onDelete: "set null" }),
    pautaAt: timestamp({ mode: "date", withTimezone: true }),
    cards: integer().notNull().default(0),
    createdAt: timestamp({ mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.month] })],
);

/* ============================== Processos ============================== */

/** Modelo de projeto: tarefas padrão por etapa. */
export const projectTemplates = pgTable("project_templates", {
  id: id(),
  name: text().notNull(),
  category: text(),
  description: text(),
  tasks: jsonb().$type<{ stage: string; title: string }[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const equipmentKits = pgTable("equipment_kits", {
  id: id(),
  name: text().notNull(),
  description: text(),
  items: jsonb().$type<{ name: string; qty: number }[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Checklist de equipamento de um projeto, com saída e retorno. */
export const projectChecklists = pgTable(
  "project_checklists",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text().notNull(),
    date: text(),
    items: jsonb()
      .$type<{ name: string; qty: number; out: boolean; back: boolean }[]>()
      .notNull()
      .default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("checklists_project_idx").on(t.projectId)],
);

/** Ordem do dia. */
export const callSheets = pgTable(
  "call_sheets",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    title: text().notNull(),
    date: text().notNull(),
    callTime: text(),
    location: text(),
    locationUrl: text(),
    schedule: jsonb()
      .$type<{ time: string; activity: string; notes?: string }[]>()
      .notNull()
      .default([]),
    crew: jsonb()
      .$type<{ name: string; role: string; phone?: string; call?: string }[]>()
      .notNull()
      .default([]),
    contacts: jsonb().$type<{ name: string; role: string; phone?: string }[]>().notNull().default([]),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("call_sheets_project_idx").on(t.projectId)],
);

/** Roteiros, decupagens e shot lists. */
export const scripts = pgTable(
  "scripts",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text().notNull().default("roteiro"),
    title: text().notNull(),
    content: text(),
    shots: jsonb()
      .$type<{ scene: string; shot: string; description: string; lens?: string; movement?: string; done?: boolean }[]>()
      .notNull()
      .default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("scripts_project_idx").on(t.projectId)],
);

/* ============================== Google Drive ==============================
 * Plano: docs/dev/drive.md. Os bytes ficam no Drive; aqui ficam ids, travas e o registro do que chegou.
 * Tudo que aponta para projeto, cliente, diária, freela ou usuário é ON DELETE SET NULL, com cópia do
 * rótulo: apagar no painel nunca apaga o registro do que chegou.
 */
const quando = () => timestamp({ mode: "date", withTimezone: true });

/** Conexão da ZRO com o Google (uma linha, id "zro"). */
export const driveConexao = pgTable("drive_conexao", {
  id: text().primaryKey(), // sempre "zro"
  conta: text(), // e-mail do about.get (nunca fixo no código)
  contaNome: text(),
  escopo: text(),
  /** AES-256-GCM; null = desconectado. FORA do backup. */
  refreshTokenEnc: text(),
  /** Sobe a cada troca de conta. */
  geracao: integer().notNull().default(1),
  raizNome: text().notNull().default("ZRO"),
  /** Pasta raiz no Drive conectado. */
  raizId: text(),
  /** <raiz>/Clientes */
  clientesId: text(),
  conectadoPorId: text().references(() => users.id, { onDelete: "set null" }),
  conectadoEm: quando(),
  desconectadoEm: quando(),
  /** "reconectar" | null */
  erro: text(),
  erroEm: quando(),
  /** Últimos 12 testes de envio direto (Ajustes → Google Drive). */
  diagnosticos: jsonb().$type<DiagnosticoRegistro[]>().notNull().default([]),
  atualizadoEm: updatedAt(),
});

/** Cache e trava das pastas criadas pelo app. Uma linha por (conta, pai, nome). */
export const drivePastas = pgTable(
  "drive_pastas",
  {
    id: id(),
    conta: text().notNull(),
    paiId: text().notNull(),
    /** Já limpo; casa exato. */
    nome: text().notNull(),
    /** null = alguém está criando (trava). */
    pastaId: text(),
    /** Nome lógico: "cliente:<id>", "cliente:<id>:empresa". */
    chave: text(),
    criandoDesde: quando(),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    uniqueIndex("drive_pastas_pai_nome_idx").on(t.conta, t.paiId, t.nome),
    uniqueIndex("drive_pastas_chave_idx").on(t.conta, t.chave),
    index("drive_pastas_pasta_idx").on(t.pastaId),
  ],
);

/** Estrutura de pastas de cada projeto (as 7 pastas e as subpastas). */
export const driveProjetos = pgTable(
  "drive_projetos",
  {
    id: id(),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    conta: text().notNull(),
    /** Cópia: "SERHS / 2026-03 · Verão Pipa". */
    rotulo: text().notNull(),
    /** "ZRO / Clientes / SERHS / 2026-03 · Verão Pipa" */
    caminho: text(),
    /** true = a pasta veio do driveUrl do projeto. */
    deLink: boolean().notNull().default(false),
    pastaId: text(),
    pastaUrl: text(),
    documentosId: text(), // 00 Documentos
    cenasId: text(), // 01 Cenas
    audiosId: text(), // 02 Áudios
    assetsId: text(), // 03 Assets
    projetoEdicaoId: text(), // 04 Projeto
    renderId: text(), // 05 Render
    entregasId: text(), // 06 Entregas (a ÚNICA que o cliente vê)
    /** "03 Assets/Do cliente": id… */
    subpastas: jsonb().$type<Record<string, string>>().notNull().default({}),
    /** criando | pronta | incompleta | erro */
    estado: text().notNull().default("criando"),
    erro: text(),
    /** Contador de rolos por letra: { "A": 3, "D": 1 }. */
    rolos: jsonb().$type<Record<string, number>>().notNull().default({}),
    entregasLiberadasEm: quando(),
    entregasLiberadasPorId: text().references(() => users.id, { onDelete: "set null" }),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    uniqueIndex("drive_projetos_projeto_idx").on(t.projectId, t.conta),
    index("drive_projetos_cliente_idx").on(t.clientId),
  ],
);

/** Diária com número congelado e as pastas dela em 01 Cenas e 02 Áudios. */
export const driveDiarias = pgTable(
  "drive_diarias",
  {
    id: id(),
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    driveProjetoId: text().references(() => driveProjetos.id, { onDelete: "set null" }),
    numero: integer().notNull(),
    /** AAAA-MM-DD (cópia, do dia em que nasceu). */
    data: text().notNull(),
    /** "2026-03-12 · Diária 02" */
    nome: text().notNull(),
    /** Criada no primeiro rolo de vídeo. */
    cenasPastaId: text(),
    /** Criada no primeiro envio de áudio. */
    audiosPastaId: text(),
    criadoEm: createdAt(),
  },
  (t) => [
    uniqueIndex("drive_diarias_evento_idx").on(t.eventId, t.driveProjetoId),
    uniqueIndex("drive_diarias_numero_idx").on(t.driveProjetoId, t.numero),
  ],
);

/** Links públicos: um por diária (freela) e um por cliente (área). Nunca apagados: desativar = revogadoEm. */
export const driveLinks = pgTable(
  "drive_links",
  {
    id: id(),
    /** "freela-diaria" | "cliente-area" */
    tipo: text().notNull(),
    /** sha256 hex do token (fica no backup). */
    tokenHash: text().notNull(),
    /** Token cifrado, para mostrar o link de novo. FORA do backup. */
    tokenEnc: text(),
    /** bcrypt, opcional. FORA do backup. */
    senhaHash: text(),
    /** Muda ao trocar/tirar a senha: derruba os cookies da área. */
    senhaVersao: integer().notNull().default(0),
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    diariaId: text().references(() => driveDiarias.id, { onDelete: "set null" }),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    /** Cópia: "Verão Pipa · Diária 02 · 12/03/2026" | "SERHS". */
    rotulo: text().notNull(),
    /** null = sem validade. */
    expiraEm: quando(),
    /** Freela: total do link; cliente: por dia. null = sem limite. */
    limiteBytes: bigint({ mode: "number" }),
    revogadoEm: quando(),
    revogadoPorId: text().references(() => users.id, { onDelete: "set null" }),
    criadoPorId: text().references(() => users.id, { onDelete: "set null" }),
    ultimoUsoEm: quando(),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    uniqueIndex("drive_links_token_idx").on(t.tokenHash),
    uniqueIndex("drive_links_diaria_ativa_idx")
      .on(t.eventId)
      .where(sql`${t.revogadoEm} is null and ${t.tipo} = 'freela-diaria'`),
    uniqueIndex("drive_links_area_ativa_idx")
      .on(t.clientId)
      .where(sql`${t.revogadoEm} is null and ${t.tipo} = 'cliente-area'`),
    index("drive_links_projeto_idx").on(t.projectId),
  ],
);

/** Um envio de cartão, pasta ou seleção. O rolo e a pasta de destino nascem aqui. */
export const driveLotes = pgTable(
  "drive_lotes",
  {
    id: id(),
    /** "painel" | "freela" | "cliente" */
    origem: text().notNull(),
    linkId: text().references(() => driveLinks.id, { onDelete: "set null" }),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    diariaId: text().references(() => driveDiarias.id, { onDelete: "set null" }),
    driveProjetoId: text().references(() => driveProjetos.id, { onDelete: "set null" }),
    freelancerId: text().references(() => freelancers.id, { onDelete: "set null" }),
    /** Cópia do cadastro ("Rafael Moura") ou digitado. */
    pessoaNome: text(),
    /** "cam-a"…"foto" | "gravador" | null */
    fonte: text(),
    /** "Zoom F6" */
    gravador: text(),
    /** "A003" | null */
    rolo: text(),
    /** "A003 · Câm A · Rafael Moura" | "Manual de marca" | "Brutos" */
    rotulo: text().notNull(),
    /** Cliente. */
    assunto: text(),
    /** Pasta escolhida ("EOS_DIGITAL"), só registro. */
    cartaoNome: text(),
    /** sha256 de "caminho/nome|tamanho" ordenados. */
    impressao: text(),
    /** Destino do lote. */
    pastaId: text().notNull(),
    /** Caminho legível até o destino. */
    caminho: text().notNull(),
    arquivosPrevistos: integer().notNull().default(0),
    bytesPrevistos: bigint({ mode: "number" }).notNull().default(0),
    arquivosRecebidos: integer().notNull().default(0),
    bytesRecebidos: bigint({ mode: "number" }).notNull().default(0),
    /** aberto | concluido | parcial | cancelado */
    estado: text().notNull().default("aberto"),
    /** Cliente (LGPD). */
    consentimentoEm: quando(),
    /** Histórico do CRM gravado (trava contra duplicar). */
    avisadoEm: quando(),
    /** O painel já mostrou (ponto de "novo"). */
    vistoEm: quando(),
    ultimoSinalEm: quando(),
    concluidoEm: quando(),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    index("drive_lotes_criado_idx").on(t.criadoEm),
    index("drive_lotes_projeto_idx").on(t.projectId, t.criadoEm),
    index("drive_lotes_link_idx").on(t.linkId, t.criadoEm),
    index("drive_lotes_cliente_idx").on(t.clientId, t.criadoEm),
  ],
);

/** Cada arquivo de um lote. Linha enxuta: o resto vem do lote. */
export const driveEnvios = pgTable(
  "drive_envios",
  {
    /** Vai em appProperties.zroEnvio no Drive. */
    id: id(),
    loteId: text().references(() => driveLotes.id, { onDelete: "set null" }),
    /** Pasta final (com as subpastas do cartão). */
    pastaId: text().notNull(),
    /** "DCIM/100CANON" dentro do lote. */
    caminhoRelativo: text().notNull().default(""),
    /** Nome gravado no Drive. */
    nome: text().notNull(),
    /** Só quando precisou trocar controle/bidi. */
    nomeOriginal: text(),
    /** MIME (octet-stream se suspeito). */
    tipo: text().notNull(),
    tamanho: bigint({ mode: "number" }).notNull(),
    /** lastModified (ms), desempate fora do WebKit. */
    modificado: bigint({ mode: "number" }),
    /** enviando | concluido | falhou | cancelado | expirado */
    estado: text().notNull().default("enviando"),
    /** URI cifrada; null ao concluir/cancelar/expirar. FORA do backup. */
    sessaoEnc: text(),
    /** Criação + 6 dias (o Google guarda 7). */
    sessaoExpiraEm: quando(),
    /** Só o host, para o diagnóstico. */
    sessaoHost: text(),
    /** Id no Drive: vem da sessão, nunca do navegador. */
    arquivoId: text(),
    md5: text(),
    erro: text(),
    ultimoSinalEm: quando(),
    concluidoEm: quando(),
    criadoEm: createdAt(),
  },
  (t) => [
    index("drive_envios_lote_idx").on(t.loteId, t.estado),
    index("drive_envios_pasta_nome_idx").on(t.pastaId, t.nome),
    index("drive_envios_ativos_idx").on(t.ultimoSinalEm).where(sql`${t.estado} = 'enviando'`),
  ],
);

/** Permissões que o app criou no Drive (para poder recolher). */
export const driveCompartilhamentos = pgTable(
  "drive_compartilhamentos",
  {
    id: id(),
    /** "entregas" | "equipe" */
    motivo: text().notNull(),
    /** Pasta ou arquivo no Drive (ex.: 06 Entregas). */
    arquivoId: text().notNull(),
    /** Devolvido por permissions.create; null = falhou. */
    permissaoId: text(),
    /** "anyone" | "user" */
    tipo: text().notNull(),
    /** "reader" | "writer" */
    papel: text().notNull(),
    email: text(),
    avisouPorEmail: boolean().notNull().default(false),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    driveProjetoId: text().references(() => driveProjetos.id, { onDelete: "set null" }),
    erro: text(),
    criadoPorId: text().references(() => users.id, { onDelete: "set null" }),
    criadoEm: createdAt(),
    revogadoEm: quando(),
    revogadoPorId: text().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("drive_compart_projeto_idx").on(t.projectId),
    index("drive_compart_arquivo_idx").on(t.arquivoId),
  ],
);

/* ============================== Relações ============================== */

export const clientsRelations = relations(clients, ({ many }) => ({
  leads: many(leads),
  projects: many(projects),
  quotes: many(quotes),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  client: one(clients, { fields: [leads.clientId], references: [clients.id] }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, { fields: [activities.leadId], references: [leads.id] }),
  client: one(clients, { fields: [activities.clientId], references: [clients.id] }),
  project: one(projects, { fields: [activities.projectId], references: [projects.id] }),
  author: one(users, { fields: [activities.authorId], references: [users.id] }),
}));

export const freelancersRelations = relations(freelancers, ({ many }) => ({
  rates: many(freelancerRates),
  crew: many(projectCrew),
  equipment: many(freelancerEquipment),
}));

export const equipmentRelations = relations(equipment, ({ many }) => ({
  owners: many(freelancerEquipment),
}));

export const freelancerEquipmentRelations = relations(freelancerEquipment, ({ one }) => ({
  freelancer: one(freelancers, { fields: [freelancerEquipment.freelancerId], references: [freelancers.id] }),
  equipment: one(equipment, { fields: [freelancerEquipment.equipmentId], references: [equipment.id] }),
}));

export const freelancerRatesRelations = relations(freelancerRates, ({ one }) => ({
  freelancer: one(freelancers, { fields: [freelancerRates.freelancerId], references: [freelancers.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [projects.leadId], references: [leads.id] }),
  deliverables: many(projectDeliverables),
  tasks: many(projectTasks),
  crew: many(projectCrew),
  events: many(events),
  entries: many(financeEntries),
  checklists: many(projectChecklists),
  callSheets: many(callSheets),
  scripts: many(scripts),
}));

export const projectDeliverablesRelations = relations(projectDeliverables, ({ one }) => ({
  project: one(projects, { fields: [projectDeliverables.projectId], references: [projects.id] }),
}));

export const projectTasksRelations = relations(projectTasks, ({ one }) => ({
  project: one(projects, { fields: [projectTasks.projectId], references: [projects.id] }),
}));

export const projectCrewRelations = relations(projectCrew, ({ one }) => ({
  project: one(projects, { fields: [projectCrew.projectId], references: [projects.id] }),
  freelancer: one(freelancers, { fields: [projectCrew.freelancerId], references: [freelancers.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  project: one(projects, { fields: [events.projectId], references: [projects.id] }),
  crew: many(eventCrew),
}));

export const eventCrewRelations = relations(eventCrew, ({ one }) => ({
  event: one(events, { fields: [eventCrew.eventId], references: [events.id] }),
  freelancer: one(freelancers, { fields: [eventCrew.freelancerId], references: [freelancers.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [quotes.leadId], references: [leads.id] }),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
  catalogItem: one(catalogItems, { fields: [quoteItems.catalogItemId], references: [catalogItems.id] }),
}));

export const financeEntriesRelations = relations(financeEntries, ({ one, many }) => ({
  project: one(projects, { fields: [financeEntries.projectId], references: [projects.id] }),
  client: one(clients, { fields: [financeEntries.clientId], references: [clients.id] }),
  freelancer: one(freelancers, { fields: [financeEntries.freelancerId], references: [freelancers.id] }),
  crew: one(projectCrew, { fields: [financeEntries.crewId], references: [projectCrew.id] }),
  event: one(events, { fields: [financeEntries.eventId], references: [events.id] }),
  payments: many(financePayments),
}));

export const financePaymentsRelations = relations(financePayments, ({ one }) => ({
  entry: one(financeEntries, { fields: [financePayments.entryId], references: [financeEntries.id] }),
}));

export const projectChecklistsRelations = relations(projectChecklists, ({ one }) => ({
  project: one(projects, { fields: [projectChecklists.projectId], references: [projects.id] }),
}));

export const callSheetsRelations = relations(callSheets, ({ one }) => ({
  project: one(projects, { fields: [callSheets.projectId], references: [projects.id] }),
  event: one(events, { fields: [callSheets.eventId], references: [events.id] }),
}));

export const scriptsRelations = relations(scripts, ({ one }) => ({
  project: one(projects, { fields: [scripts.projectId], references: [projects.id] }),
}));
