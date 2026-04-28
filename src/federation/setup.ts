import {
  createFederation,
  Follow,
  Undo,
  Like,
  Announce,
  Create,
  Accept,
  isActor,
  InProcessMessageQueue,
  type KvStore,
} from "@fedify/fedify";
import { getOrCreateKeyPairs } from "./keys";
import { addFollower, removeFollower, getAllFollowers, getFollowerCount } from "./followers";
import { getOutboxActivities, getPublishedPostCount } from "./outbox";
import { getOrigin } from "./utils";
import { logger } from "@/utils/logger";
import { buildActorProfile } from "./actor-profile";
import { handleLikeActivity } from "./likes";
import { handleAnnounceActivity } from "./boosts";
import { handleCreateActivity } from "./replies";

// Context type for federation - we use void since we don't need request-specific data
export type FederationContext = void;

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";

// Lazy-initialized KV store (avoids sqlite import at module load time for tests)
let kvStore: KvStore | null = null;

// Detect runtime
const isBun = typeof globalThis.Bun !== "undefined";

function getKvStore(): KvStore {
  if (!kvStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteKvStore } = require("@fedify/sqlite");
    const kvPath = process.env.FEDIFY_KV_PATH || "./data/fedify-kv.db";

    if (isBun) {
      // Use bun:sqlite for Bun runtime
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite");
      const kvDb = new Database(kvPath);
      kvDb.exec("PRAGMA journal_mode = WAL;");
      kvStore = new SqliteKvStore(kvDb);
    } else {
      // Use better-sqlite3 for Node.js runtime
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BetterSqlite3 = require("better-sqlite3");
      const kvDb = new BetterSqlite3(kvPath);
      kvDb.exec("PRAGMA journal_mode = WAL;");
      kvStore = new SqliteKvStore(kvDb);
    }

    logger.info("federation", `KV store initialized at ${kvPath}`);
  }
  // Non-null assertion: kvStore is assigned in the if block above
  return kvStore!;
}

/**
 * Create and configure the Fedify federation instance.
 *
 * This sets up:
 * - KV store for Fedify's internal state (using in-memory for now, can switch to SQLite)
 * - Actor dispatcher for /users/{identifier}
 * - Key pairs dispatcher for HTTP signatures
 * - Inbox, outbox, and followers collection dispatchers
 */
export function createFedifyFederation() {
  // Build canonical origin - ensures correct protocol (https) behind reverse proxy
  const origin = getOrigin(domain);
  logger.info("federation", `Creating federation for origin: ${origin}`);

  const federation = createFederation<FederationContext>({
    kv: getKvStore(),
    queue: new InProcessMessageQueue(),
    // Explicitly set origin to ensure correct URLs behind reverse proxy
    origin,
  });

  // Set up actor dispatcher - handles requests for /users/{identifier}
  // For this single-user blog, only "erik" is a valid identifier
  federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
      if (identifier !== "erik") {
        return null; // Only support the single user
      }

      // Get key pairs using Fedify's method - returns keys in proper format
      // for both HTTP Signatures (publicKey) and Object Integrity Proofs (assertionMethods)
      const keys = await ctx.getActorKeyPairs(identifier);

      return buildActorProfile({
        identifier,
        canonicalOrigin: ctx.canonicalOrigin,
        uris: {
          actor: ctx.getActorUri(identifier),
          inbox: ctx.getInboxUri(identifier),
          outbox: ctx.getOutboxUri(identifier),
          followers: ctx.getFollowersUri(identifier),
          following: ctx.getFollowingUri(identifier),
          sharedInbox: ctx.getInboxUri(),
        },
        keys,
      });
    })
    // Set up key pairs dispatcher - provides keys for HTTP signatures and proofs
    // Returns RSA key first (for HTTP Signatures) and Ed25519 (for Object Integrity Proofs)
    .setKeyPairsDispatcher(async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return [];
      }

      const keyPairs = await getOrCreateKeyPairs();
      return keyPairs;
    });

  // Set up inbox listeners - handles incoming activities
  // Second argument registers the shared inbox for efficient batch delivery
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

      // Get shared inbox if available (for efficient batch delivery)
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
      // Check if this is an Undo of a Follow
      const object = await undo.getObject(ctx);
      if (!(object instanceof Follow)) {
        return; // Not an unfollow, ignore
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
    })
    .on(Like, async (_ctx, like) => {
      await handleLikeActivity(like);
    })
    .on(Announce, async (_ctx, announce) => {
      await handleAnnounceActivity(announce);
    })
    .on(Create, async (_ctx, create) => {
      await handleCreateActivity(create);
    });

  // Set up outbox dispatcher - lists activities sent by this actor
  // Returns Create activities for all published posts (including imported/backdated ones)
  const OUTBOX_PAGE_SIZE = 20;

  federation
    .setOutboxDispatcher("/users/{identifier}/outbox", async (ctx, identifier, cursor) => {
      if (identifier !== "erik") {
        return null;
      }

      const actorUri = ctx.getActorUri(identifier);
      const followersUri = ctx.getFollowersUri(identifier);
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const activities = getOutboxActivities(actorUri, followersUri, OUTBOX_PAGE_SIZE, offset);
      const totalCount = getPublishedPostCount();

      // Calculate next cursor if there are more items
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
      // First page starts at offset 0
      return "0";
    });

  // Set up following collection dispatcher - this single-user site does not follow actors yet
  federation
    .setFollowingDispatcher("/users/{identifier}/following", async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return null;
      }

      return { items: [] };
    })
    .setCounter((_ctx, identifier) => (identifier === "erik" ? 0 : null));

  // Set up followers collection dispatcher - returns list of followers
  federation
    .setFollowersDispatcher("/users/{identifier}/followers", async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return null;
      }

      const followerList = getAllFollowers();
      // Return Recipient objects with required id and inboxId
      return {
        items: followerList.map((f) => ({
          id: new URL(f.actor_uri),
          inboxId: new URL(f.inbox_uri),
          endpoints: f.shared_inbox_uri ? { sharedInbox: new URL(f.shared_inbox_uri) } : undefined,
        })),
      };
    })
    .setCounter((_ctx, identifier) => (identifier === "erik" ? getFollowerCount() : 0));

  logger.info("federation", "Federation configured");
  return federation;
}

// Export the federation instance
export const federation = createFedifyFederation();
