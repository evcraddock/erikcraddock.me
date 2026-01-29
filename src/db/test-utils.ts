import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import * as fs from "fs";
import * as path from "path";

/**
 * Create an in-memory test database with all migrations applied.
 * Uses the actual migration files from drizzle/ - no raw SQL duplication.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");

  // Read and apply all migrations in order
  const migrationsDir = path.join(process.cwd(), "drizzle");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    // Split on statement breakpoint and execute each statement
    const statements = sql.split("--> statement-breakpoint");
    for (const stmt of statements) {
      // Remove comment lines and trim
      const cleaned = stmt
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (cleaned) {
        sqlite.exec(cleaned);
      }
    }
  }

  return drizzle(sqlite, { schema });
}
