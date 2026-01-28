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
    CREATE TABLE media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      s3_key TEXT NOT NULL UNIQUE,
      alt_text TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      excerpt TEXT,
      url TEXT,
      source_id INTEGER,
      banner_image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  testDb = drizzle(testSqlite, { schema });

  // Insert test data
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  testSqlite.exec(`
    INSERT INTO posts (id, type, title, content, excerpt, published_at, created_at, updated_at)
    VALUES (1, 'article', 'First Post', 'First post content.', 'First excerpt', ${now - day}, ${now}, ${now});

    INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
    VALUES (2, 'article', 'Second Post', 'Second post content.', ${now}, ${now}, ${now});

    INSERT INTO posts (id, type, title, content, created_at, updated_at)
    VALUES (3, 'article', 'Draft Post', 'This is a draft.', ${now}, ${now});

    INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
    VALUES (4, 'note', NULL, 'A note without title.', ${now - 2 * day}, ${now}, ${now});
  `);
});

afterAll(() => {
  testSqlite.close();
});

describe("feed routes", () => {
  let createFeedRoutes: typeof import("../feed").createFeedRoutes;

  beforeAll(async () => {
    const module = await import("../feed");
    createFeedRoutes = module.createFeedRoutes;
  });

  const getApp = () =>
    createFeedRoutes(testDb as unknown as Parameters<typeof createFeedRoutes>[0]);

  describe("GET /feed.xml", () => {
    it("returns 200 with RSS content type", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/rss+xml");
    });

    it("returns valid RSS 2.0 XML structure", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain("<channel>");
      expect(xml).toContain("</channel>");
      expect(xml).toContain("</rss>");
    });

    it("includes channel metadata", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain("<title>erikcraddock.me</title>");
      expect(xml).toContain("<description>");
      expect(xml).toContain("<language>en-us</language>");
      expect(xml).toContain("<lastBuildDate>");
    });

    it("includes atom:link for self-reference", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
      expect(xml).toContain('rel="self"');
      expect(xml).toContain("/feed.xml");
    });

    it("includes published posts as items", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain("<item>");
      expect(xml).toContain("First Post");
      expect(xml).toContain("Second Post");
    });

    it("excludes draft posts", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).not.toContain("Draft Post");
    });

    it("includes required item elements", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain("<title>");
      expect(xml).toContain("<link>");
      expect(xml).toContain("<description>");
      expect(xml).toContain("<pubDate>");
      expect(xml).toContain("<guid");
    });

    it("uses Untitled for posts without title", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      // Post 4 has no title
      expect(xml).toContain("<title>Untitled</title>");
    });

    it("escapes XML special characters", async () => {
      // Add a post with special characters
      const now = Date.now();
      testSqlite.exec(`
        INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
        VALUES (5, 'article', 'Test <>&"', 'Content with <special> chars & "quotes"', ${now}, ${now}, ${now});
      `);

      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain("&lt;");
      expect(xml).toContain("&gt;");
      expect(xml).toContain("&amp;");
    });

    it("orders posts by published_at descending", async () => {
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      // Second Post was published most recently
      const secondPostIndex = xml.indexOf("Second Post");
      const firstPostIndex = xml.indexOf("First Post");

      expect(secondPostIndex).toBeLessThan(firstPostIndex);
    });

    it("includes enclosure for posts with banner image", async () => {
      // Add media record
      testSqlite.exec(
        "INSERT INTO media (filename, mime_type, s3_key, created_at) VALUES ('feed-banner.jpg', 'image/jpeg', 'feed-banner.jpg', 1000)"
      );
      const mediaRow = testSqlite
        .prepare("SELECT id FROM media WHERE s3_key = 'feed-banner.jpg'")
        .get() as { id: number };

      // Add post with banner
      const now = Date.now();
      testSqlite.exec(
        `INSERT INTO posts (type, title, content, banner_image_id, published_at, created_at, updated_at) VALUES ('article', 'Post with Banner', 'Content', ${mediaRow.id}, ${now}, ${now}, ${now})`
      );

      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      expect(xml).toContain("<enclosure");
      expect(xml).toContain('url="https://erikcraddock.me/media/feed-banner.jpg"');
      expect(xml).toContain('type="image/jpeg"');
    });

    it("does not include enclosure for posts without banner image", async () => {
      // The existing test posts don't have banner images
      const app = getApp();
      const res = await app.request("/feed.xml");
      const xml = await res.text();

      // Get the item blocks
      const itemRegex = /<item>[\s\S]*?<\/item>/g;
      const items = xml.match(itemRegex) || [];

      // Find items that contain "First Post" or "Second Post" and check they don't have enclosures
      const existingPosts = items.filter(
        (item) =>
          item.includes("First Post") || item.includes("Second Post") || item.includes("Third Post")
      );

      for (const item of existingPosts) {
        expect(item).not.toContain("<enclosure");
      }
    });
  });
});
