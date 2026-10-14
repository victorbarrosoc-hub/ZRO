/**
 * Banco da ZRO (Postgres no Neon; PGlite no computador, via Drizzle).
 * Dinheiro sempre em centavos (inteiro, bigint para não estourar). Datas de calendário em texto "AAAA-MM-DD".
 */
import { relations, sql } from "drizzle-orm";
import { bigint, boolean, doublePrecision, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { CreativeRuleAnswers } from "@/lib/domain";

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
