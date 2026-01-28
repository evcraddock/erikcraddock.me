import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";

// Create test database before mocking
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testSqlite: InstanceType<typeof Database>;

// Mock the db module
vi.mock("../../db", async () => {
  const schema = await import("../../db/schema");
  return {
    db: testDb,
    ...schema,
  };
});

beforeAll(async () => {
  testSqlite = new Database(":memory:");

  testSqlite.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      name TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

describe("Passkey Service", () => {
  let testAuthorId: number;

  beforeEach(() => {
    testSqlite.exec("DELETE FROM passkeys");
    testSqlite.exec("DELETE FROM authors");

    const result = testSqlite
      .prepare(
        "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
      )
      .get("test@example.com", "Test User", Date.now()) as { id: number };
    testAuthorId = result.id;
  });

  describe("listPasskeys", () => {
    it("returns empty array when no passkeys", async () => {
      const { listPasskeys } = await import("../passkey");
      const passkeys = listPasskeys(testAuthorId);
      expect(passkeys).toEqual([]);
    });

    it("returns passkeys for author", async () => {
      testSqlite
        .prepare(
          "INSERT INTO passkeys (author_id, credential_id, public_key, name, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(testAuthorId, "cred123", "pubkey123", "MacBook", Date.now());

      const { listPasskeys } = await import("../passkey");
      const passkeys = listPasskeys(testAuthorId);

      expect(passkeys).toHaveLength(1);
      expect(passkeys[0].name).toBe("MacBook");
    });

    it("does not return passkeys from other authors", async () => {
      const otherAuthor = testSqlite
        .prepare(
          "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
        )
        .get("other@example.com", "Other User", Date.now()) as { id: number };

      testSqlite
        .prepare(
          "INSERT INTO passkeys (author_id, credential_id, public_key, name, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(testAuthorId, "cred1", "pubkey1", "My Passkey", Date.now());
      testSqlite
        .prepare(
          "INSERT INTO passkeys (author_id, credential_id, public_key, name, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(otherAuthor.id, "cred2", "pubkey2", "Other Passkey", Date.now());

      const { listPasskeys } = await import("../passkey");
      const myPasskeys = listPasskeys(testAuthorId);

      expect(myPasskeys).toHaveLength(1);
      expect(myPasskeys[0].name).toBe("My Passkey");
    });
  });

  describe("deletePasskey", () => {
    it("deletes own passkey", async () => {
      const pk = testSqlite
        .prepare(
          "INSERT INTO passkeys (author_id, credential_id, public_key, name, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
        )
        .get(testAuthorId, "cred123", "pubkey123", "Test", Date.now()) as { id: number };

      const { deletePasskey } = await import("../passkey");
      const result = deletePasskey(pk.id, testAuthorId);

      expect(result).toBe(true);

      const remaining = testSqlite.prepare("SELECT * FROM passkeys WHERE id = ?").get(pk.id);
      expect(remaining).toBeUndefined();
    });

    it("returns false for non-existent passkey", async () => {
      const { deletePasskey } = await import("../passkey");
      const result = deletePasskey(99999, testAuthorId);
      expect(result).toBe(false);
    });

    it("returns false when deleting another author's passkey", async () => {
      const otherAuthor = testSqlite
        .prepare(
          "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
        )
        .get("other@example.com", "Other User", Date.now()) as { id: number };

      const pk = testSqlite
        .prepare(
          "INSERT INTO passkeys (author_id, credential_id, public_key, name, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
        )
        .get(otherAuthor.id, "cred123", "pubkey123", "Other", Date.now()) as { id: number };

      const { deletePasskey } = await import("../passkey");
      const result = deletePasskey(pk.id, testAuthorId);

      expect(result).toBe(false);
    });
  });
});
