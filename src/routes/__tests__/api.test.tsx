/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { mock } from "bun:test";
import { createTestDb } from "../../db/test-utils";
import { posts, sources, sourceAuthors, people, tags, postTags } from "../../db/schema";
import { eq } from "drizzle-orm";

// Create test db immediately
const testDb = createTestDb();
const originalFetch = global.fetch;
const mockFederatePost = mock(async () => true);
const mockSendDeleteActivity = mock(async () => true);
const mockSendDeleteActivityForUri = mock(async () => true);
const mockSendUpdateActivity = mock(async () => true);
const mockSendActorUpdateActivity = mock(async () => true);

// Mock modules
mock.module("@/db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

mock.module("@/federation/setup", () => ({
  federation: {
    createContext: mock(() => {}),
    sendActivity: mock(() => {}),
  },
  createFedifyFederation: mock(() => {}),
}));

mock.module("@/federation/publish", () => ({
  federatePost: mockFederatePost,
  sendDeleteActivity: mockSendDeleteActivity,
  sendDeleteActivityForUri: mockSendDeleteActivityForUri,
  sendUpdateActivity: mockSendUpdateActivity,
  sendActorUpdateActivity: mockSendActorUpdateActivity,
}));

// Only mock the requireApiKey middleware to bypass auth in tests
// The actual import happens at runtime, so we mock the whole module
mock.module("@/auth/api-key", () => {
  return {
    // Re-export utils that the module re-exports
    generateApiKey: require("../../auth/api-key-utils").generateApiKey,
    API_KEY_PREFIX: require("../../auth/api-key-utils").API_KEY_PREFIX,
    isValidApiKeyFormat: require("../../auth/api-key-utils").isValidApiKeyFormat,
    // Mock functions that use db
    getAuthorByEmail: () => null,
    createApiKey: async () => ({ id: 1, key: "ek_test" }),
    listApiKeys: () => [],
    revokeApiKey: () => true,
    validateApiKey: async () => ({ email: "test@example.com" }),
    // Mock middleware to bypass auth
    requireApiKey: async (
      c: { set: (key: string, value: unknown) => void },
      next: () => Promise<void>
    ) => {
      c.set("apiAuth", { email: "test@example.com" });
      await next();
    },
  };
});

beforeEach(() => {
  testDb.delete(postTags).run();
  testDb.delete(tags).run();
  testDb.delete(posts).run();
  testDb.delete(sourceAuthors).run();
  testDb.delete(people).run();
  testDb.delete(sources).run();
  global.fetch = originalFetch;
  mockFederatePost.mockClear();
  mockSendDeleteActivity.mockClear();
  mockSendDeleteActivityForUri.mockClear();
  mockSendUpdateActivity.mockClear();
  mockSendActorUpdateActivity.mockClear();
});

const authHeader = { Authorization: "Bearer ek_test" };

function mockSourcePreviewFetch(): void {
  global.fetch = mock(
    async () =>
      new Response(
        `
          <html>
            <head>
              <title>Source Preview Title</title>
              <meta name="description" content="Source preview description" />
              <meta property="og:site_name" content="Source Site" />
              <meta property="og:image" content="/source-preview.jpg" />
              <link rel="icon" href="/favicon.ico" />
            </head>
          </html>
        `,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }
      )
  ) as unknown as typeof fetch;
}

describe("API docs", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("serves the OpenAPI document", async () => {
    const res = await api.request("/openapi.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const json = await res.json();
    expect(json.openapi).toBe("3.1.0");
    expect(json.info.title).toBe("erikcraddock.me API");
    expect(json.paths).toHaveProperty("/posts");
    expect(json.paths).toHaveProperty("/sources");
    expect(json.paths).toHaveProperty("/media");
    expect(json.components.securitySchemes).toHaveProperty("Bearer");
  });

  it("serves Swagger UI", async () => {
    const res = await api.request("/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("SwaggerUIBundle");
    expect(html).toContain("./openapi.json");
  });
});

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

  it("creates post as draft when no published_at provided", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "draft-post",
        title: "Draft Post",
        content: "Content",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.published_at).toBeNull();
  });

  it("stores link author independently from source", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Example Source", url: "https://example.com" })
      .returning()
      .get();
    const person = testDb.insert(people).values({ name: "Example Author" }).returning().get();

    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "link",
        slug: "authored-link",
        title: "Authored Link",
        url: "https://example.com/article",
        content: "Commentary",
        source_id: source.id,
        author_id: person.id,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.source_id).toBe(source.id);
    expect(json.data.source.name).toBe("Example Source");
    expect(json.data.author_id).toBe(person.id);
    expect(json.data.author.name).toBe("Example Author");
  });

  it("stores link preview metadata for link posts", async () => {
    global.fetch = mock(
      async () =>
        new Response(
          `
          <html>
            <head>
              <meta property="og:title" content="Preview Title" />
              <meta property="og:description" content="Preview Description" />
              <meta property="og:image" content="https://example.com/preview.jpg" />
              <meta property="og:site_name" content="Example Site" />
            </head>
          </html>
        `,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          }
        )
    ) as unknown as typeof fetch;

    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "link",
        slug: "preview-link",
        title: "Preview Link",
        url: "https://example.com/article",
        content: "Commentary",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.og_title).toBe("Preview Title");
    expect(json.data.og_description).toBe("Preview Description");
    expect(json.data.og_image_url).toBe("https://example.com/preview.jpg");
    expect(json.data.og_site_name).toBe("Example Site");
  });

  it("creates post as published when published_at is provided", async () => {
    const publishDate = "2024-03-15T10:30:00Z";
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "published-post",
        title: "Published Post",
        content: "Content",
        published_at: publishDate,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    // Compare as Date objects to handle format differences (e.g., .000Z vs Z)
    expect(new Date(json.data.published_at).getTime()).toBe(new Date(publishDate).getTime());
  });

  it("rejects invalid published_at date", async () => {
    const res = await api.request("/posts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article",
        slug: "invalid-date-post",
        title: "Post",
        content: "Content",
        published_at: "not-a-date",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("not a valid date");
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

  it("does not federate when only missing preview metadata changes", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    testDb
      .insert(posts)
      .values({
        slug: "metadata-only-link",
        type: "link",
        title: "Metadata Only Link",
        content: "Original content",
        excerpt: "Original excerpt",
        url: "https://example.com/metadata-only",
        created_at: now,
        updated_at: now,
        published_at: now,
      })
      .run();

    global.fetch = mock(async () => {
      return new Response(
        `<!doctype html><html><head>
          <meta property="og:title" content="Fetched title" />
          <meta property="og:description" content="Fetched description" />
          <meta property="og:image" content="https://example.com/preview.jpg" />
          <meta property="og:site_name" content="Example Site" />
        </head></html>`,
        { headers: { "content-type": "text/html" } }
      );
    }) as unknown as typeof fetch;

    const res = await api.request("/posts/by-slug/metadata-only-link", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/metadata-only" }),
    });

    expect(res.status).toBe(200);
    const post = testDb.select().from(posts).where(eq(posts.slug, "metadata-only-link")).get();
    expect(post?.og_title).toBe("Fetched title");
    expect(mockSendUpdateActivity).not.toHaveBeenCalled();
  });

  it("federates when published post content changes", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const post = testDb
      .insert(posts)
      .values({
        slug: "federated-content-change",
        type: "article",
        title: "Federated Content Change",
        content: "Original content",
        created_at: now,
        updated_at: now,
        published_at: now,
      })
      .returning()
      .get();

    const res = await api.request("/posts/by-slug/federated-content-change", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated content" }),
    });

    expect(res.status).toBe(200);
    expect(mockSendUpdateActivity).toHaveBeenCalledWith(post.id);
  });

  it("updates and clears link author by slug", async () => {
    const originalPerson = testDb
      .insert(people)
      .values({ name: "Original Author" })
      .returning()
      .get();
    const nextPerson = testDb.insert(people).values({ name: "Next Author" }).returning().get();
    testDb
      .insert(posts)
      .values({
        slug: "author-update-link",
        type: "link",
        title: "Author Update Link",
        content: "Content",
        url: "https://example.com/author-update",
        author_id: originalPerson.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const updateRes = await api.request("/posts/by-slug/author-update-link", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: nextPerson.id }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.data.author_id).toBe(nextPerson.id);
    expect(updated.data.author.name).toBe("Next Author");

    const clearRes = await api.request("/posts/by-slug/author-update-link", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: null }),
    });

    expect(clearRes.status).toBe(200);
    const cleared = await clearRes.json();
    expect(cleared.data.author_id).toBeNull();
    expect(cleared.data.author).toBeNull();
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

  it("backfills link preview metadata when publishing a link post", async () => {
    global.fetch = mock(
      async () =>
        new Response(
          `
          <html>
            <head>
              <meta property="og:title" content="Published Preview" />
              <meta property="og:description" content="Published description" />
              <meta property="og:image" content="https://example.com/published.jpg" />
              <meta property="og:site_name" content="Example Site" />
            </head>
          </html>
        `,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          }
        )
    ) as unknown as typeof fetch;

    testDb
      .insert(posts)
      .values({
        slug: "publish-link",
        type: "link",
        title: "Publish Link",
        content: "Commentary",
        url: "https://example.com/article",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .run();

    const res = await api.request("/posts/by-slug/publish-link/publish", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.og_title).toBe("Published Preview");
    expect(json.data.og_description).toBe("Published description");
    expect(json.data.og_image_url).toBe("https://example.com/published.jpg");
    expect(json.data.og_site_name).toBe("Example Site");
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

describe("POST /api/sources", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  beforeEach(() => {
    mockSourcePreviewFetch();
  });

  it("creates source with multiple authors", async () => {
    const res = await api.request("/sources", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Team Blog",
        url: "https://team.example.com/",
        feed_url: "https://team.example.com/feed",
        authors: ["Alice", { name: "Bob", url: "https://bob.example.com" }],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.authors.map((author: { name: string }) => author.name)).toEqual([
      "Alice",
      "Bob",
    ]);
    expect(json.data.authors[1].url).toBe("https://bob.example.com");

    const persistedAuthors = testDb
      .select()
      .from(sourceAuthors)
      .where(eq(sourceAuthors.source_id, json.data.id))
      .all();
    expect(persistedAuthors).toHaveLength(2);

    const persistedPeople = testDb.select().from(people).all();
    expect(persistedPeople.map((person) => person.name)).toEqual(["Alice", "Bob"]);
  });

  it("creates source without authors", async () => {
    const res = await api.request("/sources", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No Authors", url: "https://example.com" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.authors).toEqual([]);
  });

  it("stores source preview metadata and favicon", async () => {
    const res = await api.request("/sources", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Preview Source", url: "https://preview.example.com" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.preview_title).toBe("Source Preview Title");
    expect(json.data.preview_description).toBe("Source preview description");
    expect(json.data.preview_image_url).toBe("https://preview.example.com/source-preview.jpg");
    expect(json.data.preview_site_name).toBe("Source Site");
    expect(json.data.favicon_url).toBe("https://preview.example.com/favicon.ico");
  });

  it("reuses people for authors across sources", async () => {
    for (const [name, url] of [
      ["First Source", "https://first.example.com"],
      ["Second Source", "https://second.example.com"],
    ]) {
      const res = await api.request("/sources", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, authors: ["Shared Author"] }),
      });
      expect(res.status).toBe(201);
    }

    const sharedPeople = testDb.select().from(people).where(eq(people.name, "Shared Author")).all();
    expect(sharedPeople).toHaveLength(1);
  });

  it("rejects malformed authors", async () => {
    const res = await api.request("/sources", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad", url: "https://example.com", authors: "Alice" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(JSON.stringify(json.error)).toContain("expected array");
  });
});

describe("PUT /api/sources/:id", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  beforeEach(() => {
    mockSourcePreviewFetch();
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

  it("replaces authors", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Test", url: "https://example.com" })
      .returning()
      .get();

    const originalPerson = testDb.insert(people).values({ name: "Original" }).returning().get();
    testDb
      .insert(sourceAuthors)
      .values({ source_id: source.id, person_id: originalPerson.id })
      .run();

    const res = await api.request(`/sources/${source.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ authors: ["Alice", "Bob"] }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.authors.map((author: { name: string }) => author.name)).toEqual([
      "Alice",
      "Bob",
    ]);
  });

  it("clears authors", async () => {
    const source = testDb
      .insert(sources)
      .values({ name: "Test", url: "https://example.com" })
      .returning()
      .get();

    const originalPerson = testDb.insert(people).values({ name: "Original" }).returning().get();
    testDb
      .insert(sourceAuthors)
      .values({ source_id: source.id, person_id: originalPerson.id })
      .run();

    const res = await api.request(`/sources/${source.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ authors: [] }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.authors).toEqual([]);
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

  it("returns empty array when no tags", async () => {
    const res = await api.request("/tags", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("returns tags with counts", async () => {
    const tag1 = testDb.insert(tags).values({ name: "Tech", slug: "tech" }).returning().get();
    const tag2 = testDb.insert(tags).values({ name: "Rust", slug: "rust" }).returning().get();

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

    testDb.insert(postTags).values({ post_id: post1.id, tag_id: tag1.id }).run();
    testDb.insert(postTags).values({ post_id: post2.id, tag_id: tag1.id }).run();
    testDb.insert(postTags).values({ post_id: post1.id, tag_id: tag2.id }).run();

    const res = await api.request("/tags", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);

    expect(json.data[0].slug).toBe("tech");
    expect(json.data[0].count).toBe(2);
    expect(json.data[1].slug).toBe("rust");
    expect(json.data[1].count).toBe(1);
  });

  it("returns tags with zero count", async () => {
    testDb.insert(tags).values({ name: "Unused", slug: "unused" }).run();

    const res = await api.request("/tags", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("unused");
    expect(json.data[0].count).toBe(0);
  });
});

describe("/api/people", () => {
  let api: typeof import("../api").api;

  beforeAll(async () => {
    const module = await import("../api");
    api = module.api;
  });

  it("lists people", async () => {
    testDb.insert(people).values({ name: "Ethan Mollick", url: null }).run();
    testDb
      .insert(people)
      .values({ name: "Simon Willison", url: "https://simonwillison.net/" })
      .run();

    const res = await api.request("/people", { headers: authHeader });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toMatchObject({ name: "Ethan Mollick", url: null });
    expect(json.data[1]).toMatchObject({
      name: "Simon Willison",
      url: "https://simonwillison.net/",
    });
  });

  it("creates and shows a person", async () => {
    const createRes = await api.request("/people", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ethan Mollick", url: "https://www.oneusefulthing.org/" }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data).toMatchObject({
      name: "Ethan Mollick",
      url: "https://www.oneusefulthing.org/",
    });

    const showRes = await api.request(`/people/${created.data.id}`, { headers: authHeader });

    expect(showRes.status).toBe(200);
    const shown = await showRes.json();
    expect(shown.data).toEqual(created.data);
  });

  it("rejects blank person names", async () => {
    const res = await api.request("/people", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Name is required");
  });

  it("returns conflict for duplicate normalized names", async () => {
    testDb.insert(people).values({ name: "Ethan Mollick", url: null }).run();

    const res = await api.request("/people", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: " ethan mollick " }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Person already exists:");
  });

  it("edits a person and clears url", async () => {
    const person = testDb
      .insert(people)
      .values({ name: "Old Name", url: "https://example.com" })
      .returning()
      .get();

    const res = await api.request(`/people/${person.id}`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name", url: null }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ id: person.id, name: "New Name", url: null });
  });

  it("returns not found for missing people", async () => {
    const res = await api.request("/people/999", { headers: authHeader });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Person not found");
  });
});
