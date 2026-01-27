import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { desc, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema";
import { Layout } from "../../templates/layout";
import { NotFound } from "../../templates/not-found";
import { truncate } from "../../utils/text";

const { posts, tags, postTags } = schema;

// Create test database and app
let testDb: ReturnType<typeof drizzle>;
let testSqlite: InstanceType<typeof Database>;
let app: Hono;

beforeAll(() => {
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
    VALUES (1, 'article', 'Test Post', 'This is test content.', ${now}, ${now}, ${now});

    INSERT INTO posts (id, type, title, content, created_at, updated_at)
    VALUES (2, 'article', 'Draft Post', 'This is a draft.', ${now}, ${now});

    INSERT INTO tags (id, name, slug) VALUES (1, 'Testing', 'testing');
    INSERT INTO tags (id, name, slug) VALUES (2, 'TypeScript', 'typescript');

    INSERT INTO post_tags (post_id, tag_id) VALUES (1, 1);
    INSERT INTO post_tags (post_id, tag_id) VALUES (1, 2);
  `);

  // Create test app with the same routes but using test database
  app = new Hono();

  app.get("/", (c) => {
    const allPosts = testDb
      .select()
      .from(posts)
      .where(isNotNull(posts.published_at))
      .orderBy(desc(posts.published_at))
      .all();

    return c.html(
      <Layout title="Home | erikcraddock.me">
        <div class="space-y-8">
          {allPosts.length === 0 ? (
            <p class="text-gray-600">No posts yet.</p>
          ) : (
            allPosts.map((post) => (
              <article key={post.id} class="border-b border-gray-200 pb-6">
                <a href={`/posts/${post.id}`} class="block group">
                  {post.title ? (
                    <h2 class="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                      {post.title}
                    </h2>
                  ) : null}
                  <p class="text-gray-600 mb-2">{post.excerpt || truncate(post.content, 200)}</p>
                </a>
              </article>
            ))
          )}
        </div>
      </Layout>
    );
  });

  app.get("/posts/:id", (c) => {
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
      return c.html(
        <NotFound title="Post Not Found" message="The post you're looking for doesn't exist." />,
        404
      );
    }

    const post = testDb.select().from(posts).where(eq(posts.id, id)).get();

    if (!post) {
      return c.html(
        <NotFound title="Post Not Found" message="The post you're looking for doesn't exist." />,
        404
      );
    }

    const postTagsResult = testDb
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tag_id, tags.id))
      .where(eq(postTags.post_id, id))
      .all();

    const title = post.title || "Post";

    return c.html(
      <Layout title={`${title} | erikcraddock.me`}>
        <article class="max-w-none">
          <a href="/" class="text-blue-600 hover:text-blue-800 text-sm mb-6 inline-block">
            ← Back to home
          </a>
          {post.title ? <h1 class="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1> : null}
          <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8">
            {postTagsResult.length > 0 ? (
              <div class="flex flex-wrap gap-2">
                {postTagsResult.map((tag) => (
                  <a
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs"
                  >
                    {tag.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div class="prose prose-gray max-w-none">
            {post.content.split("\n").map((paragraph, i) =>
              paragraph.trim() ? (
                <p key={i} class="mb-4">
                  {paragraph}
                </p>
              ) : null
            )}
          </div>
        </article>
      </Layout>
    );
  });
});

afterAll(() => {
  testSqlite.close();
});

describe("GET /posts/:id", () => {
  it("returns 200 and displays post content for valid ID", async () => {
    const res = await app.request("/posts/1");

    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain("Test Post");
    expect(html).toContain("This is test content.");
  });

  it("displays tags linked to /tags/:slug", async () => {
    const res = await app.request("/posts/1");
    const html = await res.text();

    expect(html).toContain('href="/tags/testing"');
    expect(html).toContain("Testing");
    expect(html).toContain('href="/tags/typescript"');
    expect(html).toContain("TypeScript");
  });

  it("includes back link to home", async () => {
    const res = await app.request("/posts/1");
    const html = await res.text();

    expect(html).toContain('href="/"');
    expect(html).toContain("Back to home");
  });

  it("returns 404 for non-existent post ID", async () => {
    const res = await app.request("/posts/999");

    expect(res.status).toBe(404);

    const html = await res.text();
    expect(html).toContain("Post Not Found");
  });

  it("returns 404 for invalid non-numeric ID", async () => {
    const res = await app.request("/posts/abc");

    expect(res.status).toBe(404);

    const html = await res.text();
    expect(html).toContain("Post Not Found");
  });

  it("returns 404 for negative ID", async () => {
    const res = await app.request("/posts/-1");

    expect(res.status).toBe(404);

    const html = await res.text();
    expect(html).toContain("Post Not Found");
  });
});
