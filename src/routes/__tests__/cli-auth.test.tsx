/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach } from "bun:test";
import { mock } from "bun:test";
import { createTestDb } from "../../db/test-utils";
import { authors, sessions, apiKeys, magicLinks } from "../../db/schema";
import { eq, ne } from "drizzle-orm";

// Create test db immediately
const testDb = createTestDb();

// Mock modules - db first since other modules depend on it
mock.module("@/db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

mock.module("../../db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

mock.module("../../services/email", () => ({
  sendEmail: mock(() => Promise.resolve(true)),
}));

// Mock api-key with real implementations that use our testDb
// This ensures we get the real behavior, not a mock from another test
mock.module("@/auth/api-key", () => {
  const crypto = require("../../auth/crypto");
  const apiKeyUtils = require("../../auth/api-key-utils");
  const schema = require("../../db/schema");
  const { eq } = require("drizzle-orm");

  return {
    generateApiKey: apiKeyUtils.generateApiKey,
    API_KEY_PREFIX: apiKeyUtils.API_KEY_PREFIX,
    isValidApiKeyFormat: apiKeyUtils.isValidApiKeyFormat,
    getAuthorByEmail: (email: string) => {
      return testDb.select().from(schema.authors).where(eq(schema.authors.email, email)).get();
    },
    createApiKey: async (authorId: number | null, name: string) => {
      const { key, keyHash } = await apiKeyUtils.generateApiKey();
      const result = testDb
        .insert(schema.apiKeys)
        .values({
          author_id: authorId,
          key_hash: keyHash,
          name,
          created_at: new Date(),
        })
        .returning()
        .get();
      return { id: result.id, key };
    },
    listApiKeys: (authorId: number | null) => {
      if (authorId === null) {
        return testDb.select().from(schema.apiKeys).where(eq(schema.apiKeys.author_id, null)).all();
      }
      return testDb
        .select()
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.author_id, authorId))
        .all();
    },
    revokeApiKey: () => true,
    validateApiKey: async (apiKey: string) => {
      if (!apiKeyUtils.isValidApiKeyFormat(apiKey)) return null;
      const rawKey = apiKey.slice(apiKeyUtils.API_KEY_PREFIX.length);
      const keyHash = await crypto.hashToken(rawKey);
      const record = testDb
        .select()
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.key_hash, keyHash))
        .get();
      if (!record) return null;
      if (record.author_id === null) {
        return { email: process.env.ADMIN_EMAIL || "" };
      }
      const author = testDb
        .select()
        .from(schema.authors)
        .where(eq(schema.authors.id, record.author_id))
        .get();
      return author ? { email: author.email } : null;
    },
    requireApiKey: async (_c: unknown, next: () => Promise<void>) => {
      await next();
    },
  };
});

// Set up initial data
testDb
  .insert(authors)
  .values({
    email: "cli-test@example.com",
    created_at: new Date(),
  })
  .run();

beforeEach(() => {
  testDb.delete(magicLinks).run();
  testDb.delete(sessions).run();
  testDb.delete(apiKeys).run();
  testDb.delete(authors).where(ne(authors.email, "cli-test@example.com")).run();
});

describe("GET /cli/auth", () => {
  it("shows login form when not authenticated", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/cli/auth");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("CLI Authentication");
    expect(html).toContain("Sign in to generate an API key");
    expect(html).toContain("Login with Passkey");
    expect(html).toContain("Send login link");
  });

  it("generates API key when authenticated", async () => {
    const author = testDb
      .select()
      .from(authors)
      .where(eq(authors.email, "cli-test@example.com"))
      .get()!;
    const sessionId = "test-cli-session-12345";
    const expiresAt = new Date(Date.now() + 3600000);
    const createdAt = new Date();

    testDb
      .insert(sessions)
      .values({
        id: sessionId,
        author_id: author.id,
        expires_at: expiresAt,
        created_at: createdAt,
      })
      .run();

    const { auth } = await import("../auth");

    const res = await auth.request("/cli/auth", {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("API Key Generated");
    expect(html).toContain("Copy this key and paste it into your terminal");
    expect(html).toContain("ek_");
    expect(html).toContain("This key won&#39;t be shown again");
  });
});

describe("POST /cli/auth/login", () => {
  it("sends magic link and shows confirmation", async () => {
    const { auth } = await import("../auth");

    const formData = new FormData();
    formData.append("email", "cli-test@example.com");

    const res = await auth.request("/cli/auth/login", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Check your email");
    expect(html).toContain("sent a login link");
  });

  it("redirects with error for invalid email", async () => {
    const { auth } = await import("../auth");

    const formData = new FormData();
    formData.append("email", "not-an-email");

    const res = await auth.request("/cli/auth/login", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/cli/auth?error=email");
  });
});
