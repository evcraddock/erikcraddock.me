import { eq } from "drizzle-orm";
import { db, followers } from "@/db";
import { logger } from "@/utils/logger";

export interface Follower {
  id: number;
  actor_uri: string;
  inbox_uri: string;
  shared_inbox_uri: string | null;
  followed_at: Date;
}

export interface NewFollower {
  actor_uri: string;
  inbox_uri: string;
  shared_inbox_uri?: string | null;
}

/**
 * Add a new follower to the database.
 * If the follower already exists (by actor_uri), this is a no-op.
 */
export function addFollower(follower: NewFollower): Follower | null {
  // Check if already following
  const existing = db
    .select()
    .from(followers)
    .where(eq(followers.actor_uri, follower.actor_uri))
    .get();

  if (existing) {
    logger.debug("federation", `Follower already exists: ${follower.actor_uri}`);
    return existing;
  }

  const result = db
    .insert(followers)
    .values({
      actor_uri: follower.actor_uri,
      inbox_uri: follower.inbox_uri,
      shared_inbox_uri: follower.shared_inbox_uri ?? null,
      followed_at: new Date(),
    })
    .returning()
    .get();

  logger.info("federation", `New follower added: ${follower.actor_uri}`);
  return result;
}

/**
 * Remove a follower from the database by their actor URI.
 * Returns true if a follower was removed, false if not found.
 */
export function removeFollower(actorUri: string): boolean {
  const result = db
    .delete(followers)
    .where(eq(followers.actor_uri, actorUri))
    .returning()
    .get();

  if (result) {
    logger.info("federation", `Follower removed: ${actorUri}`);
    return true;
  }

  logger.debug("federation", `Follower not found for removal: ${actorUri}`);
  return false;
}

/**
 * Get a follower by their actor URI.
 */
export function getFollower(actorUri: string): Follower | undefined {
  return db
    .select()
    .from(followers)
    .where(eq(followers.actor_uri, actorUri))
    .get();
}

/**
 * Get all followers.
 */
export function getAllFollowers(): Follower[] {
  return db.select().from(followers).all();
}

/**
 * Get the count of followers.
 */
export function getFollowerCount(): number {
  const result = db.select().from(followers).all();
  return result.length;
}
