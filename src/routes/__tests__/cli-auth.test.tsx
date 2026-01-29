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

// Mock email service
vi.mock("../../services/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

beforeAll(async () => {
  // Create in-memory database for tests
  testSqlite = new Database(":memory:");

  // Create tables
  testSqlite.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      author_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );

    CREATE TABLE magic_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE passkey_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge TEXT NOT NULL,
      email TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      name TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Seed a test author
  testSqlite.exec(`
    INSERT INTO authors (email, created_at)
    VALUES ('cli-test@example.com', ${Math.floor(Date.now() / 1000)})
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

beforeEach(() => {
  // Clear tables before each test (keep cli-test author)
  testSqlite.exec("DELETE FROM magic_links");
  testSqlite.exec("DELETE FROM sessions");
  testSqlite.exec("DELETE FROM api_keys");
  testSqlite.exec("DELETE FROM authors WHERE email != 'cli-test@example.com'");
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
    // Create a valid session - need to get author ID first
    const author = testSqlite
      .prepare("SELECT id FROM authors WHERE email = ?")
      .get("cli-test@example.com") as { id: number };
    const sessionId = "test-cli-session-12345";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const createdAt = Math.floor(Date.now() / 1000);

    testSqlite.exec(`
      INSERT INTO sessions (id, author_id, expires_at, created_at)
      VALUES ('${sessionId}', ${author.id}, ${expiresAt}, ${createdAt})
    `);

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
    expect(html).toContain("ek_"); // API key prefix
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

    // Should redirect to /cli/auth?error=email
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/cli/auth?error=email");
  });
});
