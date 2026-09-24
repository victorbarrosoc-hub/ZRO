/** Aplica as migrações pendentes. Uso: npm run db:migrate */
import { mkdirSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";

if ((process.env.DATABASE_URL ?? "file:./data/zro.db").startsWith("file:")) {
  mkdirSync("./data", { recursive: true });
}

const { db } = await import("../src/lib/db/client");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrações aplicadas.");
