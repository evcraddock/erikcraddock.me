import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { posts } from "../../db/schema";
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
