import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tempDir = mkdtempSync(join(tmpdir(), "ec-following-test-"));

interface FollowingEndpointPayload {
  actorStatus: number;
  actor: Record<string, unknown>;
  followingStatus: number;
  following: Record<string, unknown>;
  missingStatus: number;
}

let payload: FollowingEndpointPayload | null = null;

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function loadPayload(): FollowingEndpointPayload {
  if (payload) {
    return payload;
  }

  const script = String.raw`
    import { federation } from "./src/federation/setup";

    function activityRequest(path) {
      return new Request("http://localhost:5000" + path, {
        headers: { Accept: "application/activity+json" },
      });
    }

    const actorResponse = await federation.fetch(activityRequest("/users/erik"), {
      contextData: undefined,
    });
    const followingResponse = await federation.fetch(activityRequest("/users/erik/following"), {
      contextData: undefined,
    });
    const missingResponse = await federation.fetch(activityRequest("/users/alice/following"), {
      contextData: undefined,
      onNotFound: async () => new Response("Not found", { status: 404 }),
    });

    console.log("__RESULT__" + JSON.stringify({
      actorStatus: actorResponse.status,
      actor: await actorResponse.json(),
      followingStatus: followingResponse.status,
      following: await followingResponse.json(),
      missingStatus: missingResponse.status,
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
    throw new Error(`Following endpoint check failed: ${result.stderr.toString()}`);
  }

  const resultLine = result.stdout
    .toString()
    .split("\n")
    .find((line) => line.startsWith("__RESULT__"));

  if (!resultLine) {
    throw new Error(`Following endpoint check did not return JSON: ${result.stdout.toString()}`);
  }

  payload = JSON.parse(resultLine.slice("__RESULT__".length)) as FollowingEndpointPayload;
  return payload;
}

describe("ActivityPub following collection", () => {
  it("includes following URL on the actor JSON", () => {
    const result = loadPayload();

    expect(result.actorStatus).toBe(200);
    expect(result.actor.following).toBe("http://localhost:5000/users/erik/following");
    expect(result.actor.followers).toBe("http://localhost:5000/users/erik/followers");
    expect(result.actor.outbox).toBe("http://localhost:5000/users/erik/outbox");
  });

  it("returns an empty following collection for erik", () => {
    const result = loadPayload();

    expect(result.followingStatus).toBe(200);
    expect(result.following).toMatchObject({
      id: "http://localhost:5000/users/erik/following",
      type: "OrderedCollection",
      totalItems: 0,
    });
    expect(result.following.items).toBeUndefined();
    expect(result.following.orderedItems).toBeUndefined();
  });

  it("returns not found for non-erik following collections", () => {
    const result = loadPayload();

    expect(result.missingStatus).toBe(404);
  });
});
