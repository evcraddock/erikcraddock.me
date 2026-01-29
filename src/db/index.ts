import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrate";

const databasePath = process.env.DATABASE_PATH || "./data/site.db";

const sqlite = new Database(databasePath);
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });

// Run migrations on startup
runMigrations(db);

export * from "./schema";
