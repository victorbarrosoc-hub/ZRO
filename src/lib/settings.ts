import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  type CompanySettings,
  type QuoteSettings,
  type TaxSettings,
  type WhatsappSettings,
} from "@/lib/db/defaults";

type SettingsMap = {
  company: CompanySettings;
  whatsapp: WhatsappSettings;
  taxes: TaxSettings;
  quote: QuoteSettings;
};

export const getSetting = cache(async <K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> => {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, key) });
  const fallback = DEFAULT_SETTINGS[key] as unknown as SettingsMap[K];
  if (!row) return fallback;
  return { ...fallback, ...(row.value as object) } as SettingsMap[K];
});

export async function saveSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
