import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { authors, sessions } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema";

let testDb: ReturnType<typeof drizzle<typeof schema>>;

vi.mock("@/db", async () => {
  const schema = await import("../../db/schema");
  return {
    get db() {
      return testDb;
    },
    ...schema,
  };
});

beforeAll(async () => {
  testDb = createTestDb();
});

beforeEach(() => {
  testDb.delete(sessions).run();
  testDb.delete(authors).run();
});

describe("createSession", () => {
  let createSession: typeof import("../session").createSession;

  beforeAll(async () => {
    const module = await import("../session");
    createSession = module.createSession;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates session with null author_id for admin email", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");

    const sessionId = await createSession("admin@example.com");

    expect(sessionId).not.toBeNull();
    const session = testDb.select().from(sessions).where(eq(sessions.id, sessionId!)).get();
    expect(session).toBeDefined();
    expect(session!.author_id).toBeNull();
  });

  it("creates session with author_id for author in database", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");

    testDb
      .insert(authors)
      .values({
        id: 1,
        email: "author@example.com",
        created_at: new Date(),
      })
      .run();

    const sessionId = await createSession("author@example.com");

    expect(sessionId).not.toBeNull();
    const session = testDb.select().from(sessions).where(eq(sessions.id, sessionId!)).get();
    expect(session).toBeDefined();
    expect(session!.author_id).toBe(1);
  });

  it("returns null for non-admin non-author email", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");

    const sessionId = await createSession("random@example.com");

    expect(sessionId).toBeNull();
  });

  it("handles admin email case-insensitively", async () => {
    vi.stubEnv("ADMIN_EMAIL", "Admin@Example.com");

    const sessionId = await createSession("admin@example.com");

    expect(sessionId).not.toBeNull();
    const session = testDb.select().from(sessions).where(eq(sessions.id, sessionId!)).get();
    expect(session!.author_id).toBeNull();
  });
});

describe("getSession", () => {
  let createSession: typeof import("../session").createSession;
  let getSession: typeof import("../session").getSession;

  beforeAll(async () => {
    const module = await import("../session");
    createSession = module.createSession;
    getSession = module.getSession;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns ADMIN_EMAIL for admin sessions", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");

    const sessionId = await createSession("admin@example.com");
    const result = await getSession(sessionId!);

    expect(result).not.toBeNull();
    expect(result!.authorEmail).toBe("admin@example.com");
    expect(result!.session.author_id).toBeNull();
  });

  it("returns author email for author sessions", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");

    testDb
      .insert(authors)
      .values({
        id: 1,
        email: "author@example.com",
        created_at: new Date(),
      })
      .run();

    const sessionId = await createSession("author@example.com");
    const result = await getSession(sessionId!);

    expect(result).not.toBeNull();
    expect(result!.authorEmail).toBe("author@example.com");
    expect(result!.session.author_id).toBe(1);
  });

  it("returns null for non-existent session", async () => {
    const result = await getSession("non-existent-session-id");
    expect(result).toBeNull();
  });

  it("returns null for admin session if ADMIN_EMAIL not set", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    const sessionId = await createSession("admin@example.com");

    // Now unset ADMIN_EMAIL
    vi.stubEnv("ADMIN_EMAIL", "");

    const result = await getSession(sessionId!);
    expect(result).toBeNull();
  });
});
