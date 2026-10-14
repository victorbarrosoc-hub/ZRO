/**
 * O MÉTODO do Quadro, igual ao da Maestro (docs/quadro/quadro-kanban.html):
 * oito colunas nesta ordem, o próximo passo de cada uma, prazos e filtros.
 * Não se troca. O que é da ZRO (pessoas, clientes, formatos) vem na config.
 */

export type ColKey = "pauta" | "afazer" | "fazendo" | "revisao" | "cliente" | "aprovado" | "agendado" | "publicado";

export const COLUNAS: { k: ColKey; nome: string; desc: string }[] = [
  { k: "pauta", nome: "Pauta", desc: "Ideias sem responsável. Escolha quem faz." },
  { k: "afazer", nome: "A fazer", desc: "Tem dono e prazo. Ainda não começou." },
  { k: "fazendo", nome: "Fazendo", desc: "Em produção agora." },
  { k: "revisao", nome: "Revisão", desc: "Alguém da casa confere antes do cliente." },
  { k: "cliente", nome: "Com o cliente", desc: "Esperando a decisão do cliente." },
  { k: "aprovado", nome: "Aprovado", desc: "O cliente aprovou. Falta agendar." },
  { k: "agendado", nome: "Agendado", desc: "Programado para ir ao ar." },
  { k: "publicado", nome: "Publicado", desc: "No ar." },
];
export const COL = Object.fromEntries(COLUNAS.map((c) => [c.k, c])) as Record<ColKey, (typeof COLUNAS)[number]>;
export const PENDENTES: ColKey[] = ["pauta", "afazer", "fazendo"];
export const EM_TRABALHO: ColKey[] = ["pauta", "afazer", "fazendo", "revisao"];

export const LIMITE = 10; // cards por coluna antes do "Mostrar mais"
export const NAO_SALVO_APOS = 20000; // ms até o card aparecer no aviso "não salvos"
export const REENVIAR_A_CADA = 15000; // ms entre novas tentativas de gravar

export type Pessoa = { id: string; nome: string; revisor?: boolean; fotoId?: string | null };
export type Cliente = { id: string; nome: string; interno?: boolean };
export type Config = { org: string; eu: string; pessoas: Pessoa[]; clientes: Cliente[]; formatos: string[]; nomePadrao: boolean };

export type Mensagem = { por: string; em: number; txt: string };
export type Card = {
  id: string;
  tema: string;
  coluna: ColKey;
  ordem?: number;
  colunaEm?: number;
  criadoEm?: number;
  criadoPor?: string;
  mod?: number;
  cliente?: string;
  formatos?: string[];
  resp?: string;
  prazo?: string;
  prazoHora?: string;
  data?: string;
  hora?: string;
  briefing?: string;
  texto?: string;
  legenda?: string;
  links?: { url: string; nome?: string }[];
  checklist?: { t: string; ok: boolean }[];
  importante?: boolean;
  feitoEm?: number;
  feitoPor?: string;
  trocouDe?: string;
  trocouEm?: number;
  apagadoEm?: number;
  apagadoPor?: string;
  varridoEm?: number;
  [k: string]: unknown;
};

/* ---------------- utilidades ---------------- */
export const linkSeguro = (u: unknown) => {
  try {
    const x = new URL(String(u));
    return /^https?:$/.test(x.protocol) ? x.href : "";
  } catch {
    return "";
  }
};
export const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
export const igual = (a: unknown, b: unknown) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
const D2 = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${D2(d.getMonth() + 1)}-${D2(d.getDate())}`;
export const hoje = () => iso(new Date());
export const doISO = (s: string) => {
  const [a, m, d] = String(s).split("-").map(Number);
  return new Date(a, m - 1, d);
};
export const soma = (s: string, n: number) => {
  const d = doISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const segunda = (s: string) => soma(s, -((doISO(s).getDay() + 6) % 7));
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function rotuloDia(s?: string) {
  if (!s) return "";
  const h = hoje();
  if (s === h) return "hoje";
  if (s === soma(h, 1)) return "amanhã";
  if (s === soma(h, -1)) return "ontem";
  const dif = (doISO(s).getTime() - doISO(h).getTime()) / 864e5;
  if (dif > 1 && dif < 7) return DIAS[doISO(s).getDay()];
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}
/** O número do card sai do RELÓGIO + acaso, nunca "o maior + 1" (custou caro na Maestro). */
export const novoId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const iniciais = (n?: string) =>
  String(n || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export function diasDesde(t?: number) {
  if (!t) return null;
  const d = Math.floor((Date.now() - +t) / 864e5);
  return d < 0 ? 0 : d;
}
export const quando = (t?: number) =>
  t ? new Date(+t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/* ---------------- o que depende da config ---------------- */
export function metodo(cfg: Config) {
  const pessoa = (id?: string) => cfg.pessoas.find((p) => p.id === id) ?? null;
  const cliente = (id?: string): Cliente =>
    cfg.clientes.find((c) => c.id === id) ?? { id: id ?? "", nome: id ? "Cliente removido" : "Sem cliente" };
  const interno = (c: Card) => !c.cliente || !!cliente(c.cliente).interno;
  const formatos = (c: Card) => (Array.isArray(c.formatos) && c.formatos.length ? c.formatos : [interno(c) ? "Tarefa" : "Post"]);
  const titulo = (c: Card) => (cfg.nomePadrao && !interno(c) ? `${cliente(c.cliente).nome} · ${formatos(c)[0]} · ${c.tema}` : c.tema);
  const revisores = () => cfg.pessoas.filter((p) => p.revisor);

  /** O PRÓXIMO PASSO de cada coluna: atalho para mover, não trava (arrastar continua valendo). */
  function proximo(c: Card): { info?: string; bts: [string, string][] } | null {
    switch (c.coluna) {
      case "pauta":
        return { bts: [["atribuir", "Atribuir"]] };
      case "afazer":
        return { bts: [["fazendo", "Começar"]] };
      case "fazendo":
        return { bts: [["revisao", "Mandar para revisão"]] };
      case "revisao":
        return {
          bts: interno(c)
            ? [
                ["publicado", "Concluir"],
                ["devolver", "Devolver"],
              ]
            : [
                ["cliente", "Enviar ao cliente"],
                ["devolver", "Devolver"],
              ],
        };
      case "cliente": {
        const d = diasDesde(c.colunaEm);
        return {
          info: "Aguardando o cliente" + (d == null ? "" : d === 0 ? " · desde hoje" : d === 1 ? " · há 1 dia" : ` · há ${d} dias`),
          bts: [
            ["aprovado", "Aprovou"],
            ["ajuste", "Pediu ajuste"],
          ],
        };
      }
      case "aprovado":
        return { bts: [["agendar", "Agendar"]] };
      case "agendado":
        return { bts: [["publicado", "Publiquei"]] };
      default:
        return null;
    }
  }

  return { pessoa, cliente, interno, formatos, titulo, revisores, proximo };
}
export type Metodo = ReturnType<typeof metodo>;

/* ---------------- filtros e prazos ---------------- */
export type Filtro = { pessoa: string; cliente: string; data: string };
export const PRAZOS: [string, string, "Entrega" | "Postagem" | "Ordem"][] = [
  ["atrasados", "Entrega atrasada", "Entrega"],
  ["hoje", "Entrega hoje", "Entrega"],
  ["semana", "Entrega esta semana", "Entrega"],
  ["proxima", "Entrega na próxima semana", "Entrega"],
  ["sem", "Sem data de entrega", "Entrega"],
  ["pub-hoje", "Vai ao ar hoje", "Postagem"],
  ["pub-semana", "Vai ao ar esta semana", "Postagem"],
  ["pub-proxima", "Vai ao ar na próxima semana", "Postagem"],
  ["ord-entrega", "Todos, por prazo de entrega", "Ordem"],
  ["ord-ar", "Todos, pela data em que vai ao ar", "Ordem"],
];

export function passaData(m: Metodo, c: Card, f: string) {
  if (!f || f === "todos" || f.startsWith("ord-")) return true;
  const h = hoje(),
    ini = segunda(h);
  const naSemana = (d: string, n: number) => d >= soma(ini, 7 * n) && d <= soma(ini, 7 * n + 6);
  if (f.startsWith("pub-")) {
    if (m.interno(c) || !c.data) return false;
    return f === "pub-hoje" ? c.data === h : naSemana(c.data, f === "pub-semana" ? 0 : 1);
  }
  // entrega: só o que ainda é trabalho da equipe
  if (!EM_TRABALHO.includes(c.coluna)) return false;
  const pz = c.prazo;
  if (f === "sem") return !pz;
  if (!pz) return false;
  if (f === "atrasados") return pz < h;
  if (f === "hoje") return pz === h;
  return naSemana(pz, f === "semana" ? 0 : 1);
}

export function passaPessoaCliente(cfg: Config, c: Card, f: Filtro) {
  if (f.pessoa === "meus" && c.resp !== cfg.eu) return false;
  if (f.pessoa === "ninguem" && c.resp) return false;
  if (!["todos", "meus", "ninguem"].includes(f.pessoa) && c.resp !== f.pessoa) return false;
  if (f.cliente !== "todos" && (c.cliente || "") !== f.cliente) return false;
  return true;
}

export function ordenar(l: Card[], k: string, fd: string) {
  const porData = (campo: "prazo" | "data") => (a: Card, b: Card) =>
    String(a[campo] || "9999").localeCompare(String(b[campo] || "9999")) || (+(a.ordem ?? 0) || 0) - (+(b.ordem ?? 0) || 0);
  if (fd === "ord-entrega") l.sort(porData("prazo"));
  else if (fd === "ord-ar") l.sort(porData("data"));
  else if (k === "publicado") l.sort((a, b) => (+(b.colunaEm ?? 0) || 0) - (+(a.colunaEm ?? 0) || 0)); // o mais recente primeiro
  else l.sort((a, b) => (+(a.ordem ?? 0) || 0) - (+(b.ordem ?? 0) || 0));
  return l;
}

/** POR PRAZO: os mesmos cards em faixas de tempo. */
export function gruposPrazo(itens: Card[], ar: boolean) {
  const h = hoje(),
    am = soma(h, 1),
    ini = segunda(h),
    fimSem = soma(ini, 6),
    fimProx = soma(ini, 13);
  const G = (
    [
      ["atrasados", ar ? "Passou da data" : "Atrasados"],
      ["hoje", "Hoje"],
      ["amanha", "Amanhã"],
      ["semana", "Ainda esta semana"],
      ["proxima", "Próxima semana"],
      ["depois", "Mais para a frente"],
      ["sem", ar ? "Sem data de postagem" : "Sem prazo"],
    ] as const
  ).map(([k, n]) => ({ k, n, l: [] as Card[] }));
  const g = Object.fromEntries(G.map((x) => [x.k, x.l])) as Record<(typeof G)[number]["k"], Card[]>;
  const dia = (c: Card) => (ar ? c.data : c.prazo);
  const hora = (c: Card) => String((ar ? c.hora : c.prazoHora) || "99");
  for (const c of itens) {
    const d = dia(c);
    if (!d) g.sem.push(c);
    else if (d < h) g.atrasados.push(c);
    else if (d === h) g.hoje.push(c);
    else if (d === am) g.amanha.push(c);
    else if (d <= fimSem) g.semana.push(c);
    else if (d <= fimProx) g.proxima.push(c);
    else g.depois.push(c);
  }
  G.forEach((x) =>
    x.l.sort(
      (a, b) =>
        String(dia(a) || "9999").localeCompare(String(dia(b) || "9999")) ||
        hora(a).localeCompare(hora(b)) ||
        (b.importante ? 1 : 0) - (a.importante ? 1 : 0) ||
        (+(a.ordem ?? 0) || 0) - (+(b.ordem ?? 0) || 0),
    ),
  );
  return G;
}

/** Ordem entre os vizinhos: mover um card não regrava a coluna inteira. */
export function ordemEntre(a: Card | null, b: Card | null) {
  if (a && b) return ((+(a.ordem ?? 0) || 0) + (+(b.ordem ?? 0) || 0)) / 2;
  if (a) return (+(a.ordem ?? 0) || 0) + 1;
  if (b) return (+(b.ordem ?? 0) || 0) - 1;
  return 1;
}
