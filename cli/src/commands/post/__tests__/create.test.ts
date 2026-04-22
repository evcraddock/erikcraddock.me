import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const originalExit = process.exit;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

const mockLoadConfig = mock(async () => ({
  api_url: "https://api.example.com",
  api_key: "ek_test",
}));

const mockGetPost = mock(async () => ({ error: "Post not found" }));
const mockCreatePost = mock(async () => ({
  data: {
    slug: "new-post",
    title: "New Post",
    type: "article",
    published_at: null,
    tags: [],
  },
}));
const mockProcessImages = mock(async () => ({
  urlMap: new Map([["./hero.jpg", "https://cdn.example.com/hero.jpg"]]),
  idMap: new Map([["./hero.jpg", 42]]),
}));
const mockDetectImages = mock(() => [
  {
    original: "./hero.jpg",
    type: "local" as const,
    localPath: "/tmp/hero.jpg",
  },
]);
const mockRewriteContent = mock((content: string) => content);

mock.module("../../../lib/config", () => ({
  loadConfig: mockLoadConfig,
}));

mock.module("../../../lib/api", () => ({
  ApiClient: class {
    getPost = mockGetPost;
    createPost = mockCreatePost;
  },
}));

mock.module("../../../lib/images", () => ({
  detectImages: mockDetectImages,
  processImages: mockProcessImages,
  rewriteContent: mockRewriteContent,
}));

describe("ec post create", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-post-create-"));
    mockLoadConfig.mockClear();
    mockGetPost.mockClear();
    mockCreatePost.mockClear();
    mockProcessImages.mockClear();
    mockDetectImages.mockClear();
    mockRewriteContent.mockClear();

    console.error = mock(() => {});
    console.log = mock(() => {});
    process.exit = ((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as typeof process.exit;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    process.exit = originalExit;
  });

  it("checks for an existing slug before uploading images from a file", async () => {
    mockGetPost.mockResolvedValueOnce({
      data: {
        id: 1,
        slug: "existing-post",
        type: "article",
        title: "Existing Post",
        content: "Content",
        excerpt: "Excerpt",
        url: null,
        source_id: null,
        published_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        tags: [],
      },
    });

    const filePath = path.join(tempDir, "article.md");
    fs.writeFileSync(
      filePath,
      `---\ntitle: Existing Post\nslug: existing-post\n---\n\n![hero](./hero.jpg)\n\nHello`
    );

    const { create } = await import("../create");

    await expect(create(["--file", filePath], {})).rejects.toThrow("process.exit:1");

    expect(mockGetPost).toHaveBeenCalledWith("existing-post");
    expect(mockProcessImages).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("❌ Error: Slug 'existing-post' already exists");
  });

  it("continues to image processing when the slug does not exist", async () => {
    const filePath = path.join(tempDir, "article.md");
    fs.writeFileSync(
      filePath,
      `---\ntitle: New Post\nslug: new-post\n---\n\n![hero](./hero.jpg)\n\nHello`
    );

    const { create } = await import("../create");

    await create(["--file", filePath], {});

    expect(mockGetPost).toHaveBeenCalledWith("new-post");
    expect(mockProcessImages).toHaveBeenCalled();
    expect(mockCreatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "new-post",
        title: "New Post",
        type: "article",
      })
    );
  });
});
