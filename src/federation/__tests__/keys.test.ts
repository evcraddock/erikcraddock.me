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
    CREATE TABLE actor_keys (
      id INTEGER PRIMARY KEY,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

beforeEach(() => {
  testSqlite.exec("DELETE FROM actor_keys");
});

describe("Key Management", () => {
  describe("getOrCreateKeyPair", () => {
    it("generates a new key pair if none exists", async () => {
      const { getOrCreateKeyPair } = await import("../keys");

      const keyPair = await getOrCreateKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey.type).toBe("public");
      expect(keyPair.privateKey.type).toBe("private");
    });

    it("returns the same key pair on subsequent calls", async () => {
      const { getOrCreateKeyPair } = await import("../keys");

      const keyPair1 = await getOrCreateKeyPair();
      const keyPair2 = await getOrCreateKeyPair();

      // Export both to compare
      const { exportJwk } = await import("@fedify/fedify");
      const jwk1 = await exportJwk(keyPair1.publicKey);
      const jwk2 = await exportJwk(keyPair2.publicKey);

      expect(jwk1.n).toBe(jwk2.n); // RSA modulus should match
    });

    it("stores the key pair in the database", async () => {
      const { getOrCreateKeyPair } = await import("../keys");

      await getOrCreateKeyPair();

      const row = testSqlite.prepare("SELECT * FROM actor_keys WHERE id = 1").get() as {
        id: number;
        public_key: string;
        private_key: string;
        created_at: number;
      };

      expect(row).toBeDefined();
      expect(row.id).toBe(1);
      expect(row.public_key).toBeDefined();
      expect(row.private_key).toBeDefined();

      // Verify it's valid JWK
      const publicJwk = JSON.parse(row.public_key);
      expect(publicJwk.kty).toBe("RSA");
    });
  });

  describe("getKeyPair", () => {
    it("returns null if no key pair exists", async () => {
      const { getKeyPair } = await import("../keys");

      const keyPair = await getKeyPair();

      expect(keyPair).toBeNull();
    });

    it("returns the existing key pair", async () => {
      const { getOrCreateKeyPair, getKeyPair } = await import("../keys");

      // First create a key pair
      const created = await getOrCreateKeyPair();

      // Then fetch it
      const fetched = await getKeyPair();

      expect(fetched).not.toBeNull();

      // Compare the public keys
      const { exportJwk } = await import("@fedify/fedify");
      const createdJwk = await exportJwk(created.publicKey);
      const fetchedJwk = await exportJwk(fetched!.publicKey);

      expect(createdJwk.n).toBe(fetchedJwk.n);
    });
  });
});
