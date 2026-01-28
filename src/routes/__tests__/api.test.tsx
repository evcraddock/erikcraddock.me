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

  it("applies limit after tag filtering", async () => {
    const now = Date.now();
    // Create 5 posts, only 3 tagged
    const tag = testSqlite
      .prepare("INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id")
      .get("TestTag", "testtag") as { id: number };

    for (let i = 0; i < 5; i++) {
      const post = testSqlite
        .prepare(
          "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
        )
        .get("article", `Post ${i}`, "Content", now - i * 1000, now, now) as { id: number };

      // Tag first 3 posts
      if (i < 3) {
        testSqlite.prepare("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)").run(post.id, tag.id);
      }
    }

    const { api } = await import("../api");

    // Request with limit=2 and tag filter
    // Should return 2 posts (not 0-2 due to incorrect limit placement)
    const res = await api.request("/posts?tag=testtag&limit=2", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    // All returned posts should have the tag
    expect(json.data.every((p: { tags: string[] }) => p.tags.includes("TestTag"))).toBe(true);
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

describe("GET /api/posts/:id", () => {
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
      .prepare("INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id")
      .get("test@example.com", "Test User", Date.now()) as { id: number };

    // Create API key
    const { hashToken } = await import("../../auth/crypto");
    testApiKey = "ek_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const keyHash = await hashToken(testApiKey);

    testSqlite
      .prepare("INSERT INTO api_keys (author_id, key_hash, name, created_at) VALUES (?, ?, ?, ?)")
      .run(author.id, keyHash, "Test Key", Date.now());
  });

  it("returns single post with full content", async () => {
    const now = Date.now();
    const post = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, excerpt, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Test Post", "Full content here", "Excerpt", now, now, now) as { id: number };

    const { api } = await import("../api");

    const res = await api.request(`/posts/${post.id}`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(post.id);
    expect(json.data.title).toBe("Test Post");
    expect(json.data.content).toBe("Full content here");
    expect(json.data.excerpt).toBe("Excerpt");
    expect(json.data.tags).toEqual([]);
  });

  it("includes tags in response", async () => {
    const now = Date.now();
    const post = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Tagged Post", "Content", now, now, now) as { id: number };

    const tag = testSqlite
      .prepare("INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id")
      .get("JavaScript", "javascript") as { id: number };

    testSqlite.prepare("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)").run(post.id, tag.id);

    const { api } = await import("../api");

    const res = await api.request(`/posts/${post.id}`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const json = await res.json();
    expect(json.data.tags).toContain("JavaScript");
  });

  it("returns 404 for non-existent post", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/99999", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Post not found");
  });

  it("returns 400 for invalid ID", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/abc", {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid post ID");
  });

  it("returns 401 without API key", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/1");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/posts", () => {
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
      .prepare("INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id")
      .get("test@example.com", "Test User", Date.now()) as { id: number };

    // Create API key
    const { hashToken } = await import("../../auth/crypto");
    testApiKey = "ek_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const keyHash = await hashToken(testApiKey);

    testSqlite
      .prepare("INSERT INTO api_keys (author_id, key_hash, name, created_at) VALUES (?, ?, ?, ?)")
      .run(author.id, keyHash, "Test Key", Date.now());
  });

  it("creates an article post", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "article",
        title: "My Article",
        content: "This is the content",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.type).toBe("article");
    expect(json.data.title).toBe("My Article");
    expect(json.data.content).toBe("This is the content");
    expect(json.data.id).toBeGreaterThan(0);
  });

  it("creates a note without title", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "note",
        content: "Just a quick thought",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.type).toBe("note");
    expect(json.data.title).toBeNull();
  });

  it("creates a link post with url", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "link",
        title: "Cool Link",
        content: "Check this out",
        url: "https://example.com",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.type).toBe("link");
    expect(json.data.url).toBe("https://example.com");
  });

  it("auto-generates excerpt if not provided", async () => {
    const { api } = await import("../api");
    const longContent = "A".repeat(250);

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "note",
        content: longContent,
      }),
    });

    const json = await res.json();
    expect(json.data.excerpt).toBe("A".repeat(200) + "...");
  });

  it("creates tags if they don't exist", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "article",
        title: "Tagged Post",
        content: "Content here",
        tags: ["javascript", "web-dev"],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.tags).toContain("Javascript");
    expect(json.data.tags).toContain("Web Dev");

    // Verify tags were created in DB
    const jsTag = testSqlite.prepare("SELECT * FROM tags WHERE slug = ?").get("javascript");
    expect(jsTag).toBeDefined();
  });

  it("returns 400 for missing type", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "No type provided",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("type");
  });

  it("returns 400 for missing content", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "note",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Content");
  });

  it("returns 400 for article without title", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "article",
        content: "Content but no title",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Title");
  });

  it("returns 400 for link without url", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "link",
        title: "A Link",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("URL");
  });

  it("returns 401 without API key", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", content: "test" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("PUT /api/posts/:id", () => {
  let testApiKey: string;

  beforeEach(async () => {
    testSqlite.exec("DELETE FROM post_tags");
    testSqlite.exec("DELETE FROM tags");
    testSqlite.exec("DELETE FROM posts");
    testSqlite.exec("DELETE FROM api_keys");
    testSqlite.exec("DELETE FROM authors");

    const author = testSqlite
      .prepare("INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id")
      .get("test@example.com", "Test User", Date.now()) as { id: number };

    const { hashToken } = await import("../../auth/crypto");
    testApiKey = "ek_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const keyHash = await hashToken(testApiKey);

    testSqlite
      .prepare("INSERT INTO api_keys (author_id, key_hash, name, created_at) VALUES (?, ?, ?, ?)")
      .run(author.id, keyHash, "Test Key", Date.now());
  });

  it("updates post title", async () => {
    const now = Date.now();
    const post = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Old Title", "Content", now, now) as { id: number };

    const { api } = await import("../api");

    const res = await api.request(`/posts/${post.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "New Title" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.title).toBe("New Title");
    expect(json.data.content).toBe("Content"); // Unchanged
  });

  it("updates post tags", async () => {
    const now = Date.now();
    const post = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Title", "Content", now, now) as { id: number };

    const { api } = await import("../api");

    const res = await api.request(`/posts/${post.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags: ["new-tag"] }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.tags).toContain("New Tag");
  });

  it("returns 404 for non-existent post", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/99999", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "New Title" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 without API key", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/posts/:id", () => {
  let testApiKey: string;

  beforeEach(async () => {
    testSqlite.exec("DELETE FROM post_tags");
    testSqlite.exec("DELETE FROM tags");
    testSqlite.exec("DELETE FROM posts");
    testSqlite.exec("DELETE FROM api_keys");
    testSqlite.exec("DELETE FROM authors");

    const author = testSqlite
      .prepare("INSERT INTO authors (email, display_name, created_at) VALUES (?, ?, ?) RETURNING id")
      .get("test@example.com", "Test User", Date.now()) as { id: number };

    const { hashToken } = await import("../../auth/crypto");
    testApiKey = "ek_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const keyHash = await hashToken(testApiKey);

    testSqlite
      .prepare("INSERT INTO api_keys (author_id, key_hash, name, created_at) VALUES (?, ?, ?, ?)")
      .run(author.id, keyHash, "Test Key", Date.now());
  });

  it("deletes post", async () => {
    const now = Date.now();
    const post = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Title", "Content", now, now) as { id: number };

    const { api } = await import("../api");

    const res = await api.request(`/posts/${post.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(204);

    // Verify deleted
    const deleted = testSqlite.prepare("SELECT * FROM posts WHERE id = ?").get(post.id);
    expect(deleted).toBeUndefined();
  });

  it("deletes tag associations", async () => {
    const now = Date.now();
    const post = testSqlite
      .prepare(
        "INSERT INTO posts (type, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id"
      )
      .get("article", "Title", "Content", now, now) as { id: number };

    const tag = testSqlite
      .prepare("INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id")
      .get("Test", "test") as { id: number };

    testSqlite.prepare("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)").run(post.id, tag.id);

    const { api } = await import("../api");

    await api.request(`/posts/${post.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    // Verify tag association deleted
    const assoc = testSqlite.prepare("SELECT * FROM post_tags WHERE post_id = ?").get(post.id);
    expect(assoc).toBeUndefined();
  });

  it("returns 404 for non-existent post", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/99999", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 without API key", async () => {
    const { api } = await import("../api");

    const res = await api.request("/posts/1", {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });
});
