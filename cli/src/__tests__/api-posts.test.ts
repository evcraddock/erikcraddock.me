import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ApiClient } from "../lib/api";

describe("ApiClient post methods", () => {
  let client: ApiClient;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    client = new ApiClient("https://api.example.com", "test-key");
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  describe("listPosts", () => {
    it("calls /posts endpoint", async () => {
      await client.listPosts();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        })
      );
    });

    it("adds query params when provided", async () => {
      await client.listPosts({ status: "draft", limit: 10, tag: "tech", type: "article" });
      const call = mockFetch.mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain("status=draft");
      expect(url).toContain("limit=10");
      expect(url).toContain("tag=tech");
      expect(url).toContain("type=article");
    });

    it("returns posts array on success", async () => {
      const posts = [
        {
          id: 1,
          slug: "test-post",
          type: "article",
          title: "Test",
          excerpt: "Test excerpt",
          published_at: null,
          tags: [],
        },
      ];
      mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: posts }),
        })
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const result = await client.listPosts();
      expect(result.data).toEqual(posts);
    });
  });

  describe("getPost", () => {
    it("calls /posts/by-slug/:slug endpoint", async () => {
      await client.getPost("my-post");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts/by-slug/my-post",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("encodes slug with special characters", async () => {
      await client.getPost("my post with spaces");
      const call = mockFetch.mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain("my%20post%20with%20spaces");
    });
  });

  describe("createPost", () => {
    it("calls POST /posts with body", async () => {
      const postData = {
        type: "article",
        slug: "new-post",
        title: "New Post",
        content: "Hello world",
      };
      await client.createPost(postData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(postData),
        })
      );
    });
  });

  describe("updatePost", () => {
    it("calls PUT /posts/by-slug/:slug with body", async () => {
      const updates = { title: "Updated Title" };
      await client.updatePost("my-post", updates);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts/by-slug/my-post",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updates),
        })
      );
    });
  });

  describe("deletePost", () => {
    it("calls DELETE /posts/by-slug/:slug", async () => {
      await client.deletePost("my-post");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts/by-slug/my-post",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("publishPost", () => {
    it("calls POST /posts/by-slug/:slug/publish", async () => {
      await client.publishPost("my-post");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts/by-slug/my-post/publish",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("unpublishPost", () => {
    it("calls POST /posts/by-slug/:slug/unpublish", async () => {
      await client.unpublishPost("my-post");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/posts/by-slug/my-post/unpublish",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
