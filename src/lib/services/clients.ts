import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { clients, leads } = schema;

/**
 * Garante um cliente para o lead: se já tem, devolve; senão cria a partir
 * dos dados do lead e liga os dois. Usado pelo CRM e por Orçamentos.
 */
export async function ensureClientForLead(leadId: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado.");
  if (lead.clientId) return lead.clientId;
  const [client] = await db
    .insert(clients)
    .values({
      name: lead.company || lead.name,
      segment: lead.segment,
      city: lead.city,
      contactName: lead.company ? lead.name : null,
      email: lead.email,
      phone: lead.phone,
      source: lead.source === "site" ? "site" : lead.source,
      notes: lead.notes,
    })
    .returning({ id: clients.id });
  await db.update(leads).set({ clientId: client.id }).where(eq(leads.id, leadId));
  return client.id;
}
