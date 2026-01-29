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

    CREATE TABLE magic_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      author_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Seed an author for session tests
  testSqlite.exec(`
    INSERT INTO authors (email, created_at) 
    VALUES ('session-test@example.com', ${Math.floor(Date.now() / 1000)})
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

beforeEach(() => {
  // Clear tables before each test (keep session-test author)
  testSqlite.exec("DELETE FROM magic_links");
  testSqlite.exec("DELETE FROM sessions");
  testSqlite.exec("DELETE FROM authors WHERE email != 'session-test@example.com'");
});

describe("GET /login", () => {
  it("renders login form", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Login");
    expect(html).toContain('type="email"');
    expect(html).toContain("Send login link");
  });

  it("shows success message when success param present", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login?success=1");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Check your email");
  });

  it("shows error message for invalid link", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login?error=invalid");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Invalid or expired login link");
  });
});

describe("POST /login", () => {
  it("redirects to success for valid email format", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=test@example.com",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?success=1");
  });

  it("redirects to error for invalid email format", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=notanemail",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=email");
  });

  it("creates magic_link record for authorized email", async () => {
    // Add an author
    testSqlite.exec(`
      INSERT INTO authors (email, created_at) 
      VALUES ('authorized@example.com', ${Date.now()})
    `);

    const { auth } = await import("../auth");

    await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=authorized@example.com",
    });

    // Check magic_link was created
    const links = testSqlite.prepare("SELECT * FROM magic_links").all();
    expect(links).toHaveLength(1);
    expect((links[0] as { email: string }).email).toBe("authorized@example.com");
  });

  it("does not create magic_link for unauthorized email", async () => {
    const { auth } = await import("../auth");

    await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=unauthorized@example.com",
    });

    // Check no magic_link was created
    const links = testSqlite.prepare("SELECT * FROM magic_links").all();
    expect(links).toHaveLength(0);
  });

  it("still shows success for unauthorized email (security)", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=unauthorized@example.com",
    });

    // Should redirect to success to avoid revealing email doesn't exist
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?success=1");
  });
});

describe("verifyMagicLink", () => {
  // Drizzle stores timestamps as seconds, so use seconds in tests
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("returns email for valid unexpired token", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { verifyMagicLink } = await import("../../auth/magic-link");

    const token = "valid-test-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60; // 15 min from now

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('test@example.com', '${tokenHash}', ${expiresAt})
    `);

    const email = await verifyMagicLink(token);
    expect(email).toBe("test@example.com");
  });

  it("returns null for invalid token", async () => {
    const { verifyMagicLink } = await import("../../auth/magic-link");

    const email = await verifyMagicLink("nonexistent-token");
    expect(email).toBeNull();
  });

  it("returns null for expired token", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { verifyMagicLink } = await import("../../auth/magic-link");

    const token = "expired-test-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() - 60; // Expired 1 minute ago

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('test@example.com', '${tokenHash}', ${expiresAt})
    `);

    const email = await verifyMagicLink(token);
    expect(email).toBeNull();
  });

  it("returns null for already used token", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { verifyMagicLink } = await import("../../auth/magic-link");

    const token = "used-test-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60;
    const usedAt = nowSeconds() - 60;

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at, used_at) 
      VALUES ('test@example.com', '${tokenHash}', ${expiresAt}, ${usedAt})
    `);

    const email = await verifyMagicLink(token);
    expect(email).toBeNull();
  });

  it("marks token as used after verification", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { verifyMagicLink } = await import("../../auth/magic-link");

    const token = "single-use-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60;

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('test@example.com', '${tokenHash}', ${expiresAt})
    `);

    // First verification should succeed
    const email1 = await verifyMagicLink(token);
    expect(email1).toBe("test@example.com");

    // Second verification should fail (already used)
    const email2 = await verifyMagicLink(token);
    expect(email2).toBeNull();
  });
});

describe("GET /login/verify", () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("redirects to /login?error=invalid when no token provided", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login/verify");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });

  it("redirects to /login?error=invalid for invalid token", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login/verify?token=invalid-token");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });

  it("creates session and redirects to /admin for valid token", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { auth } = await import("../auth");

    const token = "valid-login-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60;

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('session-test@example.com', '${tokenHash}', ${expiresAt})
    `);

    const res = await auth.request(`/login/verify?token=${token}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin");

    // Check session cookie was set
    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("session=");
    expect(setCookieHeader).toContain("HttpOnly");

    // Check session was created in database
    const sessions = testSqlite.prepare("SELECT * FROM sessions").all();
    expect(sessions).toHaveLength(1);
  });

  it("redirects to specified path when valid redirect param provided", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { auth } = await import("../auth");

    const token = "redirect-test-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60;

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('session-test@example.com', '${tokenHash}', ${expiresAt})
    `);

    const res = await auth.request(`/login/verify?token=${token}&redirect=/cli/auth`);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/cli/auth");
  });

  it("falls back to /admin for absolute URL redirect (open redirect protection)", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { auth } = await import("../auth");

    const token = "open-redirect-test-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60;

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('session-test@example.com', '${tokenHash}', ${expiresAt})
    `);

    const res = await auth.request(`/login/verify?token=${token}&redirect=https://evil.com`);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin");
  });

  it("falls back to /admin for protocol-relative URL redirect", async () => {
    const { hashToken } = await import("../../auth/crypto");
    const { auth } = await import("../auth");

    const token = "protocol-relative-test-token";
    const tokenHash = await hashToken(token);
    const expiresAt = nowSeconds() + 15 * 60;

    testSqlite.exec(`
      INSERT INTO magic_links (email, token_hash, expires_at) 
      VALUES ('session-test@example.com', '${tokenHash}', ${expiresAt})
    `);

    const res = await auth.request(`/login/verify?token=${token}&redirect=//evil.com`);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin");
  });
});

describe("POST /logout", () => {
  it("clears session cookie and redirects to home", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/logout", {
      method: "POST",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");

    // Check session cookie was cleared
    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("session=");
  });
});

describe("GET /logout", () => {
  it("clears session cookie and redirects to home", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/logout");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });
});
