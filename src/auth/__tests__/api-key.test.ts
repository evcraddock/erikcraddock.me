import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";

// Create test database before mocking
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testSqlite: InstanceType<typeof Database>;

// Mock the db module to use our test database
vi.mock("../../db", async () => {
  const schema = await import("../../db/schema");
  return {
    db: testDb,
    ...schema,
  };
});

beforeAll(async () => {
  // Create in-memory database for tests
  testSqlite = new Database(":memory:");

  // Create tables
  testSqlite.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

describe("API Key", () => {
  let testAuthorId: number;

  beforeEach(async () => {
    // Clean up
    testSqlite.exec("DELETE FROM api_keys");
    testSqlite.exec("DELETE FROM authors");

    // Create test author
    const result = testSqlite
      .prepare(
        "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
      )
      .get("test@example.com", "Test User", Date.now()) as { id: number };
    testAuthorId = result.id;
  });

  describe("generateApiKey", () => {
    it("generates key with correct prefix", async () => {
      const { generateApiKey, API_KEY_PREFIX } = await import("../api-key");
      const { key, keyHash } = await generateApiKey();

      expect(key).toMatch(new RegExp(`^${API_KEY_PREFIX}[a-f0-9]{64}$`));
      expect(keyHash).toHaveLength(64); // SHA-256 hex
    });

    it("generates unique keys", async () => {
      const { generateApiKey } = await import("../api-key");
      const key1 = await generateApiKey();
      const key2 = await generateApiKey();

      expect(key1.key).not.toBe(key2.key);
      expect(key1.keyHash).not.toBe(key2.keyHash);
    });
  });

  describe("createApiKey", () => {
    it("creates key and returns plaintext key", async () => {
      const { createApiKey, API_KEY_PREFIX } = await import("../api-key");
      const { id, key } = await createApiKey(testAuthorId, "Test Key");

      expect(id).toBeGreaterThan(0);
      expect(key).toMatch(new RegExp(`^${API_KEY_PREFIX}`));

      // Verify stored in DB
      const stored = testSqlite.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as {
        name: string;
        author_id: number;
      };
      expect(stored).toBeDefined();
      expect(stored?.name).toBe("Test Key");
      expect(stored?.author_id).toBe(testAuthorId);
    });

    it("uses default name if empty", async () => {
      const { createApiKey } = await import("../api-key");
      const { id } = await createApiKey(testAuthorId, "");

      const stored = testSqlite.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as {
        name: string;
      };
      expect(stored?.name).toBe("Unnamed key");
    });
  });

  describe("listApiKeys", () => {
    it("returns empty array when no keys", async () => {
      const { listApiKeys } = await import("../api-key");
      const keys = listApiKeys(testAuthorId);
      expect(keys).toEqual([]);
    });

    it("returns keys for author", async () => {
      const { createApiKey, listApiKeys } = await import("../api-key");
      await createApiKey(testAuthorId, "Key 1");
      await createApiKey(testAuthorId, "Key 2");

      const keys = listApiKeys(testAuthorId);

      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBe("Key 1");
      expect(keys[1].name).toBe("Key 2");
    });

    it("does not return keys from other authors", async () => {
      const { createApiKey, listApiKeys } = await import("../api-key");

      const otherResult = testSqlite
        .prepare(
          "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
        )
        .get("other@example.com", "Other User", Date.now()) as { id: number };

      await createApiKey(testAuthorId, "My Key");
      await createApiKey(otherResult.id, "Other Key");

      const myKeys = listApiKeys(testAuthorId);
      const otherKeys = listApiKeys(otherResult.id);

      expect(myKeys).toHaveLength(1);
      expect(myKeys[0].name).toBe("My Key");
      expect(otherKeys).toHaveLength(1);
      expect(otherKeys[0].name).toBe("Other Key");
    });
  });

  describe("revokeApiKey", () => {
    it("revokes key", async () => {
      const { createApiKey, revokeApiKey } = await import("../api-key");
      const { id } = await createApiKey(testAuthorId, "Test Key");

      const result = await revokeApiKey(id, testAuthorId);

      expect(result).toBe(true);

      const stored = testSqlite.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as {
        revoked_at: number | null;
      };
      expect(stored?.revoked_at).not.toBeNull();
    });

    it("returns true for already revoked key", async () => {
      const { createApiKey, revokeApiKey } = await import("../api-key");
      const { id } = await createApiKey(testAuthorId, "Test Key");

      await revokeApiKey(id, testAuthorId);
      const result = await revokeApiKey(id, testAuthorId);

      expect(result).toBe(true);
    });

    it("returns false for non-existent key", async () => {
      const { revokeApiKey } = await import("../api-key");
      const result = await revokeApiKey(99999, testAuthorId);
      expect(result).toBe(false);
    });

    it("returns false when revoking another author's key", async () => {
      const { createApiKey, revokeApiKey } = await import("../api-key");

      const otherResult = testSqlite
        .prepare(
          "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
        )
        .get("other2@example.com", "Other User 2", Date.now()) as { id: number };

      const { id } = await createApiKey(otherResult.id, "Other Key");

      // Try to revoke as testAuthorId
      const result = await revokeApiKey(id, testAuthorId);

      expect(result).toBe(false);
    });
  });

  describe("validateApiKey", () => {
    it("returns email for valid key", async () => {
      const { createApiKey, validateApiKey } = await import("../api-key");
      const { key } = await createApiKey(testAuthorId, "Test Key");

      const email = await validateApiKey(key);

      expect(email).toBe("test@example.com");
    });

    it("updates last_used_at", async () => {
      const { createApiKey, validateApiKey } = await import("../api-key");
      const { id, key } = await createApiKey(testAuthorId, "Test Key");

      await validateApiKey(key);

      const stored = testSqlite.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as {
        last_used_at: number | null;
      };
      expect(stored?.last_used_at).not.toBeNull();
    });

    it("returns null for invalid key", async () => {
      const { validateApiKey } = await import("../api-key");
      const email = await validateApiKey("ek_invalidkey");
      expect(email).toBeNull();
    });

    it("returns null for wrong prefix", async () => {
      const { validateApiKey } = await import("../api-key");
      const email = await validateApiKey("wrong_prefix");
      expect(email).toBeNull();
    });

    it("returns null for revoked key", async () => {
      const { createApiKey, revokeApiKey, validateApiKey } = await import("../api-key");
      const { id, key } = await createApiKey(testAuthorId, "Test Key");
      await revokeApiKey(id, testAuthorId);

      const email = await validateApiKey(key);

      expect(email).toBeNull();
    });
  });

  describe("getAuthorByEmail", () => {
    it("returns author for valid email", async () => {
      const { getAuthorByEmail } = await import("../api-key");
      const author = getAuthorByEmail("test@example.com");

      expect(author).toBeDefined();
      expect(author?.email).toBe("test@example.com");
    });

    it("returns undefined for invalid email", async () => {
      const { getAuthorByEmail } = await import("../api-key");
      const author = getAuthorByEmail("nonexistent@example.com");
      expect(author).toBeUndefined();
    });
  });
});
