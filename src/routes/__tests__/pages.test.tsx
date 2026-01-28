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

    CREATE TABLE sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      feed_url TEXT
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

    INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
    VALUES (3, 'article', 'Another Post', 'Another post content.', ${now}, ${now}, ${now});

    INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
    VALUES (4, 'note', NULL, 'Short note content 🚀', ${now}, ${now}, ${now});

    INSERT INTO posts (id, type, title, content, published_at, created_at, updated_at)
    VALUES (5, 'note', NULL, '${"x".repeat(300)}', ${now}, ${now}, ${now});

    INSERT INTO tags (id, name, slug) VALUES (1, 'Testing', 'testing');
    INSERT INTO tags (id, name, slug) VALUES (2, 'TypeScript', 'typescript');
    INSERT INTO tags (id, name, slug) VALUES (3, 'Empty Tag', 'empty-tag');

    INSERT INTO post_tags (post_id, tag_id) VALUES (1, 1);
    INSERT INTO post_tags (post_id, tag_id) VALUES (1, 2);
    INSERT INTO post_tags (post_id, tag_id) VALUES (2, 1);
    INSERT INTO post_tags (post_id, tag_id) VALUES (3, 2);

    INSERT INTO sources (id, name, url, feed_url) VALUES (1, 'Test Blog', 'https://example.com', 'https://example.com/feed.xml');
    INSERT INTO sources (id, name, url, feed_url) VALUES (2, 'Another Site', 'https://another.example.com', NULL);
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

    it("includes navigation links to About and Sources", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).toContain('href="/about"');
      expect(html).toContain('href="/sources"');
    });
  });

  describe("GET /about", () => {
    it("returns 200 and displays about page", async () => {
      const app = getApp();
      const res = await app.request("/about");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("About");
      expect(html).toContain("Erik Craddock");
    });

    it("includes ActivityPub follow information", async () => {
      const app = getApp();
      const res = await app.request("/about");
      const html = await res.text();

      expect(html).toContain("@erik@erikcraddock.me");
      expect(html).toContain("Fediverse");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/about");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
    });
  });

  describe("GET /sources", () => {
    it("returns 200 and displays sources page", async () => {
      const app = getApp();
      const res = await app.request("/sources");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Sources");
    });

    it("lists sources from database", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("Test Blog");
      expect(html).toContain("https://example.com");
      expect(html).toContain("Another Site");
    });

    it("shows RSS link for sources with feed_url", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("RSS");
      expect(html).toContain("https://example.com/feed.xml");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
      expect(html).toContain("dark:text-blue-400");
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

    it("displays banner image when set", async () => {
      // Add media record
      testSqlite.exec(
        "INSERT INTO media (filename, mime_type, s3_key, created_at) VALUES ('page-banner.jpg', 'image/jpeg', 'page-banner.jpg', 1000)"
      );
      const mediaRow = testSqlite
        .prepare("SELECT id FROM media WHERE s3_key = 'page-banner.jpg'")
        .get() as { id: number };

      // Add post with banner
      const now = Date.now();
      testSqlite.exec(
        `INSERT INTO posts (type, title, content, banner_image_id, published_at, created_at, updated_at) VALUES ('article', 'Banner Post', 'Content here', ${mediaRow.id}, ${now}, ${now}, ${now})`
      );
      const postRow = testSqlite
        .prepare("SELECT id FROM posts WHERE title = 'Banner Post'")
        .get() as { id: number };

      const app = getApp();
      const res = await app.request(`/posts/${postRow.id}`);

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('src="/media/page-banner.jpg"');
      expect(html).toContain('alt="Banner Post"');
    });

    it("includes og:image meta tag when banner is set", async () => {
      // Add media record
      testSqlite.exec(
        "INSERT INTO media (filename, mime_type, s3_key, created_at) VALUES ('og-banner.jpg', 'image/jpeg', 'og-banner.jpg', 1000)"
      );
      const mediaRow = testSqlite
        .prepare("SELECT id FROM media WHERE s3_key = 'og-banner.jpg'")
        .get() as { id: number };

      // Add post with banner
      const now = Date.now();
      testSqlite.exec(
        `INSERT INTO posts (type, title, content, banner_image_id, published_at, created_at, updated_at) VALUES ('article', 'OG Banner Post', 'Content here', ${mediaRow.id}, ${now}, ${now}, ${now})`
      );
      const postRow = testSqlite
        .prepare("SELECT id FROM posts WHERE title = 'OG Banner Post'")
        .get() as { id: number };

      const app = getApp();
      const res = await app.request(`/posts/${postRow.id}`);

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('property="og:image"');
      expect(html).toContain("/media/og-banner.jpg");
    });

    it("does not display banner image when not set", async () => {
      const app = getApp();

      // Use existing post without banner (from test setup)
      const postRow = testSqlite
        .prepare("SELECT id FROM posts WHERE title = 'Test Post'")
        .get() as { id: number };

      const res = await app.request(`/posts/${postRow.id}`);

      expect(res.status).toBe(200);

      const html = await res.text();
      // Should not have a banner image element before the title
      expect(html).not.toContain('class="w-full h-64 object-cover');
    });
  });

  describe("GET /tags/:slug", () => {
    it("returns 200 and displays tag name as heading", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");

      expect(res.status).toBe(200);

      const html = await res.text();
      // Quotes are HTML-escaped as &quot;
      expect(html).toContain("Posts tagged");
      expect(html).toContain("Testing");
    });

    it("displays only published posts with that tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      // Post 1 is published and has "testing" tag
      expect(html).toContain("Test Post");
      // Post 2 is a draft with "testing" tag - should NOT appear
      expect(html).not.toContain("Draft Post");
    });

    it("shows posts filtered by tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/typescript");
      const html = await res.text();

      // Posts 1 and 3 have "typescript" tag
      expect(html).toContain("Test Post");
      expect(html).toContain("Another Post");
    });

    it("includes back link to home", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      expect(html).toContain('href="/"');
      expect(html).toContain("Back to home");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
      expect(html).toContain("dark:border-gray-700");
    });

    it("shows empty message for tag with no published posts", async () => {
      const app = getApp();
      const res = await app.request("/tags/empty-tag");

      expect(res.status).toBe(200);

      const html = await res.text();
      // Quotes are HTML-escaped as &quot;
      expect(html).toContain("No posts tagged");
      expect(html).toContain("Empty Tag");
      expect(html).toContain("yet.");
    });

    it("returns 404 for non-existent tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/nonexistent");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Tag Not Found");
    });
  });

  describe("Note posts", () => {
    describe("GET / (home page)", () => {
      it("displays short notes with full content", async () => {
        const app = getApp();
        const res = await app.request("/");
        const html = await res.text();

        // Short note should show full content
        expect(html).toContain("Short note content 🚀");
      });

      it("displays notes with left border styling", async () => {
        const app = getApp();
        const res = await app.request("/");
        const html = await res.text();

        // Notes should have left border class
        expect(html).toContain("border-l-2");
        expect(html).toContain("border-l-gray-300");
      });

      it("truncates long notes with ellipsis", async () => {
        const app = getApp();
        const res = await app.request("/");
        const html = await res.text();

        // Long note (300 chars of 'x') should be truncated
        // Should not contain all 300 x's, but should have truncated version
        expect(html).not.toContain("x".repeat(300));
        expect(html).toContain("…"); // Ellipsis for truncated content
      });
    });

    describe("GET /posts/:id (single note page)", () => {
      it("displays note with left border styling", async () => {
        const app = getApp();
        const res = await app.request("/posts/4");
        const html = await res.text();

        expect(res.status).toBe(200);
        expect(html).toContain("border-l-4");
        expect(html).toContain("border-l-gray-300");
      });

      it("displays full note content", async () => {
        const app = getApp();
        const res = await app.request("/posts/4");
        const html = await res.text();

        expect(html).toContain("Short note content 🚀");
      });

      it("uses 'Note' as title fallback in page title", async () => {
        const app = getApp();
        const res = await app.request("/posts/4");
        const html = await res.text();

        // The <title> should contain "Note" since notes don't have titles
        expect(html).toContain("<title>Note | erikcraddock.me</title>");
      });

      it("does not display title heading for notes", async () => {
        const app = getApp();
        const res = await app.request("/posts/4");
        const html = await res.text();

        // Should not have an h1 with "Short note content" (that's content, not title)
        // Notes have no title, so there shouldn't be a title heading
        expect(html).not.toContain("<h1");
      });
    });
  });
});
