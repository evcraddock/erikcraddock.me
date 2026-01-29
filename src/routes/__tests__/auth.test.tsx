import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { authors, magicLinks, sessions } from "../../db/schema";
import { eq } from "drizzle-orm";
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
      email: "session-test@example.com",
      created_at: new Date(),
    })
    .run();
});

beforeEach(() => {
  testDb.delete(magicLinks).run();
  testDb.delete(sessions).run();
  testDb.delete(authors).where(eq(authors.email, "session-test@example.com")).run();
  testDb
    .insert(authors)
    .values({
      email: "session-test@example.com",
      created_at: new Date(),
    })
    .run();
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
});

describe("POST /login", () => {
  it("rejects invalid email format", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=notanemail",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=");
  });

  it("creates magic link for authorized email", async () => {
    const { auth } = await import("../auth");

    testDb
      .insert(authors)
      .values({
        email: "authorized@example.com",
        created_at: new Date(),
      })
      .run();

    const res = await auth.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=authorized@example.com",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("success=");

    const links = testDb.select().from(magicLinks).all();
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.email === "authorized@example.com")).toBe(true);
  });
});

describe("GET /logout", () => {
  it("clears session cookie and redirects", async () => {
    const { auth } = await import("../auth");

    const res = await auth.request("/logout");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    expect(res.headers.get("Set-Cookie")).toContain("session=;");
  });
});
