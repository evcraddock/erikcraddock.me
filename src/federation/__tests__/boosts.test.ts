import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tempDir = mkdtempSync(join(tmpdir(), "ec-boosts-test-"));

interface BoostsPayload {
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

let payload: BoostsPayload | null = null;

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function loadPayload(): BoostsPayload {
  if (payload) {
    return payload;
  }

  const script = String.raw`
    import { Announce, Person } from "@fedify/fedify";
    import { createPost } from "./src/services/posts";
    import {
      deleteRemoteBoost,
      getRemoteBoostCountForPost,
      getRemoteBoostsForPost,
      handleAnnounceActivity,
    } from "./src/federation/boosts";

    const publishedPost = createPost({
      type: "note",
      slug: "boosted-post",
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

    function announce(activityPath, objectUri) {
      return new Announce({
        id: new URL("https://remote.example/activities/" + activityPath),
        actor: actor(),
        object: new URL(objectUri),
      });
    }

    await handleAnnounceActivity(announce("announce-1", "http://localhost:5000/posts/boosted-post"));
    await handleAnnounceActivity(announce("announce-1", "http://localhost:5000/posts/boosted-post"));
    await handleAnnounceActivity(announce("announce-2", "https://elsewhere.example/posts/boosted-post"));
    await handleAnnounceActivity(announce("announce-3", "http://localhost:5000/posts/missing-post"));
    await handleAnnounceActivity(announce("announce-4", "http://localhost:5000/posts/draft-post"));

    const storedBoosts = getRemoteBoostsForPost(publishedPost.id);
    const deleted = deleteRemoteBoost("https://remote.example/activities/announce-1");

    console.log("__RESULT__" + JSON.stringify({
      localCount: storedBoosts.length,
      duplicateCount: storedBoosts.length,
      nonLocalCount: storedBoosts.length,
      unknownCount: storedBoosts.length,
      unpublishedCount: getRemoteBoostCountForPost(unpublishedPost.id),
      storedActorUri: storedBoosts[0]?.actor_uri ?? null,
      storedObjectUri: storedBoosts[0]?.object_uri ?? null,
      storedRawObjectUri: storedBoosts[0]?.raw_object_uri ?? null,
      deleted,
      afterDeleteCount: getRemoteBoostCountForPost(publishedPost.id),
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
    throw new Error(`Remote boost check failed: ${result.stderr.toString()}`);
  }

  const resultLine = result.stdout
    .toString()
    .split("\n")
    .find((line) => line.startsWith("__RESULT__"));

  if (!resultLine) {
    throw new Error(`Remote boost check did not return JSON: ${result.stdout.toString()}`);
  }

  payload = JSON.parse(resultLine.slice("__RESULT__".length)) as BoostsPayload;
  return payload;
}

describe("ActivityPub remote boosts", () => {
  it("stores a valid Announce for a local published post", () => {
    const result = loadPayload();

    expect(result.localCount).toBe(1);
    expect(result.storedActorUri).toBe("https://remote.example/users/alice");
    expect(result.storedObjectUri).toBe("http://localhost:5000/posts/boosted-post");
    expect(result.storedRawObjectUri).toBe("http://localhost:5000/posts/boosted-post");
  });

  it("is idempotent for duplicate Announce delivery", () => {
    const result = loadPayload();

    expect(result.duplicateCount).toBe(1);
  });

  it("ignores non-local, unknown, and unpublished targets safely", () => {
    const result = loadPayload();

    expect(result.nonLocalCount).toBe(1);
    expect(result.unknownCount).toBe(1);
    expect(result.unpublishedCount).toBe(0);
  });

  it("supports deleting stored remote boosts", () => {
    const result = loadPayload();

    expect(result.deleted).toBe(true);
    expect(result.afterDeleteCount).toBe(0);
  });
});
