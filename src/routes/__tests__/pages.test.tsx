import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";

// Create test database before mocking
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testSqlite: InstanceType<typeof Database>;

// Mock the db module to use our test database
vi.mock("../../db", async () => {
  const schema = await import("../../db/schema");
  return {
    db: testDb,
    ...schema,
  };
});

beforeAll(async () => {
  // Create in-memory database for tests
  testSqlite = new Database(":memory:");

  // Create tables
  testSqlite.exec(`
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
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id)
    );
  `);

  testDb = drizzle(testSqlite, { schema });

  // Insert test data
  const now = Date.now();
  testSqlite.exec(`
    INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
    VALUES (1, 'article', 'Test Post', 'This is test content with **markdown**.', ${now}, ${now}, ${now});

    INSERT INTO posts (id, type, title, content, created_at, updated_at)
    VALUES (2, 'article', 'Draft Post', 'This is a draft.', ${now}, ${now});

    INSERT INTO tags (id, name, slug) VALUES (1, 'Testing', 'testing');
    INSERT INTO tags (id, name, slug) VALUES (2, 'TypeScript', 'typescript');

    INSERT INTO post_tags (post_id, tag_id) VALUES (1, 1);
    INSERT INTO post_tags (post_id, tag_id) VALUES (1, 2);
  `);
});

afterAll(() => {
  testSqlite.close();
});

describe("pages routes", () => {
  // Import after mock is set up - use dynamic import
  let createPagesRoutes: typeof import("../pages").createPagesRoutes;

  beforeAll(async () => {
    const module = await import("../pages");
    createPagesRoutes = module.createPagesRoutes;
  });

  // Cast through unknown to satisfy TypeScript - the drizzle APIs are compatible at runtime
  const getApp = () =>
    createPagesRoutes(testDb as unknown as Parameters<typeof createPagesRoutes>[0]);

  describe("GET /", () => {
    it("returns 200 and displays published posts", async () => {
      const app = getApp();
      const res = await app.request("/");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Post");
      expect(html).toContain("This is test content");
    });

    it("excludes draft posts (no published_at)", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).not.toContain("Draft Post");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
      expect(html).toContain("dark:border-gray-700");
    });
  });

  describe("GET /posts/:id", () => {
    it("returns 200 and displays post content for valid ID", async () => {
      const app = getApp();
      const res = await app.request("/posts/1");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Post");
      expect(html).toContain("test content");
    });

    it("renders markdown content", async () => {
      const app = getApp();
      const res = await app.request("/posts/1");
      const html = await res.text();

      // Markdown **bold** should render as <strong>
      expect(html).toContain("<strong>markdown</strong>");
    });

    it("displays tags linked to /tags/:slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/1");
      const html = await res.text();

      expect(html).toContain('href="/tags/testing"');
      expect(html).toContain("Testing");
      expect(html).toContain('href="/tags/typescript"');
      expect(html).toContain("TypeScript");
    });

    it("includes back link to home", async () => {
      const app = getApp();
      const res = await app.request("/posts/1");
      const html = await res.text();

      expect(html).toContain('href="/"');
      expect(html).toContain("Back to home");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/posts/1");
      const html = await res.text();

      expect(html).toContain("dark:text-blue-400");
      expect(html).toContain("dark:bg-gray-700");
      expect(html).toContain("dark:text-gray-300");
    });

    it("returns 404 for non-existent post ID", async () => {
      const app = getApp();
      const res = await app.request("/posts/999");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Post Not Found");
    });

    it("returns 404 for invalid non-numeric ID", async () => {
      const app = getApp();
      const res = await app.request("/posts/abc");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Post Not Found");
    });

    it("returns 404 for negative ID", async () => {
      const app = getApp();
      const res = await app.request("/posts/-1");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Post Not Found");
    });
  });
});
