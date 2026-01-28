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

describe("Federation Setup", () => {
  describe("createFedifyFederation", () => {
    it("creates a federation instance", async () => {
      const { createFedifyFederation } = await import("../setup");

      const federation = createFedifyFederation();

      expect(federation).toBeDefined();
    });
  });

  describe("Actor Dispatcher", () => {
    it("returns a Person actor for identifier 'erik'", async () => {
      const { createFedifyFederation } = await import("../setup");
      const federation = createFedifyFederation();

      // Use Fedify's context to get the actor
      const ctx = federation.createContext(new Request("https://example.com/users/erik"), {
        documentLoader: async () => ({ document: {}, contextUrl: null }),
      });

      const actor = await ctx.getActor("erik");

      expect(actor).not.toBeNull();
      expect(actor?.preferredUsername?.toString()).toBe("erik");
      expect(actor?.name?.toString()).toBe("Erik Craddock");
      expect(actor?.summary?.toString()).toBe("Personal blog - articles, links, and notes");
    });

    it("returns null for unknown identifiers", async () => {
      const { createFedifyFederation } = await import("../setup");
      const federation = createFedifyFederation();

      const ctx = federation.createContext(new Request("https://example.com/users/unknown"), {
        documentLoader: async () => ({ document: {}, contextUrl: null }),
      });

      const actor = await ctx.getActor("unknown");

      expect(actor).toBeNull();
    });

    it("includes inbox URI in actor", async () => {
      const { createFedifyFederation } = await import("../setup");
      const federation = createFedifyFederation();

      const ctx = federation.createContext(new Request("https://example.com/users/erik"), {
        documentLoader: async () => ({ document: {}, contextUrl: null }),
      });

      const actor = await ctx.getActor("erik");

      expect(actor?.inboxId).toBeDefined();
      expect(actor?.inboxId?.toString()).toContain("/users/erik/inbox");
    });

    it("includes outbox URI in actor", async () => {
      const { createFedifyFederation } = await import("../setup");
      const federation = createFedifyFederation();

      const ctx = federation.createContext(new Request("https://example.com/users/erik"), {
        documentLoader: async () => ({ document: {}, contextUrl: null }),
      });

      const actor = await ctx.getActor("erik");

      expect(actor?.outboxId).toBeDefined();
      expect(actor?.outboxId?.toString()).toContain("/users/erik/outbox");
    });

    it("includes followers URI in actor", async () => {
      const { createFedifyFederation } = await import("../setup");
      const federation = createFedifyFederation();

      const ctx = federation.createContext(new Request("https://example.com/users/erik"), {
        documentLoader: async () => ({ document: {}, contextUrl: null }),
      });

      const actor = await ctx.getActor("erik");

      expect(actor?.followersId).toBeDefined();
      expect(actor?.followersId?.toString()).toContain("/users/erik/followers");
    });

    it("includes public key in actor", async () => {
      const { createFedifyFederation } = await import("../setup");
      const federation = createFedifyFederation();

      const ctx = federation.createContext(new Request("https://example.com/users/erik"), {
        documentLoader: async () => ({ document: {}, contextUrl: null }),
      });

      const actor = await ctx.getActor("erik");

      // Get the public key - it's returned as an async iterator
      const publicKeys = actor?.getPublicKeys();
      expect(publicKeys).toBeDefined();

      let foundKey = false;
      if (publicKeys) {
        for await (const key of publicKeys) {
          expect(key.id).toBeDefined();
          expect(key.id?.toString()).toContain("#main-key");
          foundKey = true;
          break;
        }
      }
      expect(foundKey).toBe(true);
    });
  });
});
