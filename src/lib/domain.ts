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
  { key: "finalizacao", label: "Finalização e color", hint: "Absolute ZRO" },
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
  { key: "ambos", label: "Horizontal e vertical" },
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

/** Função criada no cadastro do freela (fora da lista padrão): a chave é o próprio nome. */
export const FUNCTION_MAX = 40;

/** Lista padrão + funções criadas nos cadastros, sem repetir. */
export function functionOptions(extra: Iterable<string> = []): { key: string; label: string }[] {
  const known = new Set<string>(FUNCTIONS.map((f) => f.key));
  const custom = [...new Set(extra)].filter((k) => k && !known.has(k)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...FUNCTIONS, ...custom.map((k) => ({ key: k, label: k }))];
}

/**
 * Função digitada → chave. "drone" ou "Drone" viram a padrão; o resto vira um nome
 * limpo ("maquiagem " → "Maquiagem"), igual a um já usado se só mudar a maiúscula.
 */
export function normalizeFunction(input: string, existing: Iterable<string> = []) {
  const text = input.replace(/\s+/g, " ").trim().slice(0, FUNCTION_MAX);
  if (!text) return null;
  const lower = text.toLocaleLowerCase("pt-BR");
  const standard = FUNCTIONS.find((f) => f.key === text || f.label.toLocaleLowerCase("pt-BR") === lower);
  if (standard) return standard.key;
  for (const e of existing) if (e.toLocaleLowerCase("pt-BR") === lower) return e;
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

export const RATE_UNITS = [
  { key: "diaria", label: "por diária" },
  { key: "projeto", label: "por projeto" },
  { key: "video", label: "por vídeo" },
] as const;

/* ---------- Equipamentos dos freelas ---------- */

export const EQUIPMENT_CATEGORIES = [
  { key: "camera", label: "Câmera" },
  { key: "lente", label: "Lente" },
  { key: "estabilizacao", label: "Estabilização" },
  { key: "audio", label: "Áudio" },
  { key: "luz", label: "Luz" },
  { key: "grip", label: "Maquinária e grip" },
  { key: "drone", label: "Drone" },
  { key: "monitor", label: "Monitor e vídeo" },
  { key: "edicao", label: "Computador e edição" },
  { key: "acessorio", label: "Acessórios" },
  { key: "outro", label: "Outros" },
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number]["key"];
export const EQUIPMENT_NAME_MAX = 80;

const EQUIPMENT_HINTS: [EquipmentCategory, RegExp][] = [
  // Nomes que confundiriam as regras gerais (adaptador de lente, câmera com "Ronin" no nome).
  ["acessorio", /adaptador|claquete|limpeza|walkie|radio comunicador|dummy|power ?bank|top handle|focus pro|speed ?booster/],
  ["camera", /ronin 4d|iphone|burano|raptor|z ?cam\b/],
  ["edicao", /macbook|mac studio|mac mini|\bimac\b|notebook|\bpc\b|computador|speed editor|micro panel|mini panel|tangent|wacom|loupedeck|proart|monitor de referencia/],
  ["grip", /c-?stand|difusao|extensoes|reguas|tripe de luz|saco de areia|sandbag|bandeira|\bflag\b|butterfly|\bframe \d|\bgrip\b|dolly|\bgrua\b|\bjib\b|trilho|travelling|\bclamp|garra|magic arm|braco articulado|apple ?box|extensao|regua eletrica|cabo de forca|gerador/],
  ["drone", /\bdrone|dji flip|mavic|\bdji (mini|air|avata|fpv|inspire|neo)\b|\bavata\b|\bfpv\b/],
  ["estabilizacao", /gimbal|rsc ?\d|osmo mobile|shoulder rig|car mount|ventosa|ronin|\brs ?\d|weebill|\bcrane\b|zhiyun|\bmoza\b|steadicam|estabiliz|tripe|monope|slider|easyrig|cabeca fluida/],
  ["audio", /microfone|shure|comica|boya|\bzoom f\d|mixpre|sound devices|zeppelin|blimp|peludo|protetor de vento|\bmic\b|lapela|wireless|\brode\b|sennheiser|\bzoom h\d|tascam|gravador|\bboom\b|shotgun|\blark\b|deity|saramonic|audio|\bfone/],
  ["monitor", /monitor|lilliput|cosmo c\d|video assist|\batem\b|cam link|teleprompter|atomos|ninja|shinobi|smallhd|feelworld|portkeys|transmiss|hollyland mars|accsoon|teradek/],
  ["luz", /\bluz\b|skypanel|kino ?flo|ring ?light|gelatina|octabox|colmeia|\bled\b|aputure|amaran|nanlite|godox|refletor|softbox|bastao|\btubo|painel|fresnel|sonaki|\d+ ?w\b|\bcob\b|rebatedor|difusor/],
  ["lente", /\blente|objetiva|\bsigma\b|tamron|samyang|rokinon|viltrox|laowa|sirui|7artisans|tokina|zeiss|\b\d{1,3} ?- ?\d{1,3} ?mm|\b\d{2,3} ?mm\b|\bf\/? ?\d(\.\d)?\b|\b\d{1,3}-\d{1,3} \d\.\d\b/],
  ["camera", /camera|filmadora|\bsony (fx|a7|a6|zv|a1|a9)|\bfx ?\d|\ba7 ?(s|r|c|iv|iii)|\bcanon (eos|r\d|c\d)|\beos\b|blackmagic|bmpcc|pocket (4k|6k)|lumix|panasonic|\bgh\d|fujifilm|\bx-?(h|t)\d|komodo|\barri\b|gopro|\bosmo\b|insta360|nikon z/],
  ["acessorio", /bateria|cartao|\bssd\b|hd externo|carregador|v-?mount|\bnd\b|filtro|\bcage\b|follow focus|matte ?box|\bcase\b|bolsa|mochila|\bcabo|adaptador|speed ?booster/],
];

/** Categoria provável pelo nome ("Sony FX30" → câmera, "Sigma 17-40 1.8" → lente). */
export function guessEquipmentCategory(name: string): EquipmentCategory {
  const text = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return EQUIPMENT_HINTS.find(([, re]) => re.test(text))?.[0] ?? "outro";
}

/**
 * Chave para achar o mesmo modelo escrito de outro jeito: sem acento, espaço,
 * hífen ou maiúscula ("Sony A7IV" = "sony a7 iv" = "SONY A7-IV").
 */
export function equipmentKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, "");
}

/** Nome limpo: sem marcador de lista, espaços sobrando ou ponto final. */
export function cleanEquipmentName(input: string) {
  const text = input
    .replace(/^[\s•·\-–—*]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.;,]+$/, "")
    .trim()
    .slice(0, EQUIPMENT_NAME_MAX);
  return text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : null;
}

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
