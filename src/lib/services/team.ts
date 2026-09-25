import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FUNCTIONS, optionLabel } from "@/lib/domain";
import { daysBetween, todayISO } from "@/lib/format";

/**
 * Equipe ↔ agenda ↔ financeiro de um projeto, sempre em dia.
 *
 * - Escalou um freela numa diária do projeto: ele entra na equipe (com a diária do cadastro dele).
 * - Equipe "por diária": o valor é a diária × os dias em que a pessoa está escalada.
 * - Toda linha da equipe com valor tem o pagamento no financeiro (a pagar). Valor mudou e ainda
 *   não foi pago: o lançamento acompanha. O que já teve baixa nunca é apagado.
 */

const { projects, projectCrew, events, eventCrew, freelancers, freelancerRates, financeEntries } = schema;

/** "Rafael Moura · captação com câmera (SERHS · Conteúdo 2026)" */
export function crewEntryDescription(name: string, fn: string, projectTitle: string) {
  const label = optionLabel(FUNCTIONS, fn);
  return `${name} · ${label.charAt(0).toLowerCase()}${label.slice(1)} (${projectTitle})`;
}

/** Dias de um evento, contando o primeiro e o último. */
export function eventDayCount(date: string, endDate: string | null) {
  return endDate && endDate > date ? daysBetween(date, endDate) + 1 : 1;
}

type Rate = { function: string; category: string | null; amount: number; unit: string };

/** Tipo de job > qualquer job > o primeiro (a mesma regra da ficha do freela). */
function pickRate(rates: Rate[], fn: string, category: string) {
  const own = rates.filter((r) => r.function === fn);
  return own.find((r) => r.category && r.category === category) ?? own.find((r) => !r.category) ?? own[0] ?? null;
}

export type TeamSyncReport = { joined: string[]; left: string[]; paymentsCreated: number; paymentsUpdated: number };

export async function syncProjectTeam(projectId: string | null | undefined): Promise<TeamSyncReport> {
  const report: TeamSyncReport = { joined: [], left: [], paymentsCreated: 0, paymentsUpdated: 0 };
  if (!projectId) return report;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return report;

  // 1. Quem está escalado em cada diária do projeto, e por quantos dias.
  const bookings = await db
    .select({
      freelancerId: eventCrew.freelancerId,
      function: eventCrew.function,
      date: events.date,
      endDate: events.endDate,
    })
    .from(eventCrew)
    .innerJoin(events, eq(eventCrew.eventId, events.id))
    .where(and(eq(events.projectId, project.id), eq(events.type, "diaria")));

  let crew = await db.select().from(projectCrew).where(eq(projectCrew.projectId, project.id));

  // 2. Escalado sem lugar na equipe: entra, com a diária do cadastro.
  const bookedIds = [...new Set(bookings.map((b) => b.freelancerId))];
  const [people, rates] = bookedIds.length
    ? await Promise.all([
        db
          .select({ id: freelancers.id, name: freelancers.name, functions: freelancers.functions })
          .from(freelancers)
          .where(inArray(freelancers.id, bookedIds)),
        db.select().from(freelancerRates).where(inArray(freelancerRates.freelancerId, bookedIds)),
      ])
    : [[], []];

  const lineFor = (freelancerId: string, fn: string | null) =>
    crew.find((c) => c.freelancerId === freelancerId && (!fn || c.function === fn)) ??
    (fn ? null : crew.find((c) => c.freelancerId === freelancerId)) ??
    null;

  for (const b of bookings) {
    if (lineFor(b.freelancerId, b.function)) continue;
    const person = people.find((p) => p.id === b.freelancerId);
    if (!person) continue;
    const fn = b.function ?? person.functions[0] ?? "assistente";
    const rate = pickRate(
      rates.filter((r) => r.freelancerId === person.id),
      fn,
      project.category,
    );
    const [row] = await db
      .insert(projectCrew)
      .values({
        projectId: project.id,
        freelancerId: person.id,
        name: person.name,
        function: fn,
        source: "agenda",
        dailyRate: rate && rate.unit === "diaria" ? rate.amount : null,
        amount: rate && rate.unit === "projeto" ? rate.amount : 0,
      })
      .returning();
    crew = [...crew, row];
    report.joined.push(person.name);
  }

  // 3. Dias e datas de cada linha da equipe, pela agenda.
  const usage = new Map<string, { days: number; first: string; last: string }>();
  for (const b of bookings) {
    const line = lineFor(b.freelancerId, b.function);
    if (!line) continue;
    const end = b.endDate && b.endDate > b.date ? b.endDate : b.date;
    const u = usage.get(line.id) ?? { days: 0, first: b.date, last: end };
    u.days += eventDayCount(b.date, b.endDate);
    if (b.date < u.first) u.first = b.date;
    if (end > u.last) u.last = end;
    usage.set(line.id, u);
  }

  const entries = crew.length
    ? await db
        .select()
        .from(financeEntries)
        .where(inArray(financeEntries.crewId, crew.map((c) => c.id)))
    : [];

  for (const line of crew) {
    const u = usage.get(line.id);
    const linked = entries.filter((e) => e.crewId === line.id);

    // Entrou pela agenda e saiu de todas as diárias: sai da equipe (se nada foi pago).
    if (line.source === "agenda" && !u) {
      if (linked.some((e) => e.paidAmount > 0)) continue;
      if (linked.length) await db.delete(financeEntries).where(inArray(financeEntries.id, linked.map((e) => e.id)));
      await db.delete(projectCrew).where(eq(projectCrew.id, line.id));
      report.left.push(line.name ?? "Sem nome");
      continue;
    }

    // Por diária (ou vindo da agenda): valor e datas seguem as diárias em que a pessoa está.
    const followsAgenda = line.dailyRate != null || line.source === "agenda";
    const next = {
      amount: line.dailyRate != null ? line.dailyRate * (u?.days ?? 0) : line.amount,
      startDate: followsAgenda && u ? u.first : line.startDate,
      dueDate: followsAgenda && u ? u.last : line.dueDate,
    };
    if (next.amount !== line.amount || next.startDate !== line.startDate || next.dueDate !== line.dueDate) {
      await db.update(projectCrew).set(next).where(eq(projectCrew.id, line.id));
    }

    // 4. Pagamento no financeiro.
    const name = line.name ?? "Sem nome";
    const description = crewEntryDescription(name, line.function, project.title);
    const dueDate = next.dueDate ?? project.dueDate ?? todayISO();
    if (next.amount > 0 && !linked.length) {
      await db.insert(financeEntries).values({
        kind: "saida",
        category: "freela",
        description,
        projectId: project.id,
        freelancerId: line.freelancerId,
        crewId: line.id,
        amount: next.amount,
        dueDate,
      });
      report.paymentsCreated++;
    } else if (linked.length === 1) {
      const entry = linked[0];
      if (next.amount === 0 && entry.paidAmount === 0) {
        await db.delete(financeEntries).where(eq(financeEntries.id, entry.id));
        report.paymentsUpdated++;
      } else if (next.amount >= entry.paidAmount && next.amount > 0) {
        const patch = {
          amount: next.amount,
          description,
          freelancerId: line.freelancerId,
          // Vencimento só acompanha enquanto nada foi pago.
          dueDate: entry.paidAmount === 0 ? dueDate : entry.dueDate,
        };
        if (
          patch.amount !== entry.amount ||
          patch.description !== entry.description ||
          patch.freelancerId !== entry.freelancerId ||
          patch.dueDate !== entry.dueDate
        ) {
          await db.update(financeEntries).set(patch).where(eq(financeEntries.id, entry.id));
          report.paymentsUpdated++;
        }
      }
    }
    // Mais de um lançamento (pagamento dividido à mão): fica como está; a ficha mostra a diferença.
  }

  return report;
}

/** Frase curta para o aviso depois de salvar ("Rafael entrou na equipe. Pagamentos atualizados."). */
export function teamSyncNote(r: TeamSyncReport) {
  const first = (n: string) => n.split(" ")[0];
  const parts: string[] = [];
  if (r.joined.length) parts.push(`${r.joined.map(first).join(", ")} ${r.joined.length > 1 ? "entraram" : "entrou"} na equipe.`);
  if (r.left.length) parts.push(`${r.left.map(first).join(", ")} ${r.left.length > 1 ? "saíram" : "saiu"} da equipe.`);
  if (r.paymentsCreated || r.paymentsUpdated) parts.push("Financeiro atualizado.");
  return parts.join(" ");
}
