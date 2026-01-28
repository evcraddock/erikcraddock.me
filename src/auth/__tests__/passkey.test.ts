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

// Mock @simplewebauthn/server
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn().mockResolvedValue({
    challenge: "test-challenge-registration",
    rp: { name: "test", id: "localhost" },
    user: { id: "user-id", name: "test@example.com", displayName: "test@example.com" },
  }),
  verifyRegistrationResponse: vi.fn().mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: {
        id: "new-credential-id",
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
      },
    },
  }),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({
    challenge: "test-challenge-auth",
    rpId: "localhost",
  }),
  verifyAuthenticationResponse: vi.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: {
      newCounter: 1,
    },
  }),
}));

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

  describe("generatePasskeyRegistrationOptions", () => {
    it("returns registration options", async () => {
      const { generatePasskeyRegistrationOptions } = await import("../passkey");
      const options = await generatePasskeyRegistrationOptions(testAuthorId, "test@example.com");

      expect(options).toBeDefined();
      expect(options.challenge).toBeDefined();
    });
  });

  describe("verifyAndStorePasskey", () => {
    it("stores passkey on successful verification", async () => {
      const { generatePasskeyRegistrationOptions, verifyAndStorePasskey } =
        await import("../passkey");
      await generatePasskeyRegistrationOptions(testAuthorId, "test@example.com");

      const mockResponse = {
        id: "new-credential-id",
        rawId: "new-credential-id",
        response: {
          clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
          attestationObject: "o2NmbXRmcGFja2Vk",
        },
        type: "public-key" as const,
        clientExtensionResults: {},
      };

      const result = await verifyAndStorePasskey(
        testAuthorId,
        "test@example.com",
        "Test Passkey",
        mockResponse
      );

      expect(result.success).toBe(true);
      expect(result.passkey).toBeDefined();
    });

    it("returns error when no challenge found", async () => {
      const { verifyAndStorePasskey } = await import("../passkey");

      const result = await verifyAndStorePasskey(
        testAuthorId,
        "unknown@example.com",
        "Test",
        {} as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });
  });

  describe("generatePasskeyAuthOptions", () => {
    it("returns auth options", async () => {
      const { generatePasskeyAuthOptions } = await import("../passkey");
      const options = await generatePasskeyAuthOptions();

      expect(options).toBeDefined();
      expect(options.challenge).toBeDefined();
    });
  });

  describe("verifyPasskeyAuth", () => {
    it("returns error when passkey not found", async () => {
      const { generatePasskeyAuthOptions, verifyPasskeyAuth } = await import("../passkey");
      await generatePasskeyAuthOptions();

      const result = await verifyPasskeyAuth({
        id: "nonexistent-cred",
        rawId: "nonexistent-cred",
        response: {} as any,
        type: "public-key",
        clientExtensionResults: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns email on successful auth", async () => {
      testSqlite
        .prepare(
          "INSERT INTO passkeys (author_id, credential_id, public_key, name, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          testAuthorId,
          "verify-cred",
          Buffer.from([1, 2, 3, 4]).toString("base64"),
          "Verify Test",
          Date.now()
        );

      const { generatePasskeyAuthOptions, verifyPasskeyAuth } = await import("../passkey");
      await generatePasskeyAuthOptions();

      const mockResponse = {
        id: "verify-cred",
        rawId: "verify-cred",
        response: {
          clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
          authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MBAAAABQ",
          signature: "MEUCIQDKg",
        },
        type: "public-key" as const,
        clientExtensionResults: {},
      };

      const result = await verifyPasskeyAuth(mockResponse);

      expect(result.success).toBe(true);
      expect(result.email).toBe("test@example.com");
    });
  });
});
