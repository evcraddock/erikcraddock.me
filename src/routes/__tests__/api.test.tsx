import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { posts, sources, tags, postTags } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema";

let testDb: ReturnType<typeof drizzle<typeof schema>>;

vi.mock("@/db", async () => {
  const schema = await import("../../db/schema");
  return {
    get db() {
      return testDb;
    },
    ...schema,
  };
});

// Mock API key middleware to bypass auth in tests
vi.mock("@/auth/api-key", async () => {
  const actual = await vi.importActual("@/auth/api-key");
  return {
    ...actual,
    requireApiKey: async (
      c: { set: (key: string, value: unknown) => void },
      next: () => Promise<void>
    ) => {
      c.set("apiAuth", { email: "test@example.com" });
      await next();
    },
  };
});

beforeAll(async () => {
  testDb = createTestDb();
});

beforeEach(() => {
  testDb.delete(posts).run();
});

// Headers for requests (auth is mocked but included for documentation)
const authHeader = { Authorization: "Bearer ek_test" };

describe("POST /api/posts - slug validation", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("rejects missing slug", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Slug is required");
  });

  it("rejects empty slug", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Slug is required");
  });

  it("rejects invalid slug format - uppercase", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "Invalid-Slug",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid slug format");
  });

  it("rejects invalid slug format - spaces", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "invalid slug",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid slug format");
  });

  it("rejects invalid slug format - special chars", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "invalid_slug!",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid slug format");
  });

  it("rejects slug over 200 characters", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "a".repeat(201),
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("200 characters");
  });

  it("rejects duplicate slug", async () => {
    // Create first post
    testDb
      .insert(posts)
      .values({
        slug: "existing-post",
        type: "article",
        title: "Existing",
        content: "Content",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "existing-post",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Slug already exists");
  });

  it("accepts valid slug", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "valid-slug-123",
        title: "Test",
        content: "Content",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.slug).toBe("valid-slug-123");
  });
});

describe("GET /api/posts/by-slug/:slug", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("returns post by slug", async () => {
    testDb
      .insert(posts)
      .values({
        slug: "test-post",
        type: "article",
        title: "Test Post",
        content: "Content here",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts/by-slug/test-post", {
      headers: authHeader,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.slug).toBe("test-post");
    expect(json.data.title).toBe("Test Post");
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.request("/posts/by-slug/does-not-exist", {
      headers: authHeader,
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Post not found");
  });
});

describe("PUT /api/posts/by-slug/:slug", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("updates post by slug", async () => {
    testDb
      .insert(posts)
      .values({
        slug: "update-me",
        type: "article",
        title: "Original Title",
        content: "Original content",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts/by-slug/update-me", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Title",
        content: "Updated content",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.title).toBe("Updated Title");
    expect(json.data.content).toBe("Updated content");
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.request("/posts/by-slug/does-not-exist", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/posts/by-slug/:slug", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("deletes post by slug", async () => {
    testDb
      .insert(posts)
      .values({
        slug: "delete-me",
        type: "article",
        title: "Delete Me",
        content: "Content",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts/by-slug/delete-me", {
      method: "DELETE",
      headers: authHeader,
    });

    expect(res.status).toBe(204);

    // Verify deleted
    const post = testDb.select().from(posts).where(eq(posts.slug, "delete-me")).get();
    expect(post).toBeUndefined();
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.request("/posts/by-slug/does-not-exist", {
      method: "DELETE",
      headers: authHeader,
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/posts/by-slug/:slug/publish", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("publishes post by slug", async () => {
    testDb
      .insert(posts)
      .values({
        slug: "publish-me",
        type: "article",
        title: "Publish Me",
        content: "Content",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts/by-slug/publish-me/publish", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.published_at).not.toBeNull();
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.request("/posts/by-slug/does-not-exist/publish", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/posts/by-slug/:slug/unpublish", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("unpublishes post by slug", async () => {
    testDb
      .insert(posts)
      .values({
        slug: "unpublish-me",
        type: "article",
        title: "Unpublish Me",
        content: "Content",
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts/by-slug/unpublish-me/unpublish", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.published_at).toBeNull();
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.request("/posts/by-slug/does-not-exist/unpublish", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/posts - status filter", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  beforeEach(() => {
    // Create both draft and published posts
    testDb
      .insert(posts)
      .values([
        {
          slug: "draft-post",
          type: "article",
          title: "Draft Post",
          content: "Draft content",
          published_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          slug: "published-post",
          type: "article",
          title: "Published Post",
          content: "Published content",
          published_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
      .run();
  });

  it("returns only published posts by default", async () => {
    const res = await api.request("/posts", { headers: authHeader });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("published-post");
  });

  it("returns only draft posts when status=draft", async () => {
    const res = await api.request("/posts?status=draft", { headers: authHeader });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("draft-post");
  });

  it("returns only published posts when status=published", async () => {
    const res = await api.request("/posts?status=published", { headers: authHeader });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("published-post");
  });

  it("returns all posts when status=all", async () => {
    const res = await api.request("/posts?status=all", { headers: authHeader });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    const slugs = json.data.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain("draft-post");
    expect(slugs).toContain("published-post");
  });

  it("rejects invalid status value", async () => {
    const res = await api.request("/posts?status=invalid", { headers: authHeader });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid status");
  });

  it("includes slug field in response", async () => {
    const res = await api.request("/posts", { headers: authHeader });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0]).toHaveProperty("slug");
    expect(json.data[0].slug).toBe("published-post");
  });
});

describe("PUT /api/sources/:id", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  beforeEach(() => {
    testDb.delete(sources).run();
  });

  it("updates source name", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Original", url: "https://example.com" })
      .returning()
      .get();

    const res = await api.request(`/sources/${source.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Updated");
    expect(json.data.url).toBe("https://example.com");
  });

  it("updates source url", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Test", url: "https://old.com" })
      .returning()
      .get();

    const res = await api.request(`/sources/${source.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://new.com" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toBe("https://new.com");
  });

  it("updates feed_url to null", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Test", url: "https://example.com", feed_url: "https://example.com/feed" })
      .returning()
      .get();

    const res = await api.request(`/sources/${source.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ feed_url: null }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.feed_url).toBeNull();
  });

  it("returns 404 for non-existent source", async () => {
    const res = await api.request("/sources/99999", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Source not found");
  });

  it("rejects empty name", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Test", url: "https://example.com" })
      .returning()
      .get();

    const res = await api.request(`/sources/${source.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Name cannot be empty");
  });

  it("rejects invalid source ID", async () => {
    const res = await api.request("/sources/invalid", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid source ID");
  });
});

describe("DELETE /api/sources/:id", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  beforeEach(() => {
    testDb.delete(sources).run();
  });

  it("deletes source", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Delete Me", url: "https://example.com" })
      .returning()
      .get();

    const res = await api.request(`/sources/${source.id}`, {
      method: "DELETE",
      headers: authHeader,
    });

    expect(res.status).toBe(204);

    // Verify deleted
    const deleted = testDb.select().from(sources).where(eq(sources.id, source.id)).get();
    expect(deleted).toBeUndefined();
  });

  it("returns 404 for non-existent source", async () => {
    const res = await api.request("/sources/99999", {
      method: "DELETE",
      headers: authHeader,
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Source not found");
  });

  it("rejects invalid source ID", async () => {
    const res = await api.request("/sources/invalid", {
      method: "DELETE",
      headers: authHeader,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid source ID");
  });
});

describe("GET /api/tags", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  beforeEach(() => {
    testDb.delete(postTags).run();
    testDb.delete(tags).run();
    testDb.delete(posts).run();
  });

  it("returns empty array when no tags", async () => {
    const res = await api.request("/tags", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("returns tags with counts", async () => {
    // Create tags
    const tag1 = testDb.insert(tags).values({ name: "Tech", slug: "tech" }).returning().get();
    const tag2 = testDb.insert(tags).values({ name: "Rust", slug: "rust" }).returning().get();

    // Create posts
    const post1 = testDb
      .insert(posts)
      .values({
        slug: "post-1",
        type: "article",
        title: "Post 1",
        content: "Content",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()
      .get();

    const post2 = testDb
      .insert(posts)
      .values({
        slug: "post-2",
        type: "article",
        title: "Post 2",
        content: "Content",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()
      .get();

    // Tag posts: tag1 has 2 posts, tag2 has 1 post
    testDb.insert(postTags).values({ post_id: post1.id, tag_id: tag1.id }).run();
    testDb.insert(postTags).values({ post_id: post2.id, tag_id: tag1.id }).run();
    testDb.insert(postTags).values({ post_id: post1.id, tag_id: tag2.id }).run();

    const res = await api.request("/tags", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);

    // Should be ordered by count descending
    expect(json.data[0].slug).toBe("tech");
    expect(json.data[0].count).toBe(2);
    expect(json.data[1].slug).toBe("rust");
    expect(json.data[1].count).toBe(1);
  });

  it("returns tags with zero count", async () => {
    // Create a tag with no posts
    testDb.insert(tags).values({ name: "Unused", slug: "unused" }).run();

    const res = await api.request("/tags", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("unused");
    expect(json.data[0].count).toBe(0);
  });
});
