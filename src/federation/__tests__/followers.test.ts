import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";

// Create test database before mocking
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testSqlite: InstanceType<typeof Database>;

// Mock the db module
vi.mock("../../db", async () => {
  const schema = await import("../../db/schema");
  return {
    db: testDb,
    ...schema,
  };
});

beforeAll(async () => {
  testSqlite = new Database(":memory:");

  testSqlite.exec(`
    CREATE TABLE followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_uri TEXT NOT NULL UNIQUE,
      inbox_uri TEXT NOT NULL,
      shared_inbox_uri TEXT,
      followed_at INTEGER NOT NULL
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

beforeEach(() => {
  testSqlite.exec("DELETE FROM followers");
});

describe("Followers Module", () => {
  describe("addFollower", () => {
    it("adds a new follower to the database", async () => {
      const { addFollower } = await import("../followers");

      const result = addFollower({
        actor_uri: "https://mastodon.social/users/alice",
        inbox_uri: "https://mastodon.social/users/alice/inbox",
      });

      expect(result).not.toBeNull();
      expect(result?.actor_uri).toBe("https://mastodon.social/users/alice");
      expect(result?.inbox_uri).toBe("https://mastodon.social/users/alice/inbox");
      expect(result?.followed_at).toBeInstanceOf(Date);
    });

    it("stores shared inbox when provided", async () => {
      const { addFollower } = await import("../followers");

      const result = addFollower({
        actor_uri: "https://mastodon.social/users/bob",
        inbox_uri: "https://mastodon.social/users/bob/inbox",
        shared_inbox_uri: "https://mastodon.social/inbox",
      });

      expect(result?.shared_inbox_uri).toBe("https://mastodon.social/inbox");
    });

    it("returns existing follower if already following", async () => {
      const { addFollower } = await import("../followers");

      const first = addFollower({
        actor_uri: "https://mastodon.social/users/carol",
        inbox_uri: "https://mastodon.social/users/carol/inbox",
      });

      const second = addFollower({
        actor_uri: "https://mastodon.social/users/carol",
        inbox_uri: "https://mastodon.social/users/carol/inbox",
      });

      expect(first?.id).toBe(second?.id);
    });
  });

  describe("removeFollower", () => {
    it("removes an existing follower", async () => {
      const { addFollower, removeFollower, getFollower } = await import("../followers");

      addFollower({
        actor_uri: "https://mastodon.social/users/dave",
        inbox_uri: "https://mastodon.social/users/dave/inbox",
      });

      const removed = removeFollower("https://mastodon.social/users/dave");

      expect(removed).toBe(true);
      expect(getFollower("https://mastodon.social/users/dave")).toBeUndefined();
    });

    it("returns false if follower not found", async () => {
      const { removeFollower } = await import("../followers");

      const removed = removeFollower("https://mastodon.social/users/nonexistent");

      expect(removed).toBe(false);
    });
  });

  describe("getFollower", () => {
    it("returns follower by actor URI", async () => {
      const { addFollower, getFollower } = await import("../followers");

      addFollower({
        actor_uri: "https://mastodon.social/users/eve",
        inbox_uri: "https://mastodon.social/users/eve/inbox",
      });

      const follower = getFollower("https://mastodon.social/users/eve");

      expect(follower).toBeDefined();
      expect(follower?.actor_uri).toBe("https://mastodon.social/users/eve");
    });

    it("returns undefined for unknown actor", async () => {
      const { getFollower } = await import("../followers");

      const follower = getFollower("https://mastodon.social/users/unknown");

      expect(follower).toBeUndefined();
    });
  });

  describe("getAllFollowers", () => {
    it("returns all followers", async () => {
      const { addFollower, getAllFollowers } = await import("../followers");

      addFollower({
        actor_uri: "https://mastodon.social/users/user1",
        inbox_uri: "https://mastodon.social/users/user1/inbox",
      });
      addFollower({
        actor_uri: "https://fosstodon.org/users/user2",
        inbox_uri: "https://fosstodon.org/users/user2/inbox",
      });

      const followers = getAllFollowers();

      expect(followers).toHaveLength(2);
    });

    it("returns empty array when no followers", async () => {
      const { getAllFollowers } = await import("../followers");

      const followers = getAllFollowers();

      expect(followers).toHaveLength(0);
    });
  });

  describe("getFollowerCount", () => {
    it("returns correct count", async () => {
      const { addFollower, getFollowerCount } = await import("../followers");

      expect(getFollowerCount()).toBe(0);

      addFollower({
        actor_uri: "https://mastodon.social/users/count1",
        inbox_uri: "https://mastodon.social/users/count1/inbox",
      });
      addFollower({
        actor_uri: "https://mastodon.social/users/count2",
        inbox_uri: "https://mastodon.social/users/count2/inbox",
      });

      expect(getFollowerCount()).toBe(2);
    });
  });
});
