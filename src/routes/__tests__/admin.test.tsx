/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach } from "bun:test";
import { mock } from "bun:test";

import { createTestDb } from "../../db/test-utils";
import { followers, remoteFollows, sessions } from "../../db/schema";

const originalFetch = global.fetch;

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

const mockContextSendActivity = mock(async () => {});

mock.module("@/federation/setup", () => ({
  federation: {
    createContext: mock(() => ({
      getActorUri: () => new URL("http://localhost:5000/users/erik"),
      sendActivity: mockContextSendActivity,
    })),
  },
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
  testDb.delete(remoteFollows).run();
  testDb.delete(followers).run();
  testDb.delete(sessions).run();
  global.fetch = originalFetch;
  mockContextSendActivity.mockClear();
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

describe("admin following page", () => {
  it("redirects unauthenticated users to login", async () => {
    const { admin } = await import("../admin");

    const res = await admin.request("/following");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("shows the following form and empty state", async () => {
    const { admin } = await import("../admin");

    const res = await admin.request(authenticatedRequest("/following"));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Follow a Fediverse account");
    expect(html).toContain("@alice@example.social");
    expect(html).toContain("No followed accounts yet.");
  });

  it("resolves a Fediverse account preview", async () => {
    global.fetch = mock(async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input.href : String(input);
      if (url.startsWith("https://example.social/.well-known/webfinger")) {
        return new Response(
          JSON.stringify({
            links: [
              {
                rel: "self",
                type: "application/activity+json",
                href: "https://example.social/users/alice",
              },
            ],
          })
        );
      }

      return new Response(
        JSON.stringify({
          id: "https://example.social/users/alice",
          preferredUsername: "alice",
          name: "Alice Example",
          url: "https://example.social/@alice",
          inbox: "https://example.social/users/alice/inbox",
          endpoints: { sharedInbox: "https://example.social/inbox" },
        })
      );
    }) as unknown as typeof fetch;

    const { admin } = await import("../admin");

    const res = await admin.request(
      authenticatedRequest("/following?handle=%40alice%40example.social")
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Resolved account");
    expect(html).toContain("Alice Example");
    expect(html).toContain("https://example.social/users/alice");
    expect(html).toContain(">Follow<");
  });

  it("lets admins cancel pending follow requests", async () => {
    testDb
      .insert(remoteFollows)
      .values({
        actor_uri: "https://example.social/users/alice",
        handle: "@alice@example.social",
        display_name: "Alice Example",
        profile_url: "https://example.social/@alice",
        inbox_uri: "https://example.social/users/alice/inbox",
        follow_activity_uri: "http://localhost:5000/activities/follow/alice",
        status: "pending",
        followed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const { admin } = await import("../admin");

    const pageRes = await admin.request(authenticatedRequest("/following"));
    const html = await pageRes.text();
    expect(html).toContain('action="/admin/following/1/cancel"');
    expect(html).toContain("Cancel request");

    const cancelRes = await admin.request(authenticatedRequest("/following/1/cancel"), {
      method: "POST",
    });

    const stored = testDb.select().from(remoteFollows).get();
    expect(cancelRes.status).toBe(302);
    expect(stored?.status).toBe("cancelled");
    expect(mockContextSendActivity).toHaveBeenCalledTimes(1);
  });
});
