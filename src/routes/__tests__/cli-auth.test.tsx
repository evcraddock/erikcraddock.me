import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { authors, sessions, apiKeys, magicLinks } from "../../db/schema";
import { eq, ne } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema";

let testDb: ReturnType<typeof drizzle<typeof schema>>;

vi.mock("../../db", async () => {
  const schema = await import("../../db/schema");
  return {
    db: testDb,
    ...schema,
  };
});

vi.mock("../../services/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

beforeAll(async () => {
  testDb = createTestDb();

  testDb
    .insert(authors)
    .values({
      email: "cli-test@example.com",
      created_at: new Date(),
    })
    .run();
});

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
