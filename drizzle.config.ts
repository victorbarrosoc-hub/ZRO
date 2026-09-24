import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/zro.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
