import { describe, it, expect } from "bun:test";
import { Note, Article } from "@fedify/fedify";
import { postToObject, PublishedPost } from "../post-object";

const actorUri = new URL("http://localhost:5000/users/erik");
const followersUri = new URL("http://localhost:5000/users/erik/followers");

function createPost(overrides: Partial<PublishedPost>): PublishedPost {
  return {
    id: 1,
    slug: "test-post",
    type: "article",
    title: "Test Title",
    content: "Test content",
    excerpt: "Test excerpt",
    url: null,
    published_at: new Date("2026-01-01"),
    updated_at: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("postToObject", () => {
  describe("Note posts", () => {
    it("converts note to Note type with full content as HTML", () => {
      const post = createPost({
        type: "note",
        title: null,
        content: "This is a short note",
        excerpt: null,
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result).toBeInstanceOf(Note);
      expect(result.name).toBeFalsy();
      expect(result.summary).toBeFalsy();
      // Content is rendered as HTML for Mastodon compatibility, wrapped in LanguageString
      expect(String(result.content)).toBe("<p>This is a short note</p>\n");
    });

    it("does not set summary on notes (avoids CW behavior)", () => {
      const post = createPost({
        type: "note",
        title: null,
        content: "Note content",
        excerpt: "Some excerpt", // Even if excerpt exists, should not be used
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result.summary).toBeFalsy();
    });
  });

  describe("Link posts", () => {
    it("converts link to Note type with HTML commentary and clickable URL", () => {
      const post = createPost({
        type: "link",
        title: "Link Title",
        content: "My commentary on this link",
        url: "https://example.com/article",
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result).toBeInstanceOf(Note);
      // Content is HTML with clickable <a> tag so Mastodon can crawl for preview card
      expect(String(result.content)).toBe(
        '<p>My commentary on this link</p>\n<p><a href="https://example.com/article">https://example.com/article</a></p>'
      );
    });

    it("does not set name on link posts (Note type)", () => {
      const post = createPost({
        type: "link",
        title: "Link Title",
        content: "Commentary",
        url: "https://example.com",
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result.name).toBeFalsy();
    });

    it("does not set summary on link posts (avoids CW behavior)", () => {
      const post = createPost({
        type: "link",
        title: "Link Title",
        content: "Commentary",
        excerpt: "Some excerpt",
        url: "https://example.com",
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result.summary).toBeFalsy();
    });

    it("sets url to external URL for link posts", () => {
      const post = createPost({
        type: "link",
        title: "Link Title",
        content: "Commentary",
        url: "https://example.com/article",
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result.url?.href).toBe("https://example.com/article");
    });
  });

  describe("Article posts", () => {
    it("converts article to Article type with excerpt and site URL", () => {
      const post = createPost({
        type: "article",
        slug: "my-article",
        title: "My Article",
        content: "Full article content here...",
        excerpt: "Brief excerpt",
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result).toBeInstanceOf(Article);
      expect(result.name).toBe("My Article");
      expect(String(result.content)).toContain("Brief excerpt");
      expect(String(result.content)).toContain("/posts/my-article");
    });

    it("includes banner image as attachment", async () => {
      const post = createPost({
        type: "article",
        title: "My Article",
        banner_url: "http://example.com/image.jpg",
        banner_alt: "A test image",
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;
      const attachment = json.attachment as Record<string, unknown>;

      expect(attachment).toBeDefined();
      expect(attachment.type).toBe("Document");
      expect(attachment.url).toBe("http://example.com/image.jpg");
      expect(attachment.mediaType).toBe("image/jpeg");
      expect(attachment.name).toBe("A test image");
    });

    it("uses title as attachment name when no alt text", async () => {
      const post = createPost({
        type: "article",
        title: "My Article Title",
        banner_url: "http://example.com/image.png",
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;
      const attachment = json.attachment as Record<string, unknown>;

      expect(attachment.name).toBe("My Article Title");
      expect(attachment.mediaType).toBe("image/png");
    });

    it("sets summary on articles", () => {
      const post = createPost({
        type: "article",
        title: "My Article",
        excerpt: "Article excerpt",
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(result.summary).toBe("Article excerpt");
    });

    it("uses just URL if no excerpt", () => {
      const post = createPost({
        type: "article",
        slug: "no-excerpt-article",
        title: "Article Without Excerpt",
        excerpt: null,
      });

      const result = postToObject(post, actorUri, followersUri);

      expect(String(result.content)).toContain("/posts/no-excerpt-article");
      expect(String(result.content)).not.toContain("\n\n"); // Just URL, no excerpt prefix
    });
  });

  describe("common properties", () => {
    it("sets attribution to actor URI", () => {
      const post = createPost({ type: "note", title: null });
      const result = postToObject(post, actorUri, followersUri);

      expect(result.attributionId?.href).toBe(actorUri.href);
    });

    it("sets published date", () => {
      const publishedAt = new Date("2026-02-01T12:00:00Z");
      const post = createPost({ type: "note", title: null, published_at: publishedAt });
      const result = postToObject(post, actorUri, followersUri);

      expect(result.published).toBeDefined();
    });

    it("exposes a replies collection URL", async () => {
      const post = createPost({ type: "note", slug: "replyable-post", title: null });
      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;

      expect(String(json.replies)).toContain("/posts/replyable-post/replies");
    });
  });

  describe("hashtags", () => {
    it("includes tags as ActivityPub Hashtag objects", async () => {
      const post = createPost({
        type: "note",
        title: null,
        content: "A post with tags",
        tags: [
          { name: "Coding", slug: "coding" },
          { name: "TypeScript", slug: "typescript" },
        ],
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;
      const tags = json.tag as Array<Record<string, unknown>>;

      expect(tags).toBeDefined();
      expect(tags.length).toBe(2);
      expect(tags[0].type).toBe("Hashtag");
      expect(tags[0].name).toBe("#coding");
      expect(tags[0].href).toContain("/tags/coding");
      expect(tags[1].type).toBe("Hashtag");
      expect(tags[1].name).toBe("#typescript");
      expect(tags[1].href).toContain("/tags/typescript");
    });

    it("converts tag names to lowercase hashtags", async () => {
      const post = createPost({
        type: "article",
        title: "Tagged Article",
        tags: [{ name: "AI", slug: "ai" }],
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;
      // Single tag is an object, not an array
      const tag = json.tag as Record<string, unknown>;

      expect(tag.name).toBe("#ai");
    });

    it("removes spaces from tag names", async () => {
      const post = createPost({
        type: "note",
        title: null,
        tags: [{ name: "Machine Learning", slug: "machine-learning" }],
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;
      // Single tag is an object, not an array
      const tag = json.tag as Record<string, unknown>;

      expect(tag.name).toBe("#machinelearning");
    });

    it("does not include tags property when no tags", async () => {
      const post = createPost({
        type: "note",
        title: null,
        tags: [],
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;

      expect(json.tag).toBeUndefined();
    });

    it("does not include tags property when tags is undefined", async () => {
      const post = createPost({
        type: "note",
        title: null,
      });

      const result = postToObject(post, actorUri, followersUri);
      const json = (await result.toJsonLd()) as Record<string, unknown>;

      expect(json.tag).toBeUndefined();
    });
  });
});
