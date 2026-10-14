/**
 * Dados iniciais que valem também em produção: configurações, catálogo de
 * preços, modelos de projeto, kits de equipamento e perguntas frequentes.
 * Valores de preço vêm das propostas de 2026 e devem ser confirmados pelo Edu.
 */

export const DEFAULT_SETTINGS = {
  company: {
    legalName: "ZRO Produção Audiovisual LTDA",
    brand: "ZRO Filmes",
    cnpj: "65.651.722/0001-51",
    address: "Rua da Saudade, 1028, Nova Descoberta, Natal/RN, 59056-400",
    email: "zro.contato@gmail.com",
    financeEmail: "financeiro.zro@gmail.com",
    phone: "",
    instagram: "zrofilmes",
    youtube: "https://www.youtube.com/@ZROFilmes",
    website: "",
  },
  whatsapp: {
    number: "(84) 98748-0000",
  },
  taxes: {
    // Alíquota efetiva estimada do Simples Nacional, em %. Confirmar com o contador.
    rate: 6,
  },
  quote: {
    validityDays: 15,
    paymentTerms: "Entrada na aprovação do orçamento e saldo na entrega.",
    conditions: [
      "Todos os serviços incluem nota fiscal.",
      "Diária de 8 horas, com horários definidos em conjunto na pré-produção.",
      "Qualquer solicitação fora desta proposta exige um novo orçamento.",
      "Data reservada mediante disponibilidade, confirmada com o pagamento da entrada.",
      "Deslocamentos fora de Natal são cobrados à parte.",
    ],
  },
} as const;

export type CompanySettings = {
  legalName: string;
  brand: string;
  cnpj: string;
  address: string;
  email: string;
  financeEmail: string;
  phone: string;
  instagram: string;
  youtube: string;
  website: string;
};
export type WhatsappSettings = { number: string };
export type TaxSettings = { rate: number };
export type QuoteSettings = { validityDays: number; paymentTerms: string; conditions: string[] };

export const DEFAULT_CATALOG = [
  {
    name: "Pacote 2 diárias · só vídeo",
    description: "Até 4 vídeos de até 60\", que podem ser desmembrados em 15, 20, 30 e 45\".",
    group: "pacote",
    unit: "pacote",
    price: 350000,
  },
  {
    name: "Pacote 2 diárias · foto + vídeo",
    description: "Até 4 vídeos de até 60\" e cobertura fotográfica das diárias.",
    group: "pacote",
    unit: "pacote",
    price: 500000,
  },
  {
    name: "Pacote 4 diárias · só vídeo",
    description: "Até 8 vídeos de até 60\", que podem ser desmembrados em 15, 20, 30 e 45\".",
    group: "pacote",
    unit: "pacote",
    price: 600000,
  },
  {
    name: "Pacote 4 diárias · foto + vídeo",
    description: "Até 8 vídeos de até 60\" e cobertura fotográfica das diárias.",
    group: "pacote",
    unit: "pacote",
    price: 800000,
  },
  {
    name: "Diária extra",
    description: "Diária de 8 horas de captação além do pacote.",
    group: "captacao",
    unit: "diaria",
    price: 250000,
  },
  {
    name: "Deslocamento Natal → Pipa",
    description: "Por trecho (ida).",
    group: "logistica",
    unit: "trecho",
    price: 20000,
  },
] as const;

export const DEFAULT_TEMPLATES = [
  {
    name: "Filme de marca",
    category: "filme-de-marca",
    description: "Institucional, manifesto ou filme de posicionamento.",
    tasks: [
      { stage: "origem", title: "Reunião de briefing com o cliente" },
      { stage: "origem", title: "Levantar referências e materiais da marca" },
      { stage: "origem", title: "Definir objetivo, público e onde o filme vai viver" },
      { stage: "conceito", title: "Responder a regra criativa" },
      { stage: "conceito", title: "Escrever o conceito" },
      { stage: "conceito", title: "Apresentar o conceito ao cliente" },
      { stage: "direcao", title: "Roteiro" },
      { stage: "direcao", title: "Moodboard e referências de fotografia" },
      { stage: "direcao", title: "Decupagem e shot list" },
      { stage: "direcao", title: "Locações e elenco" },
      { stage: "producao", title: "Montar a equipe" },
      { stage: "producao", title: "Checklist de equipamentos" },
      { stage: "producao", title: "Ordem do dia" },
      { stage: "producao", title: "Diárias de gravação" },
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
  },
  {
    name: "Conteúdo para redes",
    category: "conteudo",
    description: "Pacote de diárias com série de vídeos curtos.",
    tasks: [
      { stage: "origem", title: "Briefing e calendário de publicações" },
      { stage: "conceito", title: "Responder a regra criativa" },
      { stage: "conceito", title: "Linha editorial e pautas dos vídeos" },
      { stage: "direcao", title: "Roteiros curtos e ganchos" },
      { stage: "direcao", title: "Plano de diárias (o que gravar em cada uma)" },
      { stage: "producao", title: "Checklist de equipamentos" },
      { stage: "producao", title: "Diárias de gravação" },
      { stage: "producao", title: "Backup do material bruto em 2 lugares" },
      { stage: "narrativa", title: "Edição dos vídeos" },
      { stage: "narrativa", title: "Envio ao cliente para aprovação" },
      { stage: "finalizacao", title: "Color, trilha e legendas" },
      { stage: "finalizacao", title: "Cortes em 15, 20, 30 e 45\"" },
      { stage: "entrega", title: "Entrega dos arquivos por vídeo" },
      { stage: "entrega", title: "Controle de diárias usadas e restantes" },
    ],
  },
  {
    name: "Experiência (evento)",
    category: "experiencia",
    description: "Evento contado como filme: aftermovie, tempo real e fotos.",
    tasks: [
      { stage: "origem", title: "Programação do evento e momentos-chave" },
      { stage: "conceito", title: "Responder a regra criativa" },
      { stage: "conceito", title: "O que o aftermovie precisa contar" },
      { stage: "direcao", title: "Mapa de câmeras e posições" },
      { stage: "direcao", title: "Plano de tempo real (stories e cortes rápidos)" },
      { stage: "producao", title: "Credenciamento e acesso da equipe" },
      { stage: "producao", title: "Checklist de equipamentos" },
      { stage: "producao", title: "Ordem do dia por dia de evento" },
      { stage: "producao", title: "Backup do material bruto em 2 lugares" },
      { stage: "narrativa", title: "Sameday / cortes de tempo real" },
      { stage: "narrativa", title: "Primeiro corte do aftermovie" },
      { stage: "finalizacao", title: "Color, trilha e mixagem" },
      { stage: "entrega", title: "Entrega do aftermovie e do material bruto" },
    ],
  },
  {
    name: "Documental",
    category: "documental",
    description: "Minidoc ou série documental.",
    tasks: [
      { stage: "origem", title: "Pesquisa e personagens" },
      { stage: "conceito", title: "Responder a regra criativa" },
      { stage: "conceito", title: "Argumento e estrutura narrativa" },
      { stage: "direcao", title: "Roteiro de entrevistas" },
      { stage: "direcao", title: "Plano de filmagem por locação" },
      { stage: "producao", title: "Autorizações de imagem" },
      { stage: "producao", title: "Checklist de equipamentos" },
      { stage: "producao", title: "Diárias de gravação" },
      { stage: "producao", title: "Backup do material bruto em 2 lugares" },
      { stage: "narrativa", title: "Decupagem das entrevistas" },
      { stage: "narrativa", title: "Montagem" },
      { stage: "finalizacao", title: "Color, som e trilha" },
      { stage: "finalizacao", title: "Legendas" },
      { stage: "entrega", title: "Entrega e versões de divulgação" },
    ],
  },
] as const;

export const DEFAULT_KITS = [
  {
    name: "Câmera A",
    description: "Kit principal de captação.",
    items: [
      { name: "Corpo de câmera", qty: 1 },
      { name: "Lente 24-70mm", qty: 1 },
      { name: "Lente 50mm", qty: 1 },
      { name: "Baterias", qty: 6 },
      { name: "Cartões de memória", qty: 4 },
      { name: "Monitor externo", qty: 1 },
      { name: "Tripé", qty: 1 },
      { name: "Gimbal", qty: 1 },
    ],
  },
  {
    name: "Áudio",
    description: "Som direto e entrevistas.",
    items: [
      { name: "Lapela sem fio", qty: 2 },
      { name: "Microfone shotgun", qty: 1 },
      { name: "Gravador", qty: 1 },
      { name: "Fone de monitoração", qty: 1 },
      { name: "Pilhas e baterias", qty: 8 },
    ],
  },
  {
    name: "Luz",
    description: "Iluminação para entrevistas e cenas controladas.",
    items: [
      { name: "LED COB", qty: 2 },
      { name: "Painel LED", qty: 2 },
      { name: "Tripé de luz", qty: 4 },
      { name: "Softbox", qty: 1 },
      { name: "Rebatedor", qty: 1 },
      { name: "Extensões e réguas", qty: 3 },
    ],
  },
  {
    name: "Drone",
    description: "Aéreas.",
    items: [
      { name: "Drone", qty: 1 },
      { name: "Baterias do drone", qty: 3 },
      { name: "Controle", qty: 1 },
      { name: "Filtros ND", qty: 1 },
      { name: "Cartão de memória", qty: 2 },
    ],
  },
] as const;

export const DEFAULT_FAQS = [
  {
    question: "O que eu preciso ter pra começar?",
    answer:
      "Só a ideia, ou o problema que você quer resolver. Conceito, narrativa e direção a gente constrói junto com você.",
  },
  {
    question: "Como funciona a diária?",
    answer:
      "A diária tem 8 horas de captação, com horários definidos junto com você na pré-produção. Se o projeto pedir mais tempo, combinamos diárias extras.",
  },
  {
    question: "Quanto tempo leva até o filme ficar pronto?",
    answer:
      "Depende do tamanho do projeto. O cronograma de cada etapa, da pré-produção à entrega, vem descrito na proposta.",
  },
  {
    question: "Como a data fica reservada?",
    answer: "A data fica garantida com o pagamento da entrada, depois da aprovação do orçamento.",
  },
  {
    question: "Vocês emitem nota fiscal?",
    answer: "Sim. Todos os serviços da ZRO saem com nota fiscal.",
  },
  {
    question: "Atendem fora de Natal?",
    answer: "Sim. Deslocamentos para outras cidades entram no orçamento como um item à parte.",
  },
  {
    question: "Vocês fazem só a finalização?",
    answer:
      "Sim, pela Absolute ZRO, nosso braço de finalização e color grading, que também atende outras produtoras.",
  },
] as const;

/** Banco de equipamentos inicial: modelos comuns nas equipes de Natal. O resto entra pelo cadastro. */
export const DEFAULT_EQUIPMENT = {
  camera: [
    "Sony FX3",
    "Sony FX30",
    "Sony FX6",
    "Sony A7S III",
    "Sony A7 IV",
    "Sony A7C II",
    "Sony ZV-E1",
    "Canon EOS R5",
    "Canon EOS R6 Mark II",
    "Canon EOS C70",
    "Blackmagic Pocket 6K Pro",
    "Blackmagic Pocket 4K",
    "Panasonic Lumix GH6",
    "Panasonic Lumix S5 II",
    "Fujifilm X-H2S",
    "DJI Osmo Pocket 3",
    "GoPro Hero 12",
  ],
  lente: [
    "Sony FE 24-70mm f/2.8 GM II",
    "Sony FE 70-200mm f/2.8 GM II",
    "Sony FE 35mm f/1.4 GM",
    "Sony FE 85mm f/1.4 GM",
    "Sigma 18-35mm f/1.8 Art",
    "Sigma 24-70mm f/2.8 DG DN Art",
    "Sigma 16mm f/1.4 DC DN",
    "Tamron 28-75mm f/2.8 G2",
    "Canon RF 24-70mm f/2.8",
    "Viltrox 85mm f/1.8",
  ],
  estabilizacao: [
    "DJI RS 4",
    "DJI RS 4 Pro",
    "DJI RS 3 Mini",
    "Zhiyun Weebill 3S",
    "Tripé de vídeo com cabeça fluida",
    "Monopé",
    "Slider",
  ],
  audio: [
    "DJI Mic 2",
    "Rode Wireless GO II",
    "Hollyland Lark M2",
    "Rode VideoMic NTG",
    "Rode NTG4+",
    "Sennheiser MKE 600",
    "Zoom H6",
    "Zoom H5",
    "Tascam DR-40X",
    "Microfone de lapela com fio",
  ],
  luz: [
    "Aputure LS 300d II",
    "Amaran 200x S",
    "Amaran 100d S",
    "Aputure MC",
    "Nanlite Forza 60",
    "Godox SL60W",
    "Painel de LED",
    "Tubo de LED",
    "Softbox",
    "Rebatedor 5 em 1",
  ],
  drone: ["DJI Mini 4 Pro", "DJI Air 3", "DJI Mavic 3 Pro", "DJI Avata 2"],
  monitor: ["Atomos Ninja V", "SmallHD Focus 7", "Feelworld F6 Plus", "Hollyland Mars 400S Pro", "Accsoon CineEye 2"],
  acessorio: [
    "Baterias NP-FZ100",
    "Bateria V-Mount",
    "Cartão CFexpress",
    "Cartão SD V90",
    "SSD externo",
    "Filtro ND variável",
    "Cage",
    "Follow focus",
  ],
} as const;
