import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";

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

// Mock S3 operations
vi.mock("../s3", () => ({
  uploadFile: vi.fn().mockResolvedValue({ key: "test.jpg", url: "/media/test.jpg" }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  generateKey: vi.fn().mockReturnValue("abc123.jpg"),
}));

beforeAll(() => {
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

describe("Media Service", () => {
  beforeEach(() => {
    testSqlite.exec("DELETE FROM media");
    vi.clearAllMocks();
  });

  describe("isAllowedMimeType", () => {
    it("allows jpeg", async () => {
      const { isAllowedMimeType } = await import("../media");
      expect(isAllowedMimeType("image/jpeg")).toBe(true);
    });

    it("allows png", async () => {
      const { isAllowedMimeType } = await import("../media");
      expect(isAllowedMimeType("image/png")).toBe(true);
    });

    it("allows gif", async () => {
      const { isAllowedMimeType } = await import("../media");
      expect(isAllowedMimeType("image/gif")).toBe(true);
    });

    it("allows webp", async () => {
      const { isAllowedMimeType } = await import("../media");
      expect(isAllowedMimeType("image/webp")).toBe(true);
    });

    it("rejects pdf", async () => {
      const { isAllowedMimeType } = await import("../media");
      expect(isAllowedMimeType("application/pdf")).toBe(false);
    });

    it("rejects svg", async () => {
      const { isAllowedMimeType } = await import("../media");
      expect(isAllowedMimeType("image/svg+xml")).toBe(false);
    });
  });

  describe("mediaUrl", () => {
    it("returns /media/ prefixed path", async () => {
      const { mediaUrl } = await import("../media");
      expect(mediaUrl("abc123.jpg")).toBe("/media/abc123.jpg");
    });

    it("handles keys with path separators", async () => {
      const { mediaUrl } = await import("../media");
      expect(mediaUrl("posts/my-post/banner.jpg")).toBe("/media/posts/my-post/banner.jpg");
    });
  });

  describe("createMedia", () => {
    it("creates a media record with auto-generated key", async () => {
      const { createMedia } = await import("../media");
      const { uploadFile } = await import("../s3");

      const result = await createMedia({
        file: Buffer.from("fake image data"),
        filename: "photo.jpg",
        mimeType: "image/jpeg",
      });

      expect(result.id).toBeDefined();
      expect(result.filename).toBe("photo.jpg");
      expect(result.mime_type).toBe("image/jpeg");
      expect(result.s3_key).toBe("abc123.jpg");
      expect(result.url).toBe("/media/abc123.jpg");
      expect(uploadFile).toHaveBeenCalledWith("abc123.jpg", expect.any(Buffer), "image/jpeg");
    });

    it("creates a media record with custom key", async () => {
      const { createMedia } = await import("../media");
      const { uploadFile, generateKey } = await import("../s3");

      const result = await createMedia({
        file: Buffer.from("fake image data"),
        filename: "banner.png",
        mimeType: "image/png",
        customKey: "posts/my-post/banner.png",
      });

      expect(result.s3_key).toBe("posts/my-post/banner.png");
      expect(result.url).toBe("/media/posts/my-post/banner.png");
      expect(generateKey).not.toHaveBeenCalled();
      expect(uploadFile).toHaveBeenCalledWith(
        "posts/my-post/banner.png",
        expect.any(Buffer),
        "image/png"
      );
    });

    it("sets alt text when provided", async () => {
      const { createMedia } = await import("../media");

      const result = await createMedia({
        file: Buffer.from("fake image data"),
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        altText: "A nice photo",
      });

      expect(result.alt_text).toBe("A nice photo");
    });

    it("rejects invalid mime type", async () => {
      const { createMedia } = await import("../media");

      await expect(
        createMedia({
          file: Buffer.from("fake pdf data"),
          filename: "doc.pdf",
          mimeType: "application/pdf",
        })
      ).rejects.toThrow("Invalid file type");
    });
  });

  describe("getMedia", () => {
    it("returns media record with url", async () => {
      testSqlite.exec(
        "INSERT INTO media (filename, mime_type, s3_key, created_at) VALUES ('test.jpg', 'image/jpeg', 'get-key.jpg', 1000)"
      );
      const row = testSqlite.prepare("SELECT id FROM media WHERE s3_key = 'get-key.jpg'").get() as {
        id: number;
      };
      const { getMedia } = await import("../media");

      const result = getMedia(row.id);
      expect(result).not.toBeNull();
      expect(result!.filename).toBe("test.jpg");
      expect(result!.url).toBe("/media/get-key.jpg");
    });

    it("returns null for non-existent id", async () => {
      const { getMedia } = await import("../media");
      expect(getMedia(999)).toBeNull();
    });
  });

  describe("deleteMedia", () => {
    it("deletes record and S3 file", async () => {
      testSqlite.exec(
        "INSERT INTO media (filename, mime_type, s3_key, created_at) VALUES ('test.jpg', 'image/jpeg', 'del-key.jpg', 1000)"
      );
      const { deleteMedia, getMedia } = await import("../media");
      const { deleteFile } = await import("../s3");

      // Get the ID of the inserted record
      const row = testSqlite.prepare("SELECT id FROM media WHERE s3_key = 'del-key.jpg'").get() as {
        id: number;
      };

      const result = await deleteMedia(row.id);
      expect(result).toBe(true);
      expect(deleteFile).toHaveBeenCalledWith("del-key.jpg");
      expect(getMedia(row.id)).toBeNull();
    });

    it("returns false for non-existent id", async () => {
      const { deleteMedia } = await import("../media");
      const result = await deleteMedia(999);
      expect(result).toBe(false);
    });
  });
});
