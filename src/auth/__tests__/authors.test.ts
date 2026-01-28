import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
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
  testSqlite = new Database(":memory:");

  testSqlite.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);

  testDb = drizzle(testSqlite, { schema });
});

afterAll(() => {
  testSqlite.close();
});

describe("Authors", () => {
  beforeEach(() => {
    testSqlite.exec("DELETE FROM authors");
  });

  describe("listAuthors", () => {
    it("returns empty list when no authors exist", async () => {
      const { listAuthors } = await import("../authors");
      const result = listAuthors();
      expect(result).toEqual([]);
    });

    it("returns all authors", async () => {
      testSqlite.exec(
        "INSERT INTO authors (email, created_at) VALUES ('a@test.com', 1000), ('b@test.com', 2000)"
      );
      const { listAuthors } = await import("../authors");
      const result = listAuthors();
      expect(result).toHaveLength(2);
    });
  });

  describe("addAuthor", () => {
    it("adds a new author", async () => {
      const { addAuthor } = await import("../authors");
      const result = addAuthor("new@test.com");
      expect(result).not.toBeNull();
      expect(result!.email).toBe("new@test.com");
    });

    it("normalizes email to lowercase", async () => {
      const { addAuthor } = await import("../authors");
      const result = addAuthor("  User@Test.COM  ");
      expect(result).not.toBeNull();
      expect(result!.email).toBe("user@test.com");
    });

    it("returns null for duplicate email", async () => {
      const { addAuthor } = await import("../authors");
      addAuthor("dup@test.com");
      const result = addAuthor("dup@test.com");
      expect(result).toBeNull();
    });

    it("returns null for invalid email", async () => {
      const { addAuthor } = await import("../authors");
      expect(addAuthor("")).toBeNull();
      expect(addAuthor("notanemail")).toBeNull();
    });
  });

  describe("deleteAuthor", () => {
    it("deletes an author by ID", async () => {
      const { addAuthor, deleteAuthor, listAuthors } = await import("../authors");
      const author = addAuthor("delete-me@test.com");
      expect(author).not.toBeNull();

      const result = deleteAuthor(author!.id, "admin@test.com");
      expect(result).toBe(true);
      expect(listAuthors()).toHaveLength(0);
    });

    it("returns false when deleting own email", async () => {
      const { addAuthor, deleteAuthor } = await import("../authors");
      const author = addAuthor("admin@test.com");
      expect(author).not.toBeNull();

      const result = deleteAuthor(author!.id, "admin@test.com");
      expect(result).toBe(false);
    });

    it("returns false for non-existent author", async () => {
      const { deleteAuthor } = await import("../authors");
      const result = deleteAuthor(999, "admin@test.com");
      expect(result).toBe(false);
    });
  });
});
