import { describe, it, expect } from "bun:test";
import { postToObject, postToCreateActivity, type PublishedPost } from "../outbox";

const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

function createMockPost(overrides: Partial<PublishedPost> = {}): PublishedPost {
  return {
    id: 1,
    type: "note",
    title: null,
    content: "Test content",
    excerpt: null,
    url: null,
    published_at: new Date("2026-01-31T12:00:00Z"),
    ...overrides,
  };
}

describe("postToObject", () => {
  const actorUri = new URL("https://example.com/users/erik");
  const followersUri = new URL("https://example.com/users/erik/followers");

  it("sets to to Public", () => {
    const post = createMockPost();
    const object = postToObject(post, actorUri, followersUri);

    expect(object.toId?.href).toBe(PUBLIC);
  });

  it("sets cc to followers URI", () => {
    const post = createMockPost();
    const object = postToObject(post, actorUri, followersUri);

    expect(object.ccId?.href).toBe(followersUri.href);
  });

  it("creates Note for posts without title", () => {
    const post = createMockPost({ title: null });
    const object = postToObject(post, actorUri, followersUri);

    expect(object.constructor.name).toBe("Note");
  });

  it("creates Article for posts with title", () => {
    const post = createMockPost({ title: "My Article" });
    const object = postToObject(post, actorUri, followersUri);

    expect(object.constructor.name).toBe("Article");
  });
});

describe("postToCreateActivity", () => {
  const actorUri = new URL("https://example.com/users/erik");
  const followersUri = new URL("https://example.com/users/erik/followers");

  it("sets to to Public on the Create activity", () => {
    const post = createMockPost();
    const activity = postToCreateActivity(post, actorUri, followersUri);

    expect(activity.toId?.href).toBe(PUBLIC);
  });

  it("sets cc to followers URI on the Create activity", () => {
    const post = createMockPost();
    const activity = postToCreateActivity(post, actorUri, followersUri);

    expect(activity.ccId?.href).toBe(followersUri.href);
  });

  it("sets actor to the actor URI", () => {
    const post = createMockPost();
    const activity = postToCreateActivity(post, actorUri, followersUri);

    expect(activity.actorId?.href).toBe(actorUri.href);
  });

  it("includes the object with addressing", async () => {
    const post = createMockPost();
    const activity = postToCreateActivity(post, actorUri, followersUri);

    const object = await activity.getObject();
    expect(object?.toId?.href).toBe(PUBLIC);
    expect(object?.ccId?.href).toBe(followersUri.href);
  });
});
