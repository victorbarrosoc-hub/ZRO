import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { ORG, quadroCarregar } from "../quadro/servidor";
import type { Card, Config, Pessoa } from "../quadro/metodo";
import { QuadroApp } from "../quadro/quadro-app";
import "../quadro/quadro.css";

export const metadata: Metadata = { title: "Pauta" };

const FORMATOS = ["Post", "Carrossel", "Reels", "Story", "Shorts", "Vídeo", "Filme", "Foto", "Artigo", "Tarefa"];

/**
 * A Pauta: o Quadro da Maestro dentro do painel (o código mora em ../quadro). Quem faz: os sócios e os freelas ativos.
 * Quem revisa: o Victor (cuida do nível da entrega); sem ele, os dois sócios.
 * Clientes: os do CRM, mais "Interno" para o trabalho da casa.
 */
export default async function PautaPage() {
  const user = await requireUser();
  const [socios, freelas, clientes, inicio] = await Promise.all([
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).orderBy(asc(schema.users.name)),
    db
      .select({ id: schema.freelancers.id, name: schema.freelancers.name, photoId: schema.freelancers.photoId })
      .from(schema.freelancers)
      .where(eq(schema.freelancers.active, true))
      .orderBy(asc(schema.freelancers.name)),
    db.select({ id: schema.clients.id, name: schema.clients.name }).from(schema.clients).orderBy(asc(schema.clients.name)),
    quadroCarregar(ORG),
  ]);

  const victor = (nome: string) => /^victor\b/i.test(nome.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const temVictor = socios.some((s) => victor(s.name));
  const pessoas: Pessoa[] = [
    ...socios.map((s) => ({ id: `u:${s.id}`, nome: s.name, revisor: temVictor ? victor(s.name) : true })),
    ...freelas.map((f) => ({ id: `f:${f.id}`, nome: f.name, fotoId: f.photoId })),
  ];
  const cfg: Config = {
    org: ORG,
    eu: `u:${user.id}`,
    pessoas,
    clientes: [{ id: "casa", nome: "Interno", interno: true }, ...clientes.map((c) => ({ id: c.id, nome: c.name }))],
    formatos: FORMATOS,
    nomePadrao: true,
  };

  if (!inicio.ok) {
    return <p className="text-ash">Não consegui ler a Pauta agora. Recarregue a página.</p>;
  }
  return <QuadroApp cfg={cfg} iniciais={inicio.cards as Card[]} cursor={inicio.cursor} />;
}
