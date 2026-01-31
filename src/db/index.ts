import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrate";

const databasePath = process.env.DATABASE_PATH || "./data/site.db";

// Detect runtime
const isBun = typeof globalThis.Bun !== "undefined";

type DbType = BunSQLiteDatabase<typeof schema>;

function createDatabase(): DbType {
  if (isBun) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/bun-sqlite");
    const sqlite = new Database(databasePath);
    sqlite.exec("PRAGMA journal_mode = WAL;");
    return drizzle(sqlite, { schema });
  } else {
    // Use Node.js built-in SQLite (no native compilation needed)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    const sqlite = new DatabaseSync(databasePath);
    sqlite.exec("PRAGMA journal_mode = WAL;");
    return drizzle(sqlite, { schema }) as unknown as DbType;
  }
}

export const db = createDatabase();

// Run migrations on startup
runMigrations(db);

export * from "./schema";
