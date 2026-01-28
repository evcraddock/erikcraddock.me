import {
  createFederation,
  Person,
  CryptographicKey,
  MemoryKvStore,
  Follow,
  Undo,
  isActor,
} from "@fedify/fedify";
import { getOrCreateKeyPair } from "./keys";
import { addFollower, removeFollower, getAllFollowers } from "./followers";
import { getOutboxActivities, getPublishedPostCount } from "./outbox";
import { logger } from "@/utils/logger";

// Context type for federation - we use void since we don't need request-specific data
export type FederationContext = void;

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";

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
  logger.info("federation", `Creating federation for domain: ${domain}`);

  const federation = createFederation<FederationContext>({
    kv: new MemoryKvStore(), // TODO: Switch to SqliteKvStore for production
  });

  // Set up actor dispatcher - handles requests for /users/{identifier}
  // For this single-user blog, only "erik" is a valid identifier
  federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
      if (identifier !== "erik") {
        return null; // Only support the single user
      }

      // Get or create key pair for this actor
      const keyPair = await getOrCreateKeyPair();

      const actorUri = ctx.getActorUri(identifier);

      return new Person({
        id: actorUri,
        preferredUsername: identifier,
        name: "Erik Craddock",
        summary: "Personal blog - articles, links, and notes",
        url: new URL("/", ctx.url),
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        followers: ctx.getFollowersUri(identifier),
        publicKey: new CryptographicKey({
          id: new URL(`${actorUri}#main-key`),
          owner: actorUri,
          publicKey: keyPair.publicKey,
        }),
      });
    })
    // Set up key pairs dispatcher - provides keys for HTTP signatures
    .setKeyPairsDispatcher(async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return [];
      }

      const keyPair = await getOrCreateKeyPair();
      return [keyPair];
    });

  // Set up inbox listeners - handles incoming activities
  federation
    .setInboxListeners("/users/{identifier}/inbox")
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

      // Fedify automatically sends Accept when we return without error
      logger.info("federation", `Accepted follow from: ${actorId.href}`);
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
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const activities = getOutboxActivities(actorUri, OUTBOX_PAGE_SIZE, offset);
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

  // Set up followers collection dispatcher - returns list of followers
  federation.setFollowersDispatcher("/users/{identifier}/followers", async (_ctx, identifier) => {
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
  });

  logger.info("federation", "Federation configured");
  return federation;
}

// Export the federation instance
export const federation = createFedifyFederation();
