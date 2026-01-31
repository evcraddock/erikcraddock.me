import { Temporal } from "@js-temporal/polyfill";
import type {
  MessageQueue,
  MessageQueueEnqueueOptions,
  MessageQueueListenOptions,
} from "@fedify/fedify";
import { logger } from "@/utils/logger";

/**
 * Options for SqliteMessageQueue.
 */
export interface SqliteMessageQueueOptions {
  /**
   * The interval to poll for messages in the queue. 1 second by default.
   */
  pollInterval?: Temporal.Duration | Temporal.DurationLike;
}

// Database type - could be better-sqlite3 or bun:sqlite
// Using interface to avoid `any` while supporting both runtimes
interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): void;
    get(...args: unknown[]): Record<string, unknown> | undefined;
  };
}

/**
 * A SQLite-backed message queue for Fedify.
 *
 * This persists messages to SQLite so they survive process restarts.
 * Messages are processed in order and removed after successful handling.
 */
export class SqliteMessageQueue implements MessageQueue {
  readonly nativeRetrial = false;
  private db: SqliteDatabase;
  private pollIntervalMs: number;
  private isBun: boolean;

  constructor(db: SqliteDatabase, options?: SqliteMessageQueueOptions) {
    this.db = db;
    this.isBun = typeof globalThis.Bun !== "undefined";

    // Parse poll interval
    const interval = options?.pollInterval;
    if (interval) {
      const duration =
        interval instanceof Temporal.Duration ? interval : Temporal.Duration.from(interval);
      this.pollIntervalMs = duration.total("milliseconds");
    } else {
      this.pollIntervalMs = 1000; // Default 1 second
    }

    // Create table if not exists
    this.initTable();
  }

  private initTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS fedify_mq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        available_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.db.exec(sql);

    // Create index for efficient polling
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS fedify_mq_available_at 
      ON fedify_mq (available_at)
    `);

    logger.debug("federation", "SQLite message queue initialized");
  }

  async enqueue(message: unknown, options?: MessageQueueEnqueueOptions): Promise<void> {
    const now = Date.now();
    let availableAt = now;

    if (options?.delay) {
      const delay =
        options.delay instanceof Temporal.Duration
          ? options.delay
          : Temporal.Duration.from(options.delay);
      availableAt = now + delay.total("milliseconds");
    }

    const messageJson = JSON.stringify(message);

    if (this.isBun) {
      const stmt = this.db.prepare("INSERT INTO fedify_mq (message, available_at) VALUES (?, ?)");
      stmt.run(messageJson, availableAt);
    } else {
      const stmt = this.db.prepare("INSERT INTO fedify_mq (message, available_at) VALUES (?, ?)");
      stmt.run(messageJson, availableAt);
    }

    logger.debug("federation", "Message enqueued", { availableAt });
  }

  async enqueueMany(messages: unknown[], options?: MessageQueueEnqueueOptions): Promise<void> {
    const now = Date.now();
    let availableAt = now;

    if (options?.delay) {
      const delay =
        options.delay instanceof Temporal.Duration
          ? options.delay
          : Temporal.Duration.from(options.delay);
      availableAt = now + delay.total("milliseconds");
    }

    const stmt = this.db.prepare("INSERT INTO fedify_mq (message, available_at) VALUES (?, ?)");

    // Insert messages (transaction handling differs between runtimes but
    // both support sequential inserts)
    for (const message of messages) {
      stmt.run(JSON.stringify(message), availableAt);
    }

    logger.debug("federation", `${messages.length} messages enqueued`);
  }

  async listen(
    handler: (message: unknown) => Promise<void> | void,
    options?: MessageQueueListenOptions
  ): Promise<void> {
    const signal = options?.signal;

    logger.info("federation", "Message queue listener started");

    while (!signal?.aborted) {
      try {
        const processed = await this.processNextMessage(handler);
        if (!processed) {
          // No messages available, wait before polling again
          await this.sleep(this.pollIntervalMs, signal);
        }
      } catch (error) {
        if (signal?.aborted) break;
        logger.error("federation", "Error processing message queue", {
          error: String(error),
        });
        // Wait before retrying on error
        await this.sleep(this.pollIntervalMs, signal);
      }
    }

    logger.info("federation", "Message queue listener stopped");
  }

  private async processNextMessage(
    handler: (message: unknown) => Promise<void> | void
  ): Promise<boolean> {
    const now = Date.now();

    // Get the next available message
    const row = this.db
      .prepare("SELECT id, message FROM fedify_mq WHERE available_at <= ? ORDER BY id LIMIT 1")
      .get(now) as { id: number; message: string } | undefined;

    if (!row) {
      return false;
    }

    try {
      const message: unknown = JSON.parse(row.message);
      await handler(message);

      // Delete the message after successful processing
      this.db.prepare("DELETE FROM fedify_mq WHERE id = ?").run(row.id);

      logger.debug("federation", "Message processed and removed", { id: row.id });
      return true;
    } catch (error) {
      // On error, leave the message in the queue for Fedify's retry logic
      logger.error("federation", "Failed to process message", {
        id: row.id,
        error: String(error),
      });
      throw error;
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, ms);

      signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Get the number of pending messages in the queue.
   * Useful for monitoring.
   */
  getPendingCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM fedify_mq").get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  }
}
