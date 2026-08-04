import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";

import * as schema from "./schema.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// spec: SPK-DB-001
export function createDatabase(dbPath = process.env.SPEC_DB_PATH ?? "./specs.db") {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  return { db, sqlite };
}

export type AppDatabase = ReturnType<typeof createDatabase>["db"];
