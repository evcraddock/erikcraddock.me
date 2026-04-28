/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach } from "bun:test";
import { mock } from "bun:test";

import { createTestDb } from "../../db/test-utils";
import { followers, sessions } from "../../db/schema";

const testDb = createTestDb();
const adminEmail = "admin-test@example.com";

process.env.ADMIN_EMAIL = adminEmail;

mock.module("../../db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

mock.module("@/db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

function createAdminSession(): string {
  const sessionId = crypto.randomUUID();
  testDb
    .insert(sessions)
    .values({
      id: sessionId,
      author_id: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      created_at: new Date(),
    })
    .run();
  return sessionId;
}

function authenticatedRequest(path: string): Request {
  const sessionId = createAdminSession();
  return new Request(`http://localhost${path}`, {
    headers: { Cookie: `session=${sessionId}` },
  });
}

beforeEach(() => {
  testDb.delete(followers).run();
  testDb.delete(sessions).run();
});

describe("admin follower page", () => {
  it("redirects unauthenticated users to login", async () => {
    const { admin } = await import("../admin");

    const res = await admin.request("/followers");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("shows an empty state and follower count when there are no followers", async () => {
    const { admin } = await import("../admin");

    const res = await admin.request(authenticatedRequest("/followers"));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("ActivityPub Followers");
    expect(html).toContain("Stored followers");
    expect(html).toContain("No ActivityPub followers yet");
    expect(html).toContain("When remote Fediverse accounts follow this site");
  });

  it("lists stored followers with inbox metadata and followed date", async () => {
    testDb
      .insert(followers)
      .values({
        actor_uri: "https://remote.example/users/alice",
        inbox_uri: "https://remote.example/users/alice/inbox",
        shared_inbox_uri: "https://remote.example/inbox",
        followed_at: new Date("2026-04-20T12:34:00.000Z"),
      })
      .run();

    const { admin } = await import("../admin");

    const res = await admin.request(authenticatedRequest("/followers"));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("https://remote.example/users/alice");
    expect(html).toContain("https://remote.example/users/alice/inbox");
    expect(html).toContain("https://remote.example/inbox");
    expect(html).toContain("2026");
  });

  it("links to the follower page from the admin dashboard", async () => {
    const { admin } = await import("../admin");

    const res = await admin.request(authenticatedRequest("/"));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('href="/admin/followers"');
    expect(html).toContain("ActivityPub Followers");
  });

  it("does not render follower mutation actions", async () => {
    testDb
      .insert(followers)
      .values({
        actor_uri: "https://remote.example/users/bob",
        inbox_uri: "https://remote.example/users/bob/inbox",
        shared_inbox_uri: null,
        followed_at: new Date("2026-04-21T12:34:00.000Z"),
      })
      .run();

    const { admin } = await import("../admin");

    const res = await admin.request(authenticatedRequest("/followers"));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).not.toContain(">Approve<");
    expect(html).not.toContain(">Reject<");
    expect(html).not.toContain(">Remove<");
    expect(html).not.toContain(">Delete<");
  });
});
