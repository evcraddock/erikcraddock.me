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
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      excerpt TEXT,
      url TEXT,
      source_id INTEGER,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE post_tags (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

describe("GET /api/posts", () => {
  let testApiKey: string;

  beforeEach(async () => {
    // Clean up
    testSqlite.exec("DELETE FROM post_tags");
    testSqlite.exec("DELETE FROM tags");
    testSqlite.exec("DELETE FROM posts");
    testSqlite.exec("DELETE FROM api_keys");
    testSqlite.exec("DELETE FROM authors");

    // Create test author
    const author = testSqlite
      .prepare(
        "INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id"
      )
      .get("test@example.com", "Test User", Date.now()) as { id: number };

    // Create API key (we need to hash it the same way the app does)
    const { hashToken } = await import("../../auth/crypto");
    testApiKey = "ek_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const keyHash = await hashToken(testApiKey);

    testSqlite
      .prepare("INSERT INTO api_keys (author_id, key_hash, name, created_at) VALUES (?, ?, ?, ?)")
      .run(author.id, keyHash, "Test Key", Date.now());
  });

  it("returns empty array when no posts", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: [] });
  });

  it("returns published posts", async () => {
    // Create a published post
    const now = Date.now();
    testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, excerpt, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run("article", "Test Post", "Content here", "Excerpt here", now, now, now);

    const { api } = await import("../api");

    const res = await api.request("/posts", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Test Post");
    expect(json.data[0].type).toBe("article");
    expect(json.data[0].excerpt).toBe("Excerpt here");
    expect(json.data[0].tags).toEqual([]);
  });

  it("excludes unpublished posts", async () => {
    const now = Date.now();
    // Published post
    testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run("article", "Published", "Content", now, now, now);
    // Unpublished post (no published_at)
    testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run("article", "Draft", "Content", now, now);

    const { api } = await import("../api");

    const res = await api.request("/posts", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Published");
  });

  it("filters by type", async () => {
    const now = Date.now();
    testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run("article", "Article Post", "Content", now, now, now);
    testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run("note", "Note Post", "Content", now, now, now);

    const { api } = await import("../api");

    const res = await api.request("/posts?type=article", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Article Post");
  });

  it("returns 400 for invalid type", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts?type=invalid", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid type");
  });

  it("filters by tag", async () => {
    const now = Date.now();
    // Create posts
    const post1 = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Tagged Post", "Content", now, now, now) as { id: number };
    testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run("article", "Untagged Post", "Content", now, now, now);

    // Create tag
    const tag = testSqlite
      .prepare("INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id")
      .get("JavaScript", "javascript") as { id: number };

    // Link post to tag
    testSqlite
      .prepare("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)")
      .run(post1.id, tag.id);

    const { api } = await import("../api");

    const res = await api.request("/posts?tag=javascript", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Tagged Post");
    expect(json.data[0].tags).toContain("JavaScript");
  });

  it("returns empty for non-existent tag", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts?tag=nonexistent", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("respects limit param", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      testSqlite
        .prepare(
          "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run("article", `Post ${i}`, "Content", now - i * 1000, now, now);
    }

    const { api } = await import("../api");

    const res = await api.request("/posts?limit=3", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data).toHaveLength(3);
  });

  it("returns 400 for invalid limit", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts?limit=0", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid limit");
  });

  it("returns 401 without API key", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts");

    expect(res.status).toBe(401);
  });
});
