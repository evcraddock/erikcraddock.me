import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { logger } from "../utils/logger";

/**
 * Run database migrations from the drizzle/ folder.
 */
export function runMigrations<TSchema extends Record<string, unknown>>(
  db: BunSQLiteDatabase<TSchema>
): void {
  logger.info("db", "Running migrations...");
  migrate(db, { migrationsFolder: "./drizzle" });
  logger.info("db", "Migrations complete");
}
