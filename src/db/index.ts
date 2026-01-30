import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrate";

const databasePath = process.env.DATABASE_PATH || "./data/site.db";

// Detect runtime and use appropriate SQLite driver
// Bun: use bun:sqlite (built-in)
// Node.js: use better-sqlite3 (native addon)
const isBun = typeof globalThis.Bun !== "undefined";

// Use BunSQLiteDatabase as the type - both drivers have compatible APIs
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
    // Use better-sqlite3 for Node.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    const sqlite = new BetterSqlite3(databasePath);
    sqlite.exec("PRAGMA journal_mode = WAL;");
    return drizzle(sqlite, { schema }) as unknown as DbType;
  }
}

export const db = createDatabase();

// Run migrations on startup
runMigrations(db);

export * from "./schema";
