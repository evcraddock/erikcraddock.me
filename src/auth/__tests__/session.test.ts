/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mock } from "bun:test";
import { createTestDb } from "../../db/test-utils";
import { authors, sessions } from "../../db/schema";
import { eq } from "drizzle-orm";

// Create test db immediately so it's available for mocking
const testDb = createTestDb();

// Mock the db module with our test db
mock.module("@/db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

let originalAdminEmail: string | undefined;

beforeEach(() => {
  originalAdminEmail = process.env.ADMIN_EMAIL;
  testDb.delete(sessions).run();
  testDb.delete(authors).run();
});

afterEach(() => {
  if (originalAdminEmail !== undefined) {
    process.env.ADMIN_EMAIL = originalAdminEmail;
  } else {
    delete process.env.ADMIN_EMAIL;
  }
});

describe("createSession", () => {
  it("creates session with null author_id for admin email", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const { createSession } = await import("../session");

    const sessionId = await createSession("admin@example.com");

    expect(sessionId).not.toBeNull();
    const session = testDb.select().from(sessions).where(eq(sessions.id, sessionId!)).get();
    expect(session).toBeDefined();
    expect(session!.author_id).toBeNull();
  });

  it("creates session with author_id for author in database", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";

    testDb
      .insert(authors)
      .values({
        id: 1,
        email: "author@example.com",
        created_at: new Date(),
      })
      .run();

    const { createSession } = await import("../session");
    const sessionId = await createSession("author@example.com");

    expect(sessionId).not.toBeNull();
    const session = testDb.select().from(sessions).where(eq(sessions.id, sessionId!)).get();
    expect(session).toBeDefined();
    expect(session!.author_id).toBe(1);
  });

  it("returns null for non-admin non-author email", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const { createSession } = await import("../session");

    const sessionId = await createSession("random@example.com");

    expect(sessionId).toBeNull();
  });

  it("handles admin email case-insensitively", async () => {
    process.env.ADMIN_EMAIL = "Admin@Example.com";
    const { createSession } = await import("../session");

    const sessionId = await createSession("admin@example.com");

    expect(sessionId).not.toBeNull();
    const session = testDb.select().from(sessions).where(eq(sessions.id, sessionId!)).get();
    expect(session!.author_id).toBeNull();
  });
});

describe("getSession", () => {
  it("returns ADMIN_EMAIL for admin sessions", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const { createSession, getSession } = await import("../session");

    const sessionId = await createSession("admin@example.com");
    const result = await getSession(sessionId!);

    expect(result).not.toBeNull();
    expect(result!.authorEmail).toBe("admin@example.com");
    expect(result!.session.author_id).toBeNull();
  });

  it("returns author email for author sessions", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";

    testDb
      .insert(authors)
      .values({
        id: 1,
        email: "author@example.com",
        created_at: new Date(),
      })
      .run();

    const { createSession, getSession } = await import("../session");
    const sessionId = await createSession("author@example.com");
    const result = await getSession(sessionId!);

    expect(result).not.toBeNull();
    expect(result!.authorEmail).toBe("author@example.com");
    expect(result!.session.author_id).toBe(1);
  });

  it("returns null for non-existent session", async () => {
    const { getSession } = await import("../session");
    const result = await getSession("non-existent-session-id");
    expect(result).toBeNull();
  });

  it("returns null for admin session if ADMIN_EMAIL not set", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const { createSession, getSession } = await import("../session");
    const sessionId = await createSession("admin@example.com");

    // Now unset ADMIN_EMAIL
    process.env.ADMIN_EMAIL = "";

    const result = await getSession(sessionId!);
    expect(result).toBeNull();
  });
});
