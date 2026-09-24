/**
 * Dados base + dados de exemplo para a área interna não abrir vazia.
 * Tudo que é exemplo tem id começando com "demo-" e pode ser apagado
 * em Ajustes → "Apagar dados de exemplo".
 *
 * Uso: npm run db:seed
 */
import { mkdirSync } from "node:fs";

if ((process.env.DATABASE_URL ?? "file:./data/zro.db").startsWith("file:")) {
  mkdirSync("./data", { recursive: true });
}

const { db } = await import("../src/lib/db/client");
const s = await import("../src/lib/db/schema");
const { ensureBaseData } = await import("./lib/base-data");
const { DEFAULT_TEMPLATES } = await import("../src/lib/db/defaults");

await ensureBaseData(db, { allowGeneratedPasswords: true });

/** Data relativa a hoje, em AAAA-MM-DD. */
function d(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
const R = (reais: number) => Math.round(reais * 100);

/* ---------- Filmes (reais; faltam os links dos vídeos) ---------- */
await db
  .insert(s.films)
  .values([
    {
      id: "film-manifesto",
      slug: "manifesto",
      title: "Manifesto",
      client: "ZRO",
      category: "filme-de-marca",
      year: 2026,
      duration: "0:34",
      format: "16:9",
      videoUrl: "/media/manifesto-zro.mp4",
      posterUrl: "/media/manifesto-capa.jpg",
      summary: "Tudo começa do zero.",
      intention:
        "O filme que apresenta a ZRO: do vazio à luz, do contraste à forma. Um universo surgindo do escuro até o ponto exato onde intenção vira direção.",
      featured: true,
      sortOrder: 0,
    },
    {
      id: "film-marenostrum",
      slug: "marenostrum-jantar",
      title: "Marenostrum · Jantar",
      client: "SERHS",
      category: "conteudo",
      year: 2026,
      format: "16:9",
      summary: "O jantar como experiência no SERHS Grand Hotel.",
      sortOrder: 1,
    },
    {
      id: "film-tapiro",
      slug: "tapiro-cafe-da-manha",
      title: "Tapiro · Café da manhã",
      client: "SERHS",
      category: "conteudo",
      year: 2026,
      format: "16:9",
      summary: "A primeira luz do dia à mesa.",
      sortOrder: 2,
    },
    {
      id: "film-sudeco",
      slug: "institucional-sudeco",
      title: "Institucional",
      client: "SUDECO",
      category: "filme-de-marca",
      year: 2026,
      format: "16:9",
      summary: "O desenvolvimento do Centro-Oeste contado por quem o constrói.",
      sortOrder: 3,
    },
    {
      id: "film-caravana",
      slug: "caravana",
      title: "Caravana",
      client: "SUDECO",
      category: "documental",
      year: 2026,
      format: "16:9",
      summary: "Uma viagem pelos territórios da caravana.",
      sortOrder: 4,
    },
    {
      id: "film-nordeste-criativo",
      slug: "nordeste-criativo",
      title: "Nordeste Criativo",
      client: "SESI/FIEPB",
      category: "documental",
      year: 2026,
      format: "16:9",
      summary: "Oficinas criativas pelo interior da Paraíba.",
      published: false,
      sortOrder: 5,
    },
  ])
  .onConflictDoNothing();

/* ---------- Clientes que aparecem no site (confirmar autorização) ---------- */
await db
  .insert(s.showcaseClients)
  .values([
    { id: "demo-sc-serhs", name: "SERHS", sortOrder: 0 },
    { id: "demo-sc-sesi", name: "SESI", sortOrder: 1 },
    { id: "demo-sc-fiepb", name: "FIEPB", sortOrder: 2 },
    { id: "demo-sc-sudeco", name: "SUDECO", sortOrder: 3 },
  ])
  .onConflictDoNothing();

/* ---------- Freelas (nomes fictícios, valores praticados em 2026) ---------- */
await db
  .insert(s.freelancers)
  .values([
    {
      id: "demo-f1",
      name: "Rafael Moura",
      city: "Natal/RN",
      email: "rafael@example.com",
      functions: ["captacao-camera", "edicao"],
      equipment: "Câmera full frame, 2 lentes, gimbal",
    },
    { id: "demo-f2", name: "Lívia Campos", city: "Natal/RN", email: "livia@example.com", functions: ["edicao", "color"] },
    { id: "demo-f3", name: "Tiago Freire", city: "Natal/RN", email: "tiago@example.com", functions: ["captacao", "assistente"] },
    {
      id: "demo-f4",
      name: "Caio Nunes",
      city: "Parnamirim/RN",
      email: "caio@example.com",
      functions: ["captacao-camera", "sameday"],
      equipment: "Câmera cinema, kit de luz",
    },
    { id: "demo-f5", name: "Marina Rocha", city: "Natal/RN", email: "marina@example.com", functions: ["foto"] },
    {
      id: "demo-f6",
      name: "João Pedro Lima",
      city: "Natal/RN",
      email: "joaopedro@example.com",
      functions: ["drone", "captacao-camera"],
      equipment: "Drone com câmera 4K",
    },
  ])
  .onConflictDoNothing();

await db
  .insert(s.freelancerRates)
  .values([
    { id: "demo-r1", freelancerId: "demo-f1", function: "captacao-camera", amount: R(1000), unit: "diaria" },
    { id: "demo-r2", freelancerId: "demo-f1", function: "captacao-camera", category: "experiencia", amount: R(1500), unit: "diaria" },
    { id: "demo-r3", freelancerId: "demo-f1", function: "edicao", amount: R(600), unit: "projeto" },
    { id: "demo-r4", freelancerId: "demo-f2", function: "edicao", amount: R(600), unit: "projeto" },
    { id: "demo-r5", freelancerId: "demo-f3", function: "captacao", amount: R(500), unit: "diaria" },
    { id: "demo-r6", freelancerId: "demo-f3", function: "captacao", category: "experiencia", amount: R(1000), unit: "diaria" },
    { id: "demo-r7", freelancerId: "demo-f4", function: "captacao-camera", category: "experiencia", amount: R(1500), unit: "diaria" },
    { id: "demo-r8", freelancerId: "demo-f4", function: "sameday", amount: R(1000), unit: "projeto" },
    { id: "demo-r9", freelancerId: "demo-f6", function: "captacao-camera", amount: R(1000), unit: "diaria" },
  ])
  .onConflictDoNothing();

/* ---------- Clientes ---------- */
await db
  .insert(s.clients)
  .values([
    { id: "demo-c1", name: "SERHS", segment: "Hotelaria", city: "Natal/RN", contactName: "Marketing SERHS", source: "indicacao" },
    { id: "demo-c2", name: "SESI/FIEPB", segment: "Indústria e educação", city: "João Pessoa/PB", source: "outro" },
    { id: "demo-c3", name: "SUDECO", segment: "Governo", city: "Brasília/DF", source: "outro" },
    { id: "demo-c4", name: "Estúdio Maré", segment: "Moda praia", city: "Natal/RN", contactName: "Helena Souto", source: "instagram" },
    { id: "demo-c5", name: "Quartzo Soluções em Audiovisual", segment: "Produtora parceira", city: "Natal/RN", source: "indicacao" },
  ])
  .onConflictDoNothing();

/* ---------- Leads ---------- */
const now = new Date();
await db
  .insert(s.leads)
  .values([
    {
      id: "demo-l1",
      name: "Contato do evento de outubro",
      company: "Evento corporativo",
      projectType: "experiencia",
      timing: "28 a 31/10",
      city: "Natal/RN",
      days: "3-4",
      videos: "2-4",
      format: "ambos",
      extras: ["foto", "drone", "tempo-real"],
      budget: "20-50k",
      stage: "orcamento",
      source: "whatsapp",
      estimatedValue: R(35000),
      followUpAt: d(1),
      notes: "Duas opções enviadas: completo (R$ 35 mil) ou brutos + aftermovie (R$ 19 mil).",
    },
    {
      id: "demo-l2",
      clientId: "demo-c1",
      name: "Marketing SERHS",
      company: "SERHS",
      segment: "Hotelaria",
      projectType: "conteudo",
      timing: "2027",
      stage: "negociacao",
      source: "indicacao",
      estimatedValue: R(60000),
      followUpAt: d(5),
      notes: "Promessa verbal de contrato recorrente em 2027 no pacote de R$ 5.000. Confirmar qual pacote e formalizar por escrito.",
    },
    {
      id: "demo-l3",
      name: "Ana Beatriz",
      company: "Clínica Aurora",
      segment: "Saúde",
      email: "ana@example.com",
      projectType: "campanha",
      idea: "Campanha de lançamento da nova unidade.",
      timing: "novembro/2026",
      city: "Natal/RN",
      days: "2",
      videos: "2-4",
      format: "ambos",
      extras: ["foto"],
      budget: "10-20k",
      stage: "novo",
      source: "site",
      consentAt: now,
    },
    {
      id: "demo-l4",
      name: "Pedro Henrique",
      company: "Construtora Duna",
      segment: "Construção civil",
      projectType: "filme-de-marca",
      idea: "Filme institucional para os 20 anos da empresa.",
      timing: "dezembro/2026",
      city: "Natal/RN",
      days: "3-4",
      videos: "1",
      format: "horizontal",
      budget: "20-50k",
      stage: "conversa",
      source: "instagram",
      followUpAt: d(-1),
    },
    {
      id: "demo-l5",
      name: "Juliana Freitas",
      company: "Café Tapera",
      segment: "Gastronomia",
      projectType: "conteudo",
      days: "1",
      videos: "5-10",
      format: "vertical",
      budget: "ate-5k",
      stage: "perdido",
      lostReason: "Orçamento acima do previsto neste semestre.",
      source: "site",
      consentAt: now,
    },
  ])
  .onConflictDoNothing();

/* ---------- Projetos ---------- */
const contentTemplate = DEFAULT_TEMPLATES.find((t) => t.category === "conteudo")!;
const brandTemplate = DEFAULT_TEMPLATES.find((t) => t.category === "filme-de-marca")!;
const docTemplate = DEFAULT_TEMPLATES.find((t) => t.category === "documental")!;

await db
  .insert(s.projects)
  .values([
    {
      id: "demo-p1",
      code: "ZRO-2026-001",
      title: "SERHS · Conteúdo 2026",
      clientId: "demo-c1",
      leadId: null,
      category: "conteudo",
      stage: "producao",
      status: "ativo",
      startDate: d(-20),
      dueDate: d(87),
      value: R(12000),
      briefing:
        "8 diárias até dezembro, até 16 vídeos de até 60\" (desmembráveis em 15, 20, 30 e 45\"). Grand Hotel, Beach e Pipa. Natal e Réveillon fora do escopo.",
      creativeRule: {
        dizer: "Que cada hotel do SERHS tem um ritmo próprio, e ele aparece nos detalhes.",
        porque: "Porque o hóspede escolhe pela sensação, não pela lista de serviços.",
        intencao: "Fazer quem assiste sentir o tempo desacelerar.",
        direcao: "Câmera paciente, luz natural, planos de detalhe e pessoas reais.",
        diferente: "Em vez de mostrar estrutura, mostramos momentos.",
        estetica: "Sim: a luz de cada horário do dia conduz a narrativa.",
      },
    },
    {
      id: "demo-p2",
      code: "ZRO-2026-002",
      title: "Estúdio Maré · Verão 2027",
      clientId: "demo-c4",
      category: "campanha",
      stage: "narrativa",
      status: "ativo",
      startDate: d(-30),
      dueDate: d(15),
      value: R(9500),
      briefing: "Campanha de lançamento da coleção de verão: filme principal de 60\" e cortes para redes.",
      creativeRule: {
        dizer: "Que a coleção nasce do mar de Natal.",
        porque: "Porque a marca quer ser lembrada pela origem, não pela tendência.",
        intencao: "Sal, vento e pele: fazer sentir o verão antes dele chegar.",
        direcao: "Planos abertos na luz dura do meio-dia, contrastes fortes, movimento de vento.",
        diferente: "Nada de passarela: a roupa aparece vivendo o lugar.",
        estetica: "Sim: o contraste da luz é a própria linguagem da coleção.",
      },
    },
    {
      id: "demo-p3",
      code: "ZRO-2026-003",
      title: "Nordeste Criativo · SESI/FIEPB",
      clientId: "demo-c2",
      category: "documental",
      stage: "conceito",
      status: "ativo",
      startDate: d(-5),
      dueDate: d(75),
      value: 0,
      briefing:
        "Minidocumentário e cobertura fotográfica de 6 oficinas pelo interior da Paraíba e do evento de encerramento. 19 diárias em blocos de 3.",
      creativeRule: {
        dizer: "Que a criatividade do Nordeste está espalhada pelo interior.",
        porque: "Porque essas oficinas mudam a relação das pessoas com o próprio talento.",
      },
    },
    {
      id: "demo-p4",
      code: "ZRO-2026-004",
      title: "SUDECO · Institucional e Caravana",
      clientId: "demo-c3",
      category: "filme-de-marca",
      stage: "entrega",
      status: "concluido",
      startDate: d(-150),
      dueDate: d(-110),
      value: 0,
      briefing: "Vídeo institucional e vídeo da caravana.",
    },
  ])
  .onConflictDoNothing();

function tasksFrom(
  projectId: string,
  template: { tasks: readonly { stage: string; title: string }[] },
  doneUntilStage: string | null,
) {
  const order = ["origem", "conceito", "direcao", "producao", "narrativa", "finalizacao", "entrega"];
  const limit = doneUntilStage ? order.indexOf(doneUntilStage) : -1;
  return template.tasks.map((t, i) => ({
    id: `demo-t-${projectId}-${i}`,
    projectId,
    stage: t.stage,
    title: t.title,
    done: order.indexOf(t.stage) < limit,
    sortOrder: i,
  }));
}

await db
  .insert(s.projectTasks)
  .values([
    ...tasksFrom("demo-p1", contentTemplate, "producao"),
    ...tasksFrom("demo-p2", brandTemplate, "narrativa"),
    ...tasksFrom("demo-p3", docTemplate, "conceito"),
    ...tasksFrom("demo-p4", brandTemplate, "entrega").map((t) => ({ ...t, done: true })),
  ])
  .onConflictDoNothing();

await db
  .insert(s.projectDeliverables)
  .values([
    { id: "demo-d1", projectId: "demo-p1", title: "Marenostrum · Jantar", format: "16:9", duration: "60\"", status: "entregue", dueDate: d(-8), sortOrder: 0 },
    { id: "demo-d2", projectId: "demo-p1", title: "Tapiro · Café da manhã", format: "16:9", duration: "60\"", status: "entregue", dueDate: d(-8), sortOrder: 1 },
    { id: "demo-d3", projectId: "demo-p1", title: "Grand Hotel · Piscina", format: "9:16", duration: "30\"", status: "edicao", dueDate: d(3), sortOrder: 2 },
    { id: "demo-d4", projectId: "demo-p1", title: "Pipa · Pôr do sol", format: "9:16", duration: "45\"", status: "pendente", dueDate: d(14), sortOrder: 3 },
    { id: "demo-d5", projectId: "demo-p1", title: "Beach · Família", format: "9:16", duration: "60\"", status: "pendente", dueDate: d(28), sortOrder: 4 },
    { id: "demo-d6", projectId: "demo-p2", title: "Filme principal", format: "16:9", duration: "60\"", status: "revisao", revision: 1, dueDate: d(6), sortOrder: 0 },
    { id: "demo-d7", projectId: "demo-p2", title: "Cortes para redes", format: "9:16", duration: "15\" e 30\"", quantity: 4, status: "edicao", dueDate: d(12), sortOrder: 1 },
    { id: "demo-d8", projectId: "demo-p3", title: "Minidocumentário", format: "16:9", status: "pendente", dueDate: d(75), sortOrder: 0 },
    { id: "demo-d9", projectId: "demo-p3", title: "Fotos das oficinas", format: "foto", status: "pendente", dueDate: d(60), sortOrder: 1 },
    { id: "demo-d10", projectId: "demo-p4", title: "Vídeo institucional", format: "16:9", status: "entregue", dueDate: d(-110), sortOrder: 0 },
    { id: "demo-d11", projectId: "demo-p4", title: "Caravana", format: "16:9", status: "entregue", dueDate: d(-110), sortOrder: 1 },
  ])
  .onConflictDoNothing();

await db
  .insert(s.projectCrew)
  .values([
    { id: "demo-cr1", projectId: "demo-p1", freelancerId: "demo-f1", function: "captacao-camera", work: "4 diárias", amount: R(4000), startDate: d(-12), dueDate: d(20) },
    { id: "demo-cr2", projectId: "demo-p1", freelancerId: "demo-f3", function: "captacao", work: "4 diárias", amount: R(2000), startDate: d(-12), dueDate: d(20) },
    { id: "demo-cr3", projectId: "demo-p1", freelancerId: "demo-f2", function: "edicao", work: "Lote 1 (4 vídeos)", amount: R(1200), startDate: d(-10), dueDate: d(3) },
    { id: "demo-cr4", projectId: "demo-p2", freelancerId: "demo-f4", function: "captacao-camera", work: "1 diária", amount: R(1500), startDate: d(-22), dueDate: d(-22), deliveredAt: d(-22) },
    { id: "demo-cr5", projectId: "demo-p2", freelancerId: "demo-f5", function: "foto", work: "Still da campanha", amount: R(800), startDate: d(-22), dueDate: d(-15), deliveredAt: d(-16) },
    { id: "demo-cr6", projectId: "demo-p2", freelancerId: "demo-f2", function: "edicao", work: "Filme e cortes", amount: R(1000), startDate: d(-18), dueDate: d(10) },
  ])
  .onConflictDoNothing();

/* ---------- Agenda ---------- */
await db
  .insert(s.events)
  .values([
    { id: "demo-e1", projectId: "demo-p1", type: "diaria", title: "Diária 1 · Marenostrum", date: d(-12), startTime: "08:00", endTime: "16:00", location: "SERHS Grand Hotel, Natal" },
    { id: "demo-e2", projectId: "demo-p1", type: "diaria", title: "Diária 2 · Tapiro", date: d(-11), startTime: "05:30", endTime: "13:30", location: "SERHS Grand Hotel, Natal" },
    { id: "demo-e3", projectId: "demo-p1", type: "entrega", title: "Entrega · Grand Hotel Piscina", date: d(3) },
    { id: "demo-e4", projectId: "demo-p1", type: "diaria", title: "Diária 3 · Pipa", date: d(6), startTime: "07:00", endTime: "15:00", location: "SERHS Pipa" },
    { id: "demo-e5", projectId: "demo-p1", type: "diaria", title: "Diária 4 · Pipa", date: d(7), startTime: "14:00", endTime: "22:00", location: "SERHS Pipa" },
    { id: "demo-e6", projectId: "demo-p2", type: "reuniao", title: "Aprovação do filme · Estúdio Maré", date: d(2), startTime: "10:00", endTime: "11:00", location: "Online" },
    { id: "demo-e7", projectId: "demo-p3", type: "diaria", title: "Oficina 1 · João Pessoa", date: d(14), endDate: d(16), startTime: "08:00", endTime: "17:00", location: "João Pessoa/PB" },
    { id: "demo-e8", projectId: "demo-p1", type: "diaria", title: "Diária 5 · Beach", date: d(20), startTime: "08:00", endTime: "16:00", location: "SERHS Beach, Natal" },
    { id: "demo-e9", type: "reuniao", title: "Follow-up · Construtora Duna", date: d(1), startTime: "15:00", endTime: "15:30", location: "Telefone" },
  ])
  .onConflictDoNothing();

await db
  .insert(s.eventCrew)
  .values([
    { id: "demo-ec1", eventId: "demo-e4", freelancerId: "demo-f1", function: "captacao-camera" },
    { id: "demo-ec2", eventId: "demo-e4", freelancerId: "demo-f3", function: "captacao" },
    { id: "demo-ec3", eventId: "demo-e5", freelancerId: "demo-f1", function: "captacao-camera" },
    { id: "demo-ec4", eventId: "demo-e5", freelancerId: "demo-f3", function: "captacao" },
    { id: "demo-ec5", eventId: "demo-e8", freelancerId: "demo-f1", function: "captacao-camera" },
  ])
  .onConflictDoNothing();

/* ---------- Orçamentos ---------- */
await db
  .insert(s.quotes)
  .values([
    {
      id: "demo-q1",
      number: "2026-010",
      clientId: "demo-c1",
      projectId: "demo-p1",
      title: "Conteúdo 2026 · 8 diárias",
      category: "conteudo",
      status: "aprovado",
      issueDate: d(-24),
      validUntil: d(-9),
      period: "Até 20 de dezembro de 2026",
      scope: "8 diárias de captação e até 16 vídeos de até 60\", desmembráveis em 15, 20, 30 e 45\".",
      paymentTerms: "50% na aprovação e 50% na entrega.",
      taxRate: 6,
      decidedAt: new Date(Date.now() - 21 * 864e5),
    },
    {
      id: "demo-q2",
      number: "2026-012",
      leadId: "demo-l1",
      title: "Evento 28 a 31/10 · Opção completa",
      category: "experiencia",
      status: "enviado",
      issueDate: d(-13),
      validUntil: d(2),
      period: "28 a 30/10, das 8h às 20h, e 31/10 pela manhã",
      scope: "Filmagem bruta de todo o período, vídeo institucional editado, cobertura em tempo real, drone e fotografia.",
      taxRate: 6,
      sentAt: new Date(Date.now() - 13 * 864e5),
    },
    {
      id: "demo-q3",
      number: "2026-013",
      leadId: "demo-l1",
      title: "Evento 28 a 31/10 · Brutos + aftermovie",
      category: "experiencia",
      status: "enviado",
      issueDate: d(-13),
      validUntil: d(2),
      period: "28 a 30/10, das 8h às 20h, e 31/10 pela manhã",
      scope: "Gravação dos vídeos brutos e edição do aftermovie.",
      taxRate: 6,
      sentAt: new Date(Date.now() - 13 * 864e5),
    },
    {
      id: "demo-q4",
      number: "2026-014",
      leadId: "demo-l3",
      title: "Clínica Aurora · Campanha de lançamento",
      category: "campanha",
      status: "rascunho",
      issueDate: d(0),
      validUntil: d(15),
      period: "Novembro de 2026",
      taxRate: 6,
    },
  ])
  .onConflictDoNothing();

await db
  .insert(s.quoteItems)
  .values([
    { id: "demo-qi1", quoteId: "demo-q1", description: "Pacote de 8 diárias · só vídeo", detail: "Condição especial para contrato recorrente.", quantity: 1, unit: "pacote", unitPrice: R(12000), unitCost: R(7200), sortOrder: 0 },
    { id: "demo-qi2", quoteId: "demo-q2", description: "Filmagem bruta de todo o período", quantity: 1, unit: "unidade", unitPrice: R(14000), unitCost: R(6000), sortOrder: 0 },
    { id: "demo-qi3", quoteId: "demo-q2", description: "Vídeo institucional editado", quantity: 1, unit: "video", unitPrice: R(9000), unitCost: R(2000), sortOrder: 1 },
    { id: "demo-qi4", quoteId: "demo-q2", description: "Cobertura em tempo real", detail: "Stories e conteúdo ao vivo durante o evento.", quantity: 1, unit: "unidade", unitPrice: R(6000), unitCost: R(2000), sortOrder: 2 },
    { id: "demo-qi5", quoteId: "demo-q2", description: "Drone", quantity: 1, unit: "unidade", unitPrice: R(3000), unitCost: R(1000), sortOrder: 3 },
    { id: "demo-qi6", quoteId: "demo-q2", description: "Fotografia", quantity: 1, unit: "unidade", unitPrice: R(3000), unitCost: R(1600), sortOrder: 4 },
    { id: "demo-qi7", quoteId: "demo-q3", description: "Gravação dos vídeos brutos", quantity: 1, unit: "unidade", unitPrice: R(14000), unitCost: R(6000), sortOrder: 0 },
    { id: "demo-qi8", quoteId: "demo-q3", description: "Edição do aftermovie", quantity: 1, unit: "video", unitPrice: R(5000), unitCost: R(1000), sortOrder: 1 },
    { id: "demo-qi9", quoteId: "demo-q4", description: "Pacote 2 diárias · foto + vídeo", detail: "Até 4 vídeos de até 60\" e cobertura fotográfica das diárias.", quantity: 1, unit: "pacote", unitPrice: R(5000), unitCost: R(2500), sortOrder: 0 },
    { id: "demo-qi10", quoteId: "demo-q4", description: "Diária extra", quantity: 1, unit: "diaria", unitPrice: R(2500), unitCost: R(1000), sortOrder: 1 },
  ])
  .onConflictDoNothing();

/* ---------- Financeiro ---------- */
await db
  .insert(s.financeEntries)
  .values([
    // SERHS
    { id: "demo-fe1", kind: "entrada", category: "cliente", description: "SERHS · entrada", installment: "1/2", projectId: "demo-p1", clientId: "demo-c1", quoteId: "demo-q1", amount: R(6000), paidAmount: R(6000), dueDate: d(-20), paidAt: d(-19) },
    { id: "demo-fe2", kind: "entrada", category: "cliente", description: "SERHS · saldo", installment: "2/2", projectId: "demo-p1", clientId: "demo-c1", quoteId: "demo-q1", amount: R(6000), dueDate: d(87) },
    { id: "demo-fe3", kind: "saida", category: "freela", description: "Rafael Moura · captação (4 diárias)", projectId: "demo-p1", freelancerId: "demo-f1", crewId: "demo-cr1", amount: R(4000), paidAmount: R(2000), dueDate: d(8), paidAt: d(-10) },
    { id: "demo-fe4", kind: "saida", category: "freela", description: "Tiago Freire · captação (4 diárias)", projectId: "demo-p1", freelancerId: "demo-f3", crewId: "demo-cr2", amount: R(2000), dueDate: d(8) },
    { id: "demo-fe5", kind: "saida", category: "freela", description: "Lívia Campos · edição (lote 1)", projectId: "demo-p1", freelancerId: "demo-f2", crewId: "demo-cr3", amount: R(1200), dueDate: d(-2) },
    { id: "demo-fe6", kind: "saida", category: "deslocamento", description: "Deslocamento Natal → Pipa (ida e volta)", projectId: "demo-p1", amount: R(400), dueDate: d(6) },
    // Estúdio Maré
    { id: "demo-fe7", kind: "entrada", category: "cliente", description: "Estúdio Maré · entrada", installment: "1/2", projectId: "demo-p2", clientId: "demo-c4", amount: R(4750), paidAmount: R(4750), dueDate: d(-30), paidAt: d(-30) },
    { id: "demo-fe8", kind: "entrada", category: "cliente", description: "Estúdio Maré · saldo", installment: "2/2", projectId: "demo-p2", clientId: "demo-c4", amount: R(4750), dueDate: d(15) },
    { id: "demo-fe9", kind: "saida", category: "freela", description: "Caio Nunes · captação (1 diária)", projectId: "demo-p2", freelancerId: "demo-f4", crewId: "demo-cr4", amount: R(1500), paidAmount: R(1500), dueDate: d(-20), paidAt: d(-20) },
    { id: "demo-fe10", kind: "saida", category: "freela", description: "Marina Rocha · fotografia", projectId: "demo-p2", freelancerId: "demo-f5", crewId: "demo-cr5", amount: R(800), paidAmount: R(800), dueDate: d(-14), paidAt: d(-14) },
    { id: "demo-fe11", kind: "saida", category: "freela", description: "Lívia Campos · edição", projectId: "demo-p2", freelancerId: "demo-f2", crewId: "demo-cr6", amount: R(1000), dueDate: d(10) },
    { id: "demo-fe12", kind: "saida", category: "locacao", description: "Locação de luz · Estúdio Maré", projectId: "demo-p2", amount: R(350), paidAmount: R(350), dueDate: d(-22), paidAt: d(-22) },
    // Fixos e impostos
    { id: "demo-fe13", kind: "saida", category: "fixo", description: "Softwares de edição (mensal)", amount: R(290), paidAmount: R(290), dueDate: d(-5), paidAt: d(-5) },
    { id: "demo-fe14", kind: "saida", category: "fixo", description: "Softwares de edição (mensal)", amount: R(290), dueDate: d(25) },
    { id: "demo-fe15", kind: "saida", category: "fixo", description: "Contabilidade (mensal)", amount: R(600), dueDate: d(12) },
    { id: "demo-fe16", kind: "imposto", category: "das", description: "DAS · competência do mês passado", competence: d(-30).slice(0, 7), amount: R(285), paidAmount: R(285), dueDate: d(-4), paidAt: d(-4) },
    { id: "demo-fe17", kind: "imposto", category: "das", description: "DAS · competência deste mês", competence: d(0).slice(0, 7), amount: R(360), dueDate: d(26) },
  ])
  .onConflictDoNothing();

await db
  .insert(s.financePayments)
  .values([
    { id: "demo-pay1", entryId: "demo-fe1", amount: R(6000), date: d(-19), method: "transferencia" },
    { id: "demo-pay2", entryId: "demo-fe3", amount: R(2000), date: d(-10), method: "pix", notes: "Adiantamento de metade." },
    { id: "demo-pay3", entryId: "demo-fe7", amount: R(4750), date: d(-30), method: "pix" },
    { id: "demo-pay4", entryId: "demo-fe9", amount: R(1500), date: d(-20), method: "pix" },
    { id: "demo-pay5", entryId: "demo-fe10", amount: R(800), date: d(-14), method: "pix" },
    { id: "demo-pay6", entryId: "demo-fe12", amount: R(350), date: d(-22), method: "pix" },
    { id: "demo-pay7", entryId: "demo-fe13", amount: R(290), date: d(-5), method: "cartao" },
    { id: "demo-pay8", entryId: "demo-fe16", amount: R(285), date: d(-4), method: "boleto" },
  ])
  .onConflictDoNothing();

/* ---------- Processos do projeto SERHS ---------- */
await db
  .insert(s.projectChecklists)
  .values([
    {
      id: "demo-ck1",
      projectId: "demo-p1",
      title: "Diárias 3 e 4 · Pipa",
      date: d(6),
      items: [
        { name: "Corpo de câmera", qty: 1, out: false, back: false },
        { name: "Lente 24-70mm", qty: 1, out: false, back: false },
        { name: "Lente 50mm", qty: 1, out: false, back: false },
        { name: "Baterias", qty: 6, out: false, back: false },
        { name: "Cartões de memória", qty: 4, out: false, back: false },
        { name: "Gimbal", qty: 1, out: false, back: false },
        { name: "Drone", qty: 1, out: false, back: false },
      ],
    },
  ])
  .onConflictDoNothing();

await db
  .insert(s.callSheets)
  .values([
    {
      id: "demo-os1",
      projectId: "demo-p1",
      eventId: "demo-e4",
      title: "Diária 3 · Pipa",
      date: d(6),
      callTime: "06:00",
      location: "SERHS Pipa",
      schedule: [
        { time: "06:00", activity: "Saída de Natal" },
        { time: "07:30", activity: "Chegada e montagem" },
        { time: "08:00", activity: "Café da manhã · planos de detalhe" },
        { time: "10:00", activity: "Área da piscina" },
        { time: "12:30", activity: "Almoço" },
        { time: "14:00", activity: "Quartos e varandas" },
        { time: "16:30", activity: "Pôr do sol na praia", notes: "Drone liberado pela recepção" },
      ],
      crew: [
        { name: "Victor Barroso", role: "Direção" },
        { name: "Rafael Moura", role: "Captação com câmera", call: "06:00" },
        { name: "Tiago Freire", role: "Captação sem câmera", call: "06:00" },
      ],
      contacts: [{ name: "Recepção SERHS Pipa", role: "Apoio no local" }],
      notes: "Levar autorização de imagem para hóspedes que aparecerem em primeiro plano.",
    },
  ])
  .onConflictDoNothing();

await db
  .insert(s.scripts)
  .values([
    {
      id: "demo-sh1",
      projectId: "demo-p1",
      kind: "shotlist",
      title: "Pipa · Pôr do sol",
      shots: [
        { scene: "1", shot: "Geral", description: "Praia vazia, sol baixo", lens: "24mm", movement: "Estático" },
        { scene: "1", shot: "Detalhe", description: "Mãos com taça contra o sol", lens: "50mm", movement: "Slider" },
        { scene: "2", shot: "Aérea", description: "Falésia e linha do mar", movement: "Drone, afastando" },
        { scene: "2", shot: "Contraplano", description: "Casal de costas olhando o horizonte", lens: "50mm", movement: "Gimbal" },
      ],
    },
  ])
  .onConflictDoNothing();

await db
  .insert(s.activities)
  .values([
    { id: "demo-a1", leadId: "demo-l1", type: "whatsapp", content: "Enviadas as duas opções de orçamento." },
    { id: "demo-a2", leadId: "demo-l2", type: "reuniao", content: "Contraproposta de R$ 12 mil por 8 diárias, com promessa de contrato em 2027." },
    { id: "demo-a3", leadId: "demo-l4", type: "ligacao", content: "Pediu referências de filmes institucionais. Retornar com 3 exemplos." },
  ])
  .onConflictDoNothing();

console.log("Dados de exemplo prontos.");
