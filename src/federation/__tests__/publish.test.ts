import { describe, it, expect } from "bun:test";
import { postToObjectWithAttachment } from "../publish";

const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

interface PostWithBanner {
  id: number;
  type: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  published_at: Date;
  banner_image_id: number | null;
}

function createMockPost(overrides: Partial<PostWithBanner> = {}): PostWithBanner {
  return {
    id: 1,
    type: "note",
    title: null,
    content: "Test content",
    excerpt: null,
    published_at: new Date("2026-01-31T12:00:00Z"),
    banner_image_id: null,
    ...overrides,
  };
}

describe("postToObjectWithAttachment", () => {
  const actorUri = new URL("https://example.com/users/erik");
  const followersUri = new URL("https://example.com/users/erik/followers");

  it("sets to to Public", () => {
    const post = createMockPost();
    const object = postToObjectWithAttachment(post, actorUri, followersUri);

    expect(object.toId?.href).toBe(PUBLIC);
  });

  it("sets cc to followers URI", () => {
    const post = createMockPost();
    const object = postToObjectWithAttachment(post, actorUri, followersUri);

    expect(object.ccId?.href).toBe(followersUri.href);
  });

  it("creates Note for posts without title", () => {
    const post = createMockPost({ title: null });
    const object = postToObjectWithAttachment(post, actorUri, followersUri);

    expect(object.constructor.name).toBe("Note");
  });

  it("creates Article for posts with title", () => {
    const post = createMockPost({ title: "My Article" });
    const object = postToObjectWithAttachment(post, actorUri, followersUri);

    expect(object.constructor.name).toBe("Article");
  });

  it("sets content from post", () => {
    const post = createMockPost({ content: "Hello world" });
    const object = postToObjectWithAttachment(post, actorUri, followersUri);

    expect(object.content?.toString()).toBe("Hello world");
  });
});
