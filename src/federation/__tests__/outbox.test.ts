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
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      excerpt TEXT,
      url TEXT,
      source_id INTEGER,
      banner_image_id INTEGER,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

beforeEach(() => {
  testSqlite.exec("DELETE FROM posts");
});

describe("Outbox Module", () => {
  describe("getPublishedPosts", () => {
    it("returns only published posts", async () => {
      const { getPublishedPosts } = await import("../outbox");
      const now = Date.now();

      // Insert published post
      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('article', 'Published Post', 'Content', ${now}, ${now}, ${now})
      `);

      // Insert draft post (no published_at)
      testSqlite.exec(`
        INSERT INTO posts (type, title, content, created_at, updated_at)
        VALUES ('article', 'Draft Post', 'Content', ${now}, ${now})
      `);

      const posts = getPublishedPosts();

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Published Post");
    });

    it("orders posts by published_at descending", async () => {
      const { getPublishedPosts } = await import("../outbox");
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('article', 'Old Post', 'Content', ${now - day}, ${now}, ${now})
      `);
      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('article', 'New Post', 'Content', ${now}, ${now}, ${now})
      `);

      const posts = getPublishedPosts();

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe("New Post");
      expect(posts[1].title).toBe("Old Post");
    });

    it("respects limit and offset", async () => {
      const { getPublishedPosts } = await import("../outbox");
      const now = Date.now();

      // Insert 5 posts
      for (let i = 1; i <= 5; i++) {
        testSqlite.exec(`
          INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
          VALUES ('article', 'Post ${i}', 'Content', ${now - i * 1000}, ${now}, ${now})
        `);
      }

      const firstPage = getPublishedPosts(2, 0);
      expect(firstPage).toHaveLength(2);

      const secondPage = getPublishedPosts(2, 2);
      expect(secondPage).toHaveLength(2);

      const thirdPage = getPublishedPosts(2, 4);
      expect(thirdPage).toHaveLength(1);
    });
  });

  describe("getPublishedPostCount", () => {
    it("returns count of published posts", async () => {
      const { getPublishedPostCount } = await import("../outbox");
      const now = Date.now();

      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('article', 'Post 1', 'Content', ${now}, ${now}, ${now})
      `);
      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('article', 'Post 2', 'Content', ${now}, ${now}, ${now})
      `);
      testSqlite.exec(`
        INSERT INTO posts (type, title, content, created_at, updated_at)
        VALUES ('article', 'Draft', 'Content', ${now}, ${now})
      `);

      const count = getPublishedPostCount();

      expect(count).toBe(2);
    });
  });

  describe("postToObject", () => {
    it("creates Article for posts with title", async () => {
      const { postToObject } = await import("../outbox");
      const { Article } = await import("@fedify/fedify");

      const post = {
        id: 1,
        type: "article",
        title: "My Article",
        content: "<p>Content here</p>",
        excerpt: "Summary",
        url: null,
        published_at: new Date("2025-01-15T10:00:00Z"),
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObject(post, actorUri);

      expect(object).toBeInstanceOf(Article);
      expect(object.name?.toString()).toBe("My Article");
      expect(object.content?.toString()).toBe("<p>Content here</p>");
    });

    it("creates Note for posts without title", async () => {
      const { postToObject } = await import("../outbox");
      const { Note } = await import("@fedify/fedify");

      const post = {
        id: 1,
        type: "note",
        title: null,
        content: "A short note",
        excerpt: null,
        url: null,
        published_at: new Date("2025-01-15T10:00:00Z"),
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObject(post, actorUri);

      expect(object).toBeInstanceOf(Note);
      expect(object.content?.toString()).toBe("A short note");
    });

    it("preserves original publish date", async () => {
      const { postToObject } = await import("../outbox");

      const originalDate = new Date("2020-06-15T14:30:00Z");
      const post = {
        id: 1,
        type: "article",
        title: "Old Post",
        content: "Content",
        excerpt: null,
        url: null,
        published_at: originalDate,
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObject(post, actorUri);

      // The published field should match the original date
      expect(object.published?.epochMilliseconds).toBe(originalDate.getTime());
    });
  });

  describe("postToCreateActivity", () => {
    it("wraps post in Create activity", async () => {
      const { postToCreateActivity } = await import("../outbox");
      const { Create } = await import("@fedify/fedify");

      const post = {
        id: 42,
        type: "article",
        title: "Test Post",
        content: "Content",
        excerpt: null,
        url: null,
        published_at: new Date("2025-01-15T10:00:00Z"),
      };

      const actorUri = new URL("https://example.com/users/erik");
      const activity = postToCreateActivity(post, actorUri);

      expect(activity).toBeInstanceOf(Create);
      expect(activity.actorId?.href).toBe("https://example.com/users/erik");
      expect(activity.id?.href).toContain("/posts/42#create");
    });
  });

  describe("getOutboxActivities", () => {
    it("returns Create activities for published posts", async () => {
      const { getOutboxActivities } = await import("../outbox");
      const { Create } = await import("@fedify/fedify");
      const now = Date.now();

      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('article', 'Post 1', 'Content 1', ${now}, ${now}, ${now})
      `);
      testSqlite.exec(`
        INSERT INTO posts (type, title, content, published_at, created_at, updated_at)
        VALUES ('note', NULL, 'Note content', ${now}, ${now}, ${now})
      `);

      const actorUri = new URL("https://example.com/users/erik");
      const activities = getOutboxActivities(actorUri);

      expect(activities).toHaveLength(2);
      expect(activities[0]).toBeInstanceOf(Create);
      expect(activities[1]).toBeInstanceOf(Create);
    });
  });
});
