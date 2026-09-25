import { defineConfig } from "drizzle-kit";
import { databaseConfig } from "./src/lib/db/config";

const { url, authToken } = databaseConfig();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  casing: "snake_case",
  dbCredentials: { url, authToken },
});
