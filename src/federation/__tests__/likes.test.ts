import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tempDir = mkdtempSync(join(tmpdir(), "ec-likes-test-"));

interface LikesPayload {
  localCount: number;
  duplicateCount: number;
  nonLocalCount: number;
  unknownCount: number;
  unpublishedCount: number;
  storedActorUri: string | null;
  storedObjectUri: string | null;
  storedRawObjectUri: string | null;
  deleted: boolean;
  afterDeleteCount: number;
}

let payload: LikesPayload | null = null;

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function loadPayload(): LikesPayload {
  if (payload) {
    return payload;
  }

  const script = String.raw`
    import { Like, Person } from "@fedify/fedify";
    import { createPost } from "./src/services/posts";
    import {
      deleteRemoteLike,
      getRemoteLikeCountForPost,
      getRemoteLikesForPost,
      handleLikeActivity,
    } from "./src/federation/likes";

    const publishedPost = createPost({
      type: "note",
      slug: "liked-post",
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
        name: "Alice",
        inbox: new URL("https://remote.example/users/alice/inbox"),
      });
    }

    function like(activityPath, objectUri) {
      return new Like({
        id: new URL("https://remote.example/activities/" + activityPath),
        actor: actor(),
        object: new URL(objectUri),
      });
    }

    await handleLikeActivity(like("like-1", "http://localhost:5000/posts/liked-post"));
    await handleLikeActivity(like("like-1", "http://localhost:5000/posts/liked-post"));
    await handleLikeActivity(like("like-2", "https://elsewhere.example/posts/liked-post"));
    await handleLikeActivity(like("like-3", "http://localhost:5000/posts/missing-post"));
    await handleLikeActivity(like("like-4", "http://localhost:5000/posts/draft-post"));

    const storedLikes = getRemoteLikesForPost(publishedPost.id);
    const deleted = deleteRemoteLike("https://remote.example/activities/like-1");

    console.log("__RESULT__" + JSON.stringify({
      localCount: storedLikes.length,
      duplicateCount: storedLikes.length,
      nonLocalCount: storedLikes.length,
      unknownCount: storedLikes.length,
      unpublishedCount: getRemoteLikeCountForPost(unpublishedPost.id),
      storedActorUri: storedLikes[0]?.actor_uri ?? null,
      storedObjectUri: storedLikes[0]?.object_uri ?? null,
      storedRawObjectUri: storedLikes[0]?.raw_object_uri ?? null,
      deleted,
      afterDeleteCount: getRemoteLikeCountForPost(publishedPost.id),
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
    throw new Error(`Remote like check failed: ${result.stderr.toString()}`);
  }

  const resultLine = result.stdout
    .toString()
    .split("\n")
    .find((line) => line.startsWith("__RESULT__"));

  if (!resultLine) {
    throw new Error(`Remote like check did not return JSON: ${result.stdout.toString()}`);
  }

  payload = JSON.parse(resultLine.slice("__RESULT__".length)) as LikesPayload;
  return payload;
}

describe("ActivityPub remote likes", () => {
  it("stores a valid Like for a local published post", () => {
    const result = loadPayload();

    expect(result.localCount).toBe(1);
    expect(result.storedActorUri).toBe("https://remote.example/users/alice");
    expect(result.storedObjectUri).toBe("http://localhost:5000/posts/liked-post");
    expect(result.storedRawObjectUri).toBe("http://localhost:5000/posts/liked-post");
  });

  it("is idempotent for duplicate Like delivery", () => {
    const result = loadPayload();

    expect(result.duplicateCount).toBe(1);
  });

  it("ignores non-local, unknown, and unpublished targets safely", () => {
    const result = loadPayload();

    expect(result.nonLocalCount).toBe(1);
    expect(result.unknownCount).toBe(1);
    expect(result.unpublishedCount).toBe(0);
  });

  it("supports deleting stored remote likes", () => {
    const result = loadPayload();

    expect(result.deleted).toBe(true);
    expect(result.afterDeleteCount).toBe(0);
  });
});
