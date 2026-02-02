/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeAll } from "bun:test";
import { mock } from "bun:test";
import { createTestDb } from "../../db/test-utils";
import { posts, tags, postTags, sources, media } from "../../db/schema";

// Create test db immediately
const testDb = createTestDb();

// Mock the db module
mock.module("../../db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

// Set up test data
const now = new Date();

testDb
  .insert(posts)
  .values([
    {
      id: 1,
      slug: "test-post",
      type: "article",
      title: "Test Post",
      content: "This is test content with **markdown**.",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      slug: "draft-post",
      type: "article",
      title: "Draft Post",
      content: "This is a draft.",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      slug: "another-post",
      type: "article",
      title: "Another Post",
      content: "Another post content.",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      slug: "short-note",
      type: "note",
      title: null,
      content: "Short note content 🚀",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      slug: "long-note",
      type: "note",
      title: null,
      content: "x".repeat(300),
      published_at: now,
      created_at: now,
      updated_at: now,
    },
  ])
  .run();

testDb
  .insert(tags)
  .values([
    { id: 1, name: "Testing", slug: "testing" },
    { id: 2, name: "TypeScript", slug: "typescript" },
    { id: 3, name: "Empty Tag", slug: "empty-tag" },
  ])
  .run();

testDb
  .insert(postTags)
  .values([
    { post_id: 1, tag_id: 1 },
    { post_id: 1, tag_id: 2 },
    { post_id: 2, tag_id: 1 },
    { post_id: 3, tag_id: 2 },
  ])
  .run();

testDb
  .insert(sources)
  .values([
    {
      id: 1,
      name: "Test Blog",
      url: "https://example.com",
      feed_url: "https://example.com/feed.xml",
    },
    { id: 2, name: "Another Site", url: "https://another.example.com", feed_url: null },
  ])
  .run();

describe("pages routes", () => {
  let createPagesRoutes: typeof import("../pages").createPagesRoutes;

  beforeAll(async () => {
    const module = await import("../pages");
    createPagesRoutes = module.createPagesRoutes;
  });

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

    it("includes navigation link to Sources", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).toContain('href="/sources"');
      // About link removed from nav but page still accessible
      expect(html).not.toContain('href="/about"');
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

  describe("GET /posts/:slug", () => {
    it("returns 200 and displays post content for valid slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Post");
      expect(html).toContain("test content");
    });

    it("renders markdown content", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain("<strong>markdown</strong>");
    });

    it("displays tags linked to /tags/:slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain('href="/tags/testing"');
      expect(html).toContain("Testing");
      expect(html).toContain('href="/tags/typescript"');
      expect(html).toContain("TypeScript");
    });

    it("includes back link to home", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain('href="/"');
      expect(html).toContain("Back to home");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain("dark:text-blue-400");
      expect(html).toContain("dark:bg-gray-700");
      expect(html).toContain("dark:text-gray-300");
    });

    it("returns 404 for non-existent slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/does-not-exist");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Post Not Found");
    });

    it("displays banner image when set", async () => {
      testDb
        .insert(media)
        .values({
          filename: "page-banner.jpg",
          mime_type: "image/jpeg",
          s3_key: "page-banner.jpg",
          created_at: new Date(),
        })
        .run();

      const mediaRow = testDb
        .select()
        .from(media)
        .all()
        .find((m) => m.s3_key === "page-banner.jpg")!;

      const now = new Date();
      testDb
        .insert(posts)
        .values({
          slug: "banner-post",
          type: "article",
          title: "Banner Post",
          content: "Content here",
          banner_image_id: mediaRow.id,
          published_at: now,
          created_at: now,
          updated_at: now,
        })
        .run();

      const app = getApp();
      const res = await app.request("/posts/banner-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('src="/media/page-banner.jpg"');
      expect(html).toContain('alt="Banner Post"');
    });

    it("includes og:image meta tag when banner is set", async () => {
      testDb
        .insert(media)
        .values({
          filename: "og-banner.jpg",
          mime_type: "image/jpeg",
          s3_key: "og-banner.jpg",
          created_at: new Date(),
        })
        .run();

      const mediaRow = testDb
        .select()
        .from(media)
        .all()
        .find((m) => m.s3_key === "og-banner.jpg")!;

      const now = new Date();
      testDb
        .insert(posts)
        .values({
          slug: "og-banner-post",
          type: "article",
          title: "OG Banner Post",
          content: "Content here",
          banner_image_id: mediaRow.id,
          published_at: now,
          created_at: now,
          updated_at: now,
        })
        .run();

      const app = getApp();
      const res = await app.request("/posts/og-banner-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('property="og:image"');
      expect(html).toContain("/media/og-banner.jpg");
    });

    it("does not display banner image when not set", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).not.toContain('class="w-full h-64 object-cover');
    });
  });

  describe("GET /tags/:slug", () => {
    it("returns 200 and displays tag name as heading", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Posts tagged");
      expect(html).toContain("Testing");
    });

    it("displays only published posts with that tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      expect(html).toContain("Test Post");
      expect(html).not.toContain("Draft Post");
    });

    it("shows posts filtered by tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/typescript");
      const html = await res.text();

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

        expect(html).toContain("Short note content 🚀");
      });

      it("displays notes with left border styling", async () => {
        const app = getApp();
        const res = await app.request("/");
        const html = await res.text();

        expect(html).toContain("border-l-2");
        expect(html).toContain("border-l-gray-300");
      });

      it("truncates long notes with ellipsis", async () => {
        const app = getApp();
        const res = await app.request("/");
        const html = await res.text();

        expect(html).not.toContain("x".repeat(300));
        expect(html).toContain("…");
      });
    });

    describe("GET /posts/:slug (single note page)", () => {
      it("displays note with left border styling", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(res.status).toBe(200);
        expect(html).toContain("border-l-4");
        expect(html).toContain("border-l-gray-300");
      });

      it("displays full note content", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(html).toContain("Short note content 🚀");
      });

      it("uses 'Note' as title fallback in page title", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(html).toContain("<title>Note | erikcraddock.me</title>");
      });

      it("does not display title heading for notes", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(html).not.toContain("<h1");
      });
    });
  });
});
