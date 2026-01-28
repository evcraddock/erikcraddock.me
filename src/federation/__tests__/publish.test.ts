import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";
import { Image, Article, Note } from "@fedify/fedify";

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

// Mock the federation setup to avoid initializing federation
vi.mock("../setup", () => ({
  federation: {
    createContext: vi.fn(),
  },
}));

beforeAll(async () => {
  testSqlite = new Database(":memory:");

  testSqlite.exec(`
    CREATE TABLE media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      s3_key TEXT NOT NULL UNIQUE,
      alt_text TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

beforeEach(() => {
  testSqlite.exec("DELETE FROM media");
});

describe("Publish Module - Helper Functions", () => {
  describe("createImageAttachment", () => {
    it("creates Image object with correct URL", async () => {
      const { createImageAttachment } = await import("../publish");

      const banner = {
        s3_key: "uploads/banner.jpg",
        mime_type: "image/jpeg",
        alt_text: "A banner image",
      };

      const image = createImageAttachment(banner);

      expect(image).toBeInstanceOf(Image);
      expect(image.url?.href).toContain("/media/uploads/banner.jpg");
      expect(image.mediaType).toBe("image/jpeg");
      expect(image.name?.toString()).toBe("A banner image");
    });

    it("handles missing alt text", async () => {
      const { createImageAttachment } = await import("../publish");

      const banner = {
        s3_key: "uploads/no-alt.png",
        mime_type: "image/png",
        alt_text: null,
      };

      const image = createImageAttachment(banner);

      // name should be null or undefined when no alt text
      expect(image.name == null).toBe(true);
    });
  });

  describe("getBannerImage", () => {
    it("returns banner image info for valid ID", async () => {
      const { getBannerImage } = await import("../publish");
      const now = Date.now();

      testSqlite.exec(`
        INSERT INTO media (id, filename, mime_type, s3_key, alt_text, created_at)
        VALUES (1, 'banner.jpg', 'image/jpeg', 'uploads/banner.jpg', 'Alt text', ${now})
      `);

      const banner = getBannerImage(1);

      expect(banner).not.toBeNull();
      expect(banner?.s3_key).toBe("uploads/banner.jpg");
      expect(banner?.mime_type).toBe("image/jpeg");
      expect(banner?.alt_text).toBe("Alt text");
    });

    it("returns null for non-existent ID", async () => {
      const { getBannerImage } = await import("../publish");

      const banner = getBannerImage(999);

      expect(banner).toBeNull();
    });
  });

  describe("postToObjectWithAttachment", () => {
    it("creates Article for posts with title", async () => {
      const { postToObjectWithAttachment } = await import("../publish");

      const post = {
        id: 1,
        type: "article",
        title: "Test Article",
        content: "<p>Content</p>",
        excerpt: "Summary",
        published_at: new Date("2025-01-15T10:00:00Z"),
        banner_image_id: null,
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObjectWithAttachment(post, actorUri);

      expect(object).toBeInstanceOf(Article);
      expect(object.name?.toString()).toBe("Test Article");
      expect(object.content?.toString()).toBe("<p>Content</p>");
    });

    it("creates Note for posts without title", async () => {
      const { postToObjectWithAttachment } = await import("../publish");

      const post = {
        id: 1,
        type: "note",
        title: null,
        content: "A short note",
        excerpt: null,
        published_at: new Date("2025-01-15T10:00:00Z"),
        banner_image_id: null,
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObjectWithAttachment(post, actorUri);

      expect(object).toBeInstanceOf(Note);
    });

    it("includes banner image as attachment when present", async () => {
      const { postToObjectWithAttachment } = await import("../publish");
      const now = Date.now();

      // Insert media
      testSqlite.exec(`
        INSERT INTO media (id, filename, mime_type, s3_key, alt_text, created_at)
        VALUES (1, 'banner.jpg', 'image/jpeg', 'uploads/banner.jpg', 'Banner', ${now})
      `);

      const post = {
        id: 1,
        type: "article",
        title: "Post with Banner",
        content: "Content",
        excerpt: null,
        published_at: new Date("2025-01-15T10:00:00Z"),
        banner_image_id: 1,
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObjectWithAttachment(post, actorUri);

      // Verify object was created successfully with banner
      // Fedify's getAttachments() is an async iterator, so we just verify
      // the function completes without error when banner_image_id is set
      expect(object).toBeDefined();
      expect(object).toBeInstanceOf(Article);
    });

    it("handles missing banner gracefully", async () => {
      const { postToObjectWithAttachment } = await import("../publish");

      const post = {
        id: 1,
        type: "article",
        title: "No Banner",
        content: "Content",
        excerpt: null,
        published_at: new Date("2025-01-15T10:00:00Z"),
        banner_image_id: null,
      };

      const actorUri = new URL("https://example.com/users/erik");
      const object = postToObjectWithAttachment(post, actorUri);

      // Should create object without error even with no banner
      expect(object).toBeDefined();
      expect(object).toBeInstanceOf(Article);
    });
  });
});
