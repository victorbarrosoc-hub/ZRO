/**
 * Vocabulário da ZRO: categorias, etapas, funções e opções usadas
 * no site, no funil e na área interna. Mudou aqui, muda em todo lugar.
 */

export const CATEGORIES = [
  {
    key: "filme-de-marca",
    label: "Filmes de marca",
    short: "Filme de marca",
    description: "Filmes institucionais, manifestos e narrativas de posicionamento.",
  },
  {
    key: "campanha",
    label: "Campanhas",
    short: "Campanha",
    description: "Campanhas comerciais e peças para lançamentos, datas especiais e produtos.",
  },
  {
    key: "conteudo",
    label: "Conteúdo",
    short: "Conteúdo",
    description: "Conteúdo para redes sociais com direção e identidade cinematográfica.",
  },
  {
    key: "documental",
    label: "Documental",
    short: "Documental",
    description: "Histórias reais: pessoas, empresas, projetos e territórios.",
  },
  {
    key: "experiencia",
    label: "Experiências",
    short: "Experiência",
    description: "Eventos contados como filme: aftermovies, cobertura e tempo real.",
  },
  {
    key: "direcao-criativa",
    label: "Direção criativa",
    short: "Direção criativa",
    description: "Desenvolvimento visual e narrativo de projetos audiovisuais.",
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];

export function categoryLabel(key: string | null | undefined, form: "label" | "short" = "short") {
  const found = CATEGORIES.find((c) => c.key === key);
  return found ? found[form] : "—";
}

/** Processo criativo da ZRO (documento-mestre §18). */
export const STAGES = [
  { key: "origem", n: "01", label: "Origem", hint: "A ideia. O briefing. A intenção." },
  { key: "conceito", n: "02", label: "Conceito", hint: "O que a história realmente quer dizer?" },
  { key: "direcao", n: "03", label: "Direção", hint: "Como essa ideia será traduzida em imagem?" },
  { key: "producao", n: "04", label: "Produção", hint: "Transformar conceito em realidade." },
  { key: "narrativa", n: "05", label: "Narrativa", hint: "Montar, construir ritmo e criar significado." },
  { key: "finalizacao", n: "06", label: "Finalização", hint: "Imagem, cor, som e acabamento." },
  { key: "entrega", n: "07", label: "Entrega", hint: "A história pronta para encontrar seu público." },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as [StageKey, ...StageKey[]];

export function stageInfo(key: string | null | undefined) {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}

/** Regra criativa (documento-mestre §34). Sem resposta, o projeto não passa de Conceito. */
export const CREATIVE_RULE = [
  { key: "dizer", question: "O que estamos tentando dizer?" },
  { key: "porque", question: "Por que estamos contando essa história?" },
  { key: "intencao", question: "Qual é a intenção?" },
  { key: "direcao", question: "Qual é a direção?" },
  { key: "diferente", question: "O que torna essa história diferente?" },
  { key: "estetica", question: "A estética está servindo à narrativa?" },
] as const;

export type CreativeRuleKey = (typeof CREATIVE_RULE)[number]["key"];
export type CreativeRuleAnswers = Partial<Record<CreativeRuleKey, string>>;

export function creativeRuleComplete(answers: CreativeRuleAnswers | null | undefined) {
  return CREATIVE_RULE.every((q) => (answers?.[q.key] ?? "").trim().length >= 3);
}

export const PROJECT_STATUS = [
  { key: "ativo", label: "Ativo" },
  { key: "pausado", label: "Pausado" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number]["key"];

/** Funil comercial do CRM. */
export const LEAD_STAGES = [
  { key: "novo", label: "Novo lead" },
  { key: "conversa", label: "Em conversa" },
  { key: "orcamento", label: "Orçamento enviado" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number]["key"];
export const LEAD_STAGE_KEYS = LEAD_STAGES.map((s) => s.key) as [LeadStage, ...LeadStage[]];

export const LEAD_SOURCES = [
  { key: "site", label: "Site" },
  { key: "instagram", label: "Instagram" },
  { key: "indicacao", label: "Indicação" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "outro", label: "Outro" },
] as const;

/* ---------- Funil do site ---------- */

export const FUNNEL_PROJECT_TYPES = [
  { key: "filme-de-marca", label: "Filme de marca", hint: "Institucional, manifesto, posicionamento" },
  { key: "campanha", label: "Campanha", hint: "Lançamento, produto, data especial" },
  { key: "conteudo", label: "Conteúdo pra redes", hint: "Série de vídeos com direção" },
  { key: "documental", label: "Documental", hint: "Pessoas, empresas, territórios" },
  { key: "experiencia", label: "Evento", hint: "Aftermovie, cobertura, tempo real" },
  { key: "nao-sei", label: "Ainda não sei", hint: "Vamos descobrir juntos" },
] as const;

export const FUNNEL_DAYS = [
  { key: "1", label: "1 diária" },
  { key: "2", label: "2 diárias" },
  { key: "3-4", label: "3 a 4 diárias" },
  { key: "5+", label: "5 ou mais" },
  { key: "nao-sei", label: "Não sei ainda" },
] as const;

export const FUNNEL_VIDEOS = [
  { key: "1", label: "1 vídeo" },
  { key: "2-4", label: "2 a 4 vídeos" },
  { key: "5-10", label: "5 a 10 vídeos" },
  { key: "10+", label: "Mais de 10" },
] as const;

export const FUNNEL_FORMATS = [
  { key: "horizontal", label: "Horizontal (16:9)" },
  { key: "vertical", label: "Vertical (9:16)" },
  { key: "ambos", label: "Os dois" },
] as const;

export const FUNNEL_EXTRAS = [
  { key: "foto", label: "Fotos" },
  { key: "drone", label: "Drone" },
  { key: "tempo-real", label: "Cobertura em tempo real" },
  { key: "legendas", label: "Legendas" },
  { key: "color", label: "Color grading" },
] as const;

export const FUNNEL_BUDGETS = [
  { key: "ate-5k", label: "Até R$ 5 mil" },
  { key: "5-10k", label: "R$ 5 a 10 mil" },
  { key: "10-20k", label: "R$ 10 a 20 mil" },
  { key: "20-50k", label: "R$ 20 a 50 mil" },
  { key: "50k+", label: "Acima de R$ 50 mil" },
  { key: "conversar", label: "Prefiro conversar" },
] as const;

export function optionLabel(
  list: readonly { key: string; label: string }[],
  key: string | null | undefined,
) {
  return list.find((o) => o.key === key)?.label ?? key ?? "—";
}

/* ---------- Freelas ---------- */

export const FUNCTIONS = [
  { key: "captacao-camera", label: "Captação com câmera" },
  { key: "captacao", label: "Captação sem câmera" },
  { key: "edicao", label: "Edição" },
  { key: "sameday", label: "Sameday" },
  { key: "color", label: "Color e finalização" },
  { key: "foto", label: "Fotografia" },
  { key: "drone", label: "Drone" },
  { key: "som", label: "Som direto" },
  { key: "assistente", label: "Assistente" },
  { key: "producao", label: "Produção" },
  { key: "motion", label: "Motion" },
  { key: "roteiro", label: "Roteiro" },
] as const;
export type FunctionKey = (typeof FUNCTIONS)[number]["key"];

export const RATE_UNITS = [
  { key: "diaria", label: "por diária" },
  { key: "projeto", label: "por projeto" },
  { key: "video", label: "por vídeo" },
] as const;

/* ---------- Agenda ---------- */

export const EVENT_TYPES = [
  { key: "diaria", label: "Diária" },
  { key: "entrega", label: "Entrega" },
  { key: "reuniao", label: "Reunião" },
  { key: "outro", label: "Outro" },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["key"];

export const DELIVERABLE_STATUS = [
  { key: "pendente", label: "A fazer" },
  { key: "edicao", label: "Em edição" },
  { key: "revisao", label: "Com o cliente" },
  { key: "aprovado", label: "Aprovado" },
  { key: "entregue", label: "Entregue" },
] as const;

/* ---------- Orçamentos ---------- */

export const QUOTE_STATUS = [
  { key: "rascunho", label: "Rascunho" },
  { key: "enviado", label: "Enviado" },
  { key: "aprovado", label: "Aprovado" },
  { key: "recusado", label: "Recusado" },
  { key: "expirado", label: "Expirado" },
] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number]["key"];

export const CATALOG_UNITS = [
  { key: "pacote", label: "pacote" },
  { key: "diaria", label: "diária" },
  { key: "unidade", label: "unidade" },
  { key: "video", label: "vídeo" },
  { key: "trecho", label: "trecho" },
  { key: "hora", label: "hora" },
] as const;

export const CATALOG_GROUPS = [
  { key: "pacote", label: "Pacotes" },
  { key: "captacao", label: "Captação" },
  { key: "pos", label: "Pós-produção" },
  { key: "extra", label: "Extras" },
  { key: "logistica", label: "Logística" },
] as const;

/* ---------- Financeiro ---------- */

export const FINANCE_KINDS = [
  { key: "entrada", label: "Entrada" },
  { key: "saida", label: "Saída" },
  { key: "imposto", label: "Imposto" },
] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number]["key"];

export const FINANCE_CATEGORIES = [
  { key: "cliente", label: "Cliente", kind: "entrada" },
  { key: "outra-receita", label: "Outra receita", kind: "entrada" },
  { key: "freela", label: "Freela", kind: "saida" },
  { key: "equipamento", label: "Equipamento", kind: "saida" },
  { key: "locacao", label: "Locação", kind: "saida" },
  { key: "deslocamento", label: "Deslocamento", kind: "saida" },
  { key: "alimentacao", label: "Alimentação", kind: "saida" },
  { key: "fixo", label: "Custo fixo", kind: "saida" },
  { key: "marketing", label: "Marketing", kind: "saida" },
  { key: "outra-despesa", label: "Outra despesa", kind: "saida" },
  { key: "das", label: "DAS (Simples Nacional)", kind: "imposto" },
  { key: "iss", label: "ISS", kind: "imposto" },
  { key: "outro-imposto", label: "Outro imposto", kind: "imposto" },
] as const;

export const PAYMENT_METHODS = [
  { key: "pix", label: "Pix" },
  { key: "transferencia", label: "Transferência" },
  { key: "boleto", label: "Boleto" },
  { key: "cartao", label: "Cartão" },
  { key: "dinheiro", label: "Dinheiro" },
] as const;

export type EntryStatus = "pago" | "parcial" | "atrasado" | "pendente";
