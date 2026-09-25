/** Aplica as migrações pendentes. Uso: npm run db:migrate */
import { mkdirSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { databaseConfig } from "../src/lib/db/config";

if (databaseConfig().local) mkdirSync("./data", { recursive: true });

const { db } = await import("../src/lib/db/client");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrações aplicadas.");
