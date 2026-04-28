import { eq } from "drizzle-orm";
import { Accept, Follow, Reject } from "@fedify/fedify";
import { describe, it, expect } from "bun:test";
import { createTestDb } from "../../db/test-utils";
import { people, personSocialAccounts, remoteFollows } from "../../db/schema";
import {
  cancelPendingRemoteFollow,
  createOrRetryRemoteFollow,
  parseFediverseHandle,
  resolveRemoteActor,
  isSafeRemoteUrl,
  REMOTE_FOLLOW_ACCEPTED_STATUS,
  REMOTE_FOLLOW_CANCELLED_STATUS,
  REMOTE_FOLLOW_PENDING_STATUS,
  REMOTE_FOLLOW_REJECTED_STATUS,
  handleAcceptActivity,
  handleRejectActivity,
  unfollowRemoteFollow,
  type ResolvedRemoteActor,
} from "../following";

function actor(overrides: Partial<ResolvedRemoteActor> = {}): ResolvedRemoteActor {
  return {
    actorUri: "https://example.social/users/alice",
    handle: "@alice@example.social",
    preferredUsername: "alice",
    displayName: "Alice",
    profileUrl: "https://example.social/@alice",
    inboxUri: "https://example.social/users/alice/inbox",
    sharedInboxUri: "https://example.social/inbox",
    avatarUrl: "https://example.social/avatar.png",
    ...overrides,
  };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("ActivityPub following send workflow", () => {
  it("parses Fediverse handles", () => {
    expect(parseFediverseHandle("@alice@example.social")).toEqual({
      username: "alice",
      host: "example.social",
    });
    expect(parseFediverseHandle("alice@example.social")).toEqual({
      username: "alice",
      host: "example.social",
    });
    expect(parseFediverseHandle("https://example.social/@alice")).toBeNull();
  });

  it("rejects unsafe remote URLs", () => {
    expect(isSafeRemoteUrl(new URL("https://example.social/users/alice"))).toBe(true);
    expect(isSafeRemoteUrl(new URL("http://example.social/users/alice"))).toBe(false);
    expect(isSafeRemoteUrl(new URL("https://localhost/users/alice"))).toBe(false);
    expect(isSafeRemoteUrl(new URL("https://192.168.1.5/users/alice"))).toBe(false);
  });

  it("resolves a remote actor via WebFinger", async () => {
    const fetcher = async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input.href : String(input);
      if (url.startsWith("https://example.social/.well-known/webfinger")) {
        return jsonResponse({
          links: [
            {
              rel: "self",
              type: "application/activity+json",
              href: "https://example.social/users/alice",
            },
          ],
        });
      }

      return jsonResponse({
        id: "https://example.social/users/alice",
        preferredUsername: "alice",
        name: "Alice Example",
        url: "https://example.social/@alice",
        inbox: "https://example.social/users/alice/inbox",
        endpoints: { sharedInbox: "https://example.social/inbox" },
        icon: { url: "https://example.social/avatar.png" },
      });
    };

    const resolved = await resolveRemoteActor("@alice@example.social", fetcher as typeof fetch);

    expect(resolved.actorUri).toBe("https://example.social/users/alice");
    expect(resolved.handle).toBe("@alice@example.social");
    expect(resolved.displayName).toBe("Alice Example");
    expect(resolved.inboxUri).toBe("https://example.social/users/alice/inbox");
  });

  it("stores pending follows and creates a linked person/social account", async () => {
    const testDb = createTestDb();
    const delivered: string[] = [];

    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async (storedFollow) => {
        delivered.push(storedFollow.actor_uri);
      },
    });

    const storedPeople = testDb.select().from(people).all();
    const socialAccounts = testDb.select().from(personSocialAccounts).all();

    expect(follow.status).toBe(REMOTE_FOLLOW_PENDING_STATUS);
    expect(follow.person_id).toBe(storedPeople[0]?.id);
    expect(follow.follow_activity_uri).toContain("/activities/follow/");
    expect(delivered).toEqual(["https://example.social/users/alice"]);
    expect(storedPeople).toHaveLength(1);
    expect(socialAccounts).toHaveLength(1);
    expect(socialAccounts[0]?.is_activitypub).toBe(true);
  });

  it("is idempotent and reuses existing people", async () => {
    const testDb = createTestDb();
    const existingPerson = testDb
      .insert(people)
      .values({ name: "Alice", url: "https://example.social/@alice" })
      .returning()
      .get();
    testDb
      .insert(personSocialAccounts)
      .values({
        person_id: existingPerson.id,
        label: "Mastodon",
        url: "https://example.social/@alice",
        is_activitypub: true,
        is_default: true,
        sort_order: 0,
      })
      .run();

    const first = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });
    const second = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });

    expect(first.id).toBe(second.id);
    expect(first.person_id).toBe(existingPerson.id);
    expect(testDb.select().from(people).all()).toHaveLength(1);
    expect(testDb.select().from(remoteFollows).all()).toHaveLength(1);
  });

  it("cancels pending follows without creating new people", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });
    const delivered: string[] = [];

    const cancelled = await cancelPendingRemoteFollow({
      followId: follow.id,
      database: testDb,
      deliver: async (storedFollow) => {
        delivered.push(storedFollow.follow_activity_uri);
      },
    });

    expect(cancelled?.status).toBe(REMOTE_FOLLOW_CANCELLED_STATUS);
    expect(delivered).toEqual([follow.follow_activity_uri]);
    expect(testDb.select().from(people).all()).toHaveLength(1);
    expect(testDb.select().from(remoteFollows).all()).toHaveLength(1);
  });

  it("unfollows accepted follows with the original Follow activity URI", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });
    await handleAcceptActivity(
      new Accept({
        actor: new URL(follow.actor_uri),
        object: new Follow({
          id: new URL(follow.follow_activity_uri),
          actor: new URL("/users/erik", new URL(follow.follow_activity_uri).origin),
          object: new URL(follow.actor_uri),
        }),
      }),
      testDb
    );
    const delivered: string[] = [];

    const unfollowed = await unfollowRemoteFollow({
      followId: follow.id,
      database: testDb,
      deliver: async (storedFollow) => {
        delivered.push(storedFollow.follow_activity_uri);
      },
    });

    expect(unfollowed?.status).toBe(REMOTE_FOLLOW_CANCELLED_STATUS);
    expect(unfollowed?.unfollowed_at).toBeInstanceOf(Date);
    expect(delivered).toEqual([follow.follow_activity_uri]);
    expect(testDb.select().from(people).all()).toHaveLength(1);
    expect(testDb.select().from(personSocialAccounts).all()).toHaveLength(1);
  });

  it("does not resend Undo activities for terminal follows", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });
    await cancelPendingRemoteFollow({
      followId: follow.id,
      database: testDb,
      deliver: async () => {},
    });
    const delivered: string[] = [];

    const unchanged = await unfollowRemoteFollow({
      followId: follow.id,
      database: testDb,
      deliver: async (storedFollow) => {
        delivered.push(storedFollow.follow_activity_uri);
      },
    });

    expect(unchanged?.status).toBe(REMOTE_FOLLOW_CANCELLED_STATUS);
    expect(delivered).toEqual([]);
  });

  it("stores delivery errors without corrupting follow status", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });

    await expect(
      unfollowRemoteFollow({
        followId: follow.id,
        database: testDb,
        deliver: async () => {
          throw new Error("Inbox unavailable");
        },
      })
    ).rejects.toThrow("Inbox unavailable");

    const stored = testDb.select().from(remoteFollows).where(eq(remoteFollows.id, follow.id)).get();
    expect(stored?.status).toBe(REMOTE_FOLLOW_PENDING_STATUS);
    expect(stored?.last_error).toBe("Inbox unavailable");
  });

  it("marks pending follows accepted from valid Accept activities", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });

    const localActor = new URL("/users/erik", new URL(follow.follow_activity_uri).origin);
    const updated = await handleAcceptActivity(
      new Accept({
        actor: new URL(follow.actor_uri),
        object: new Follow({
          id: new URL(follow.follow_activity_uri),
          actor: localActor,
          object: new URL(follow.actor_uri),
        }),
      }),
      testDb
    );

    expect(updated?.status).toBe(REMOTE_FOLLOW_ACCEPTED_STATUS);
    expect(updated?.accepted_at).toBeInstanceOf(Date);
    expect(testDb.select().from(remoteFollows).get()?.status).toBe(REMOTE_FOLLOW_ACCEPTED_STATUS);
  });

  it("marks pending follows rejected from valid Reject activities", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });

    const localActor = new URL("/users/erik", new URL(follow.follow_activity_uri).origin);
    const updated = await handleRejectActivity(
      new Reject({
        actor: new URL(follow.actor_uri),
        object: new Follow({
          id: new URL(follow.follow_activity_uri),
          actor: localActor,
          object: new URL(follow.actor_uri),
        }),
      }),
      testDb
    );

    expect(updated?.status).toBe(REMOTE_FOLLOW_REJECTED_STATUS);
    expect(updated?.rejected_at).toBeInstanceOf(Date);
    expect(testDb.select().from(remoteFollows).get()?.status).toBe(REMOTE_FOLLOW_REJECTED_STATUS);
  });

  it("ignores mismatched Accept activities", async () => {
    const testDb = createTestDb();
    const follow = await createOrRetryRemoteFollow({
      actor: actor(),
      database: testDb,
      deliver: async () => {},
    });

    const updated = await handleAcceptActivity(
      new Accept({
        actor: new URL("https://other.example/users/mallory"),
        object: new Follow({
          id: new URL(follow.follow_activity_uri),
          actor: new URL("http://localhost:5000/users/erik"),
          object: new URL(follow.actor_uri),
        }),
      }),
      testDb
    );

    expect(updated).toBeNull();
    expect(testDb.select().from(remoteFollows).get()?.status).toBe(REMOTE_FOLLOW_PENDING_STATUS);
  });
});
