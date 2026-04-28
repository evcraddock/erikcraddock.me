import { and, count, eq, isNotNull } from "drizzle-orm";
import { Announce } from "@fedify/fedify";

import { db, posts, remoteBoosts } from "@/db";
import { logger } from "@/utils/logger";
import { getOrigin } from "./utils";

const domain = process.env.DOMAIN || "localhost:5000";
type BoostsDatabase = typeof db;

export interface RemoteBoost {
  id: number;
  post_id: number;
  object_uri: string;
  activity_uri: string;
  actor_uri: string;
  actor_name: string | null;
  raw_object_uri: string;
  received_at: Date;
}

export interface NewRemoteBoost {
  post_id: number;
  object_uri: string;
  activity_uri: string;
  actor_uri: string;
  actor_name?: string | null;
  raw_object_uri: string;
}

export function resolveLocalPublishedPostFromAnnouncedObjectUri(objectUri: string) {
  let url: URL;

  try {
    url = new URL(objectUri);
  } catch {
    return null;
  }

  const expectedOrigin = getOrigin(domain);
  if (url.origin !== expectedOrigin) {
    return null;
  }

  const match = /^\/posts\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) {
    return null;
  }

  const slug = decodeURIComponent(match[1]!);
  return db
    .select({ id: posts.id, slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.slug, slug), isNotNull(posts.published_at)))
    .get();
}

export function addRemoteBoost(
  input: NewRemoteBoost,
  database: BoostsDatabase = db
): RemoteBoost | null {
  const existing = database
    .select()
    .from(remoteBoosts)
    .where(eq(remoteBoosts.activity_uri, input.activity_uri))
    .get();

  if (existing) {
    logger.debug("federation", `Remote boost already exists: ${input.activity_uri}`);
    return existing;
  }

  return database
    .insert(remoteBoosts)
    .values({
      post_id: input.post_id,
      object_uri: input.object_uri,
      activity_uri: input.activity_uri,
      actor_uri: input.actor_uri,
      actor_name: input.actor_name ?? null,
      raw_object_uri: input.raw_object_uri,
      received_at: new Date(),
    })
    .returning()
    .get();
}

export function getRemoteBoostsForPost(
  postId: number,
  database: BoostsDatabase = db
): RemoteBoost[] {
  return database.select().from(remoteBoosts).where(eq(remoteBoosts.post_id, postId)).all();
}

export function getRemoteBoostCountForPost(postId: number, database: BoostsDatabase = db): number {
  const result = database
    .select({ count: count() })
    .from(remoteBoosts)
    .where(eq(remoteBoosts.post_id, postId))
    .get();
  return result?.count ?? 0;
}

export function deleteRemoteBoost(activityUri: string, database: BoostsDatabase = db): boolean {
  const deleted = database
    .delete(remoteBoosts)
    .where(eq(remoteBoosts.activity_uri, activityUri))
    .returning()
    .get();
  return Boolean(deleted);
}

export async function handleAnnounceActivity(announce: Announce): Promise<void> {
  const activityId = announce.id;
  const actorId = announce.actorId;
  const objectId = announce.objectId;

  if (!activityId || !actorId || !objectId) {
    logger.warn("federation", "Announce activity missing id, actor, or object");
    return;
  }

  const post = resolveLocalPublishedPostFromAnnouncedObjectUri(objectId.href);
  if (!post) {
    logger.debug(
      "federation",
      `Ignoring Announce for unknown or non-local object: ${objectId.href}`
    );
    return;
  }

  const stored = addRemoteBoost({
    post_id: post.id,
    object_uri: objectId.href,
    activity_uri: activityId.href,
    actor_uri: actorId.href,
    raw_object_uri: objectId.href,
  });

  if (stored) {
    logger.info("federation", `Stored Announce ${activityId.href} for post ${post.slug}`);
  }
}
