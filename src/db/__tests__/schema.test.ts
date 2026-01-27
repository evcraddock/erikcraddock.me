import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { posts, tags, postTags } from "../schema";

describe("schema exports", () => {
  it("exports posts table", () => {
    expect(posts).toBeDefined();
    expect(posts.id).toBeDefined();
    expect(posts.type).toBeDefined();
    expect(posts.title).toBeDefined();
    expect(posts.content).toBeDefined();
  });

  it("exports tags table", () => {
    expect(tags).toBeDefined();
    expect(tags.id).toBeDefined();
    expect(tags.name).toBeDefined();
    expect(tags.slug).toBeDefined();
  });

  it("exports postTags junction table", () => {
    expect(postTags).toBeDefined();
    expect(postTags.post_id).toBeDefined();
    expect(postTags.tag_id).toBeDefined();
  });
});

describe("database operations", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    // Use in-memory database for tests
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });

    // Create tables
    sqlite.exec(`
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
        PRIMARY KEY (post_id, tag_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);
  });

  afterAll(() => {
    sqlite.close();
  });

  it("can insert and query posts", async () => {
    const now = new Date();

    const result = db
      .insert(posts)
      .values({
        type: "article",
        title: "Test Post",
        content: "This is test content",
        created_at: now,
        updated_at: now,
      })
      .returning()
      .get();

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.type).toBe("article");
    expect(result.title).toBe("Test Post");

    const queried = db.select().from(posts).where(eq(posts.id, 1)).get();
    expect(queried).toBeDefined();
    expect(queried?.title).toBe("Test Post");
  });

  it("can insert and query tags", async () => {
    const result = db
      .insert(tags)
      .values({
        name: "TypeScript",
        slug: "typescript",
      })
      .returning()
      .get();

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.name).toBe("TypeScript");
    expect(result.slug).toBe("typescript");

    const queried = db.select().from(tags).where(eq(tags.slug, "typescript")).get();
    expect(queried).toBeDefined();
    expect(queried?.name).toBe("TypeScript");
  });

  it("can create post-tag relationships", async () => {
    // Insert another post and tag for this test
    const post = db
      .insert(posts)
      .values({
        type: "note",
        content: "A quick note",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()
      .get();

    const tag = db
      .insert(tags)
      .values({
        name: "Quick",
        slug: "quick",
      })
      .returning()
      .get();

    // Create relationship
    db.insert(postTags)
      .values({
        post_id: post.id,
        tag_id: tag.id,
      })
      .run();

    // Query the relationship
    const relationship = db.select().from(postTags).where(eq(postTags.post_id, post.id)).get();

    expect(relationship).toBeDefined();
    expect(relationship?.post_id).toBe(post.id);
    expect(relationship?.tag_id).toBe(tag.id);
  });
});

describe("db module", () => {
  it("exports db connection", async () => {
    const { db } = await import("../index");
    expect(db).toBeDefined();
  });

  it("re-exports schema", async () => {
    const dbModule = await import("../index");
    expect(dbModule.posts).toBeDefined();
    expect(dbModule.tags).toBeDefined();
    expect(dbModule.postTags).toBeDefined();
  });
});
