import {
  createFederation,
  Person,
  Endpoints,
  Follow,
  Undo,
  Accept,
  isActor,
  InProcessMessageQueue,
  type KvStore,
} from "@fedify/fedify";
import { getOrCreateKeyPair } from "./keys";
import { addFollower, removeFollower, getAllFollowers } from "./followers";
import { getOutboxActivities, getPublishedPostCount } from "./outbox";
import { getOrigin } from "./utils";
import { logger } from "@/utils/logger";

// Context type for federation - we use void since we don't need request-specific data
export type FederationContext = void;

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";

// Lazy-initialized KV store
let kvStore: KvStore | null = null;

// Detect runtime
const isBun = typeof globalThis.Bun !== "undefined";

function getKvStore(): KvStore {
  if (!kvStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteKvStore } = require("@fedify/sqlite");
    const kvPath = process.env.FEDIFY_KV_PATH || "./data/fedify-kv.db";

    if (isBun) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite");
      const kvDb = new Database(kvPath);
      kvDb.exec("PRAGMA journal_mode = WAL;");
      kvStore = new SqliteKvStore(kvDb);
    } else {
      // Use Node.js built-in SQLite
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require("node:sqlite");
      const kvDb = new DatabaseSync(kvPath);
      kvDb.exec("PRAGMA journal_mode = WAL;");
      kvStore = new SqliteKvStore(kvDb);
    }

    logger.info("federation", `KV store initialized at ${kvPath}`);
  }
  return kvStore!;
}

/**
 * Create and configure the Fedify federation instance.
 */
export function createFedifyFederation() {
  const origin = getOrigin(domain);
  logger.info("federation", `Creating federation for origin: ${origin}`);

  const federation = createFederation<FederationContext>({
    kv: getKvStore(),
    // TODO: Replace with persistent queue once node:sqlite compatibility is verified
    queue: new InProcessMessageQueue(),
    origin,
  });

  // Set up actor dispatcher
  federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
      if (identifier !== "erik") {
        return null;
      }

      const keys = await ctx.getActorKeyPairs(identifier);

      return new Person({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: "Erik Craddock",
        summary: "Personal blog - articles, links, and notes",
        url: new URL("/", ctx.canonicalOrigin),
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        followers: ctx.getFollowersUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        publicKey: keys[0].cryptographicKey,
        assertionMethods: keys.map((key) => key.multikey),
      });
    })
    .setKeyPairsDispatcher(async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return [];
      }
      const keyPair = await getOrCreateKeyPair();
      return [keyPair];
    });

  // Set up inbox listeners
  federation
    .setInboxListeners("/users/{identifier}/inbox", "/inbox")
    .on(Follow, async (ctx, follow) => {
      const followerActor = await follow.getActor(ctx);
      if (!isActor(followerActor)) {
        logger.warn("federation", "Follow activity has no valid actor");
        return;
      }

      const actorId = followerActor.id;
      const inboxId = followerActor.inboxId;

      if (!actorId || !inboxId) {
        logger.warn("federation", "Follow actor missing id or inbox");
        return;
      }

      const endpoints = followerActor.endpoints;
      const sharedInbox = endpoints?.sharedInbox;

      addFollower({
        actor_uri: actorId.href,
        inbox_uri: inboxId.href,
        shared_inbox_uri: sharedInbox?.href ?? null,
      });
      logger.info("federation", `New follower added: ${actorId.href}`);

      // Send Accept activity back to the follower
      const accept = new Accept({
        actor: ctx.getActorUri("erik"),
        object: follow,
      });
      await ctx.sendActivity({ identifier: "erik" }, followerActor, accept);
      logger.info("federation", `Sent Accept to: ${actorId.href}`);
    })
    .on(Undo, async (ctx, undo) => {
      const object = await undo.getObject(ctx);
      if (!(object instanceof Follow)) {
        return;
      }

      const actor = await undo.getActor(ctx);
      if (!isActor(actor) || !actor.id) {
        logger.warn("federation", "Undo activity has no valid actor");
        return;
      }

      const removed = removeFollower(actor.id.href);
      if (removed) {
        logger.info("federation", `Unfollowed by: ${actor.id.href}`);
      }
    });

  // Set up outbox dispatcher
  const OUTBOX_PAGE_SIZE = 20;

  federation
    .setOutboxDispatcher("/users/{identifier}/outbox", async (ctx, identifier, cursor) => {
      if (identifier !== "erik") {
        return null;
      }

      const actorUri = ctx.getActorUri(identifier);
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const activities = getOutboxActivities(actorUri, OUTBOX_PAGE_SIZE, offset);
      const totalCount = getPublishedPostCount();

      const nextOffset = offset + activities.length;
      const hasMore = nextOffset < totalCount;

      return {
        items: activities,
        nextCursor: hasMore ? nextOffset.toString() : null,
        prevCursor: offset > 0 ? Math.max(0, offset - OUTBOX_PAGE_SIZE).toString() : null,
      };
    })
    .setCounter(async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return null;
      }
      return getPublishedPostCount();
    })
    .setFirstCursor(async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return null;
      }
      return "0";
    });

  // Set up followers collection dispatcher
  federation.setFollowersDispatcher("/users/{identifier}/followers", async (_ctx, identifier) => {
    if (identifier !== "erik") {
      return null;
    }

    const followerList = getAllFollowers();
    return {
      items: followerList.map((f) => ({
        id: new URL(f.actor_uri),
        inboxId: new URL(f.inbox_uri),
        endpoints: f.shared_inbox_uri ? { sharedInbox: new URL(f.shared_inbox_uri) } : undefined,
      })),
    };
  });

  logger.info("federation", "Federation configured");
  return federation;
}

export const federation = createFedifyFederation();
