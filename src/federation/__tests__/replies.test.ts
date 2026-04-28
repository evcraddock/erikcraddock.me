import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tempDir = mkdtempSync(join(tmpdir(), "ec-replies-test-"));

interface RepliesPayload {
  localCount: number;
  duplicateCount: number;
  nonLocalCount: number;
  unknownCount: number;
  unpublishedCount: number;
  unsupportedCount: number;
  storedActivityUri: string | null;
  storedObjectUri: string | null;
  storedActorUri: string | null;
  storedActorName: string | null;
  storedActorUrl: string | null;
  storedContentHtml: string | null;
  storedContentText: string | null;
  storedInReplyToUri: string | null;
  storedModerationStatus: string | null;
  storedPublishedAt: string | null;
  rawSourceIncludesContent: boolean;
  deleted: boolean;
  afterDeleteCount: number;
}

let payload: RepliesPayload | null = null;

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function loadPayload(): RepliesPayload {
  if (payload) {
    return payload;
  }

  const script = String.raw`
    import { Article, Create, Note, Person } from "@fedify/fedify";
    import { Temporal } from "@js-temporal/polyfill";
    import { createPost } from "./src/services/posts";
    import {
      deleteRemoteCommentByActivityUri,
      getRemoteCommentCountForPost,
      getRemoteCommentsForPost,
      handleCreateActivity,
    } from "./src/federation/replies";
    import { dateToInstant } from "./src/federation/utils";

    const publishedPost = createPost({
      type: "note",
      slug: "commented-post",
      content: "Published post",
      published_at: new Date("2026-01-01T00:00:00.000Z"),
    });
    const unpublishedPost = createPost({
      type: "note",
      slug: "draft-post",
      content: "Draft post",
    });

    function actor() {
      return new Person({
        id: new URL("https://remote.example/users/alice"),
        name: "Alice Example",
        url: new URL("https://remote.example/@alice"),
        inbox: new URL("https://remote.example/users/alice/inbox"),
      });
    }

    function note(objectPath, replyTarget, content = '<p>Hello <strong>world</strong><script>alert("xss")</script></p>') {
      return new Note({
        id: new URL("https://remote.example/objects/" + objectPath),
        content,
        replyTarget: new URL(replyTarget),
        published: dateToInstant(new Date("2026-02-03T04:05:06.000Z")),
      });
    }

    function create(activityPath, object) {
      return new Create({
        id: new URL("https://remote.example/activities/" + activityPath),
        actor: actor(),
        object,
        published: Temporal.Instant.from("2026-02-03T04:05:07Z"),
      });
    }

    await handleCreateActivity(create("create-1", note("reply-1", "http://localhost:5000/posts/commented-post")));
    await handleCreateActivity(create("create-1", note("reply-1", "http://localhost:5000/posts/commented-post")));
    await handleCreateActivity(create("create-2", note("reply-2", "https://elsewhere.example/posts/commented-post")));
    await handleCreateActivity(create("create-3", note("reply-3", "http://localhost:5000/posts/missing-post")));
    await handleCreateActivity(create("create-4", note("reply-4", "http://localhost:5000/posts/draft-post")));
    await handleCreateActivity(create("create-5", new Article({
      id: new URL("https://remote.example/objects/article-1"),
      content: "Unsupported",
      replyTarget: new URL("http://localhost:5000/posts/commented-post"),
    })));

    const storedComments = getRemoteCommentsForPost(publishedPost.id);
    const deleted = deleteRemoteCommentByActivityUri("https://remote.example/activities/create-1");

    console.log("__RESULT__" + JSON.stringify({
      localCount: storedComments.length,
      duplicateCount: storedComments.length,
      nonLocalCount: storedComments.length,
      unknownCount: storedComments.length,
      unpublishedCount: getRemoteCommentCountForPost(unpublishedPost.id),
      unsupportedCount: storedComments.length,
      storedActivityUri: storedComments[0]?.activity_uri ?? null,
      storedObjectUri: storedComments[0]?.object_uri ?? null,
      storedActorUri: storedComments[0]?.actor_uri ?? null,
      storedActorName: storedComments[0]?.actor_name ?? null,
      storedActorUrl: storedComments[0]?.actor_url ?? null,
      storedContentHtml: storedComments[0]?.content_html ?? null,
      storedContentText: storedComments[0]?.content_text ?? null,
      storedInReplyToUri: storedComments[0]?.in_reply_to_uri ?? null,
      storedModerationStatus: storedComments[0]?.moderation_status ?? null,
      storedPublishedAt: storedComments[0]?.published_at?.toISOString() ?? null,
      rawSourceIncludesContent: storedComments[0]?.raw_source.includes("Hello") ?? false,
      deleted,
      afterDeleteCount: getRemoteCommentCountForPost(publishedPost.id),
    }));
  `;

  const result = Bun.spawnSync({
    cmd: ["bun", "--eval", script],
    env: {
      ...process.env,
      DATABASE_PATH: join(tempDir, "site.db"),
      FEDIFY_KV_PATH: join(tempDir, "fedify-kv.db"),
      DOMAIN: "localhost:5000",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Remote reply check failed: ${result.stderr.toString()}`);
  }

  const resultLine = result.stdout
    .toString()
    .split("\n")
    .find((line) => line.startsWith("__RESULT__"));

  if (!resultLine) {
    throw new Error(`Remote reply check did not return JSON: ${result.stdout.toString()}`);
  }

  payload = JSON.parse(resultLine.slice("__RESULT__".length)) as RepliesPayload;
  return payload;
}

describe("ActivityPub remote replies", () => {
  it("stores a valid Create(Note) reply for a local published post as pending", () => {
    const result = loadPayload();

    expect(result.localCount).toBe(1);
    expect(result.storedActivityUri).toBe("https://remote.example/activities/create-1");
    expect(result.storedObjectUri).toBe("https://remote.example/objects/reply-1");
    expect(result.storedActorUri).toBe("https://remote.example/users/alice");
    expect(result.storedActorName).toBe("Alice Example");
    expect(result.storedActorUrl).toBe("https://remote.example/@alice");
    expect(result.storedInReplyToUri).toBe("http://localhost:5000/posts/commented-post");
    expect(result.storedModerationStatus).toBe("pending");
    expect(result.storedPublishedAt).toBe("2026-02-03T04:05:06.000Z");
    expect(result.rawSourceIncludesContent).toBe(true);
  });

  it("is idempotent for duplicate Create delivery", () => {
    const result = loadPayload();

    expect(result.duplicateCount).toBe(1);
  });

  it("ignores non-local, unknown, unpublished, and unsupported replies safely", () => {
    const result = loadPayload();

    expect(result.nonLocalCount).toBe(1);
    expect(result.unknownCount).toBe(1);
    expect(result.unpublishedCount).toBe(0);
    expect(result.unsupportedCount).toBe(1);
  });

  it("stores sanitized display-safe content", () => {
    const result = loadPayload();

    expect(result.storedContentHtml).toBe("Hello worldalert(&quot;xss&quot;)");
    expect(result.storedContentText).toBe('Hello worldalert("xss")');
    expect(result.storedContentHtml).not.toContain("<script>");
    expect(result.storedContentHtml).not.toContain("<strong>");
  });

  it("supports deleting stored remote replies", () => {
    const result = loadPayload();

    expect(result.deleted).toBe(true);
    expect(result.afterDeleteCount).toBe(0);
  });
});
