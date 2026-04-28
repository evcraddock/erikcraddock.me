import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { Like } from "@fedify/fedify";

import { db, posts, remoteLikes } from "@/db";
import { logger } from "@/utils/logger";
import { getOrigin } from "./utils";

const domain = process.env.DOMAIN || "localhost:5000";
type LikesDatabase = typeof db;

export interface RemoteLike {
  id: number;
  post_id: number;
  object_uri: string;
  activity_uri: string;
  actor_uri: string;
  actor_name: string | null;
  raw_object_uri: string;
  received_at: Date;
}

export interface NewRemoteLike {
  post_id: number;
  object_uri: string;
  activity_uri: string;
  actor_uri: string;
  actor_name?: string | null;
  raw_object_uri: string;
}

export interface RemoteLikeSummary {
  actor_uri: string;
  actor_name: string | null;
  activity_uri: string;
  object_uri: string;
  received_at: string;
}

export function resolveLocalPublishedPostFromObjectUri(objectUri: string) {
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

export function addRemoteLike(
  input: NewRemoteLike,
  database: LikesDatabase = db
): RemoteLike | null {
  const existing = database
    .select()
    .from(remoteLikes)
    .where(eq(remoteLikes.activity_uri, input.activity_uri))
    .get();

  if (existing) {
    logger.debug("federation", `Remote like already exists: ${input.activity_uri}`);
    return existing;
  }

  return database
    .insert(remoteLikes)
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

export function getRemoteLikesForPost(postId: number, database: LikesDatabase = db): RemoteLike[] {
  return database.select().from(remoteLikes).where(eq(remoteLikes.post_id, postId)).all();
}

export function getRemoteLikeCountForPost(postId: number, database: LikesDatabase = db): number {
  const result = database
    .select({ count: count() })
    .from(remoteLikes)
    .where(eq(remoteLikes.post_id, postId))
    .get();
  return result?.count ?? 0;
}

export function listRemoteLikeSummariesForPost(
  postId: number,
  database: LikesDatabase = db
): RemoteLikeSummary[] {
  return database
    .select({
      actor_uri: remoteLikes.actor_uri,
      actor_name: remoteLikes.actor_name,
      activity_uri: remoteLikes.activity_uri,
      object_uri: remoteLikes.object_uri,
      received_at: remoteLikes.received_at,
    })
    .from(remoteLikes)
    .where(eq(remoteLikes.post_id, postId))
    .orderBy(desc(remoteLikes.received_at))
    .all()
    .map((like) => ({
      ...like,
      received_at: like.received_at.toISOString(),
    }));
}

export function deleteRemoteLike(activityUri: string, database: LikesDatabase = db): boolean {
  const deleted = database
    .delete(remoteLikes)
    .where(eq(remoteLikes.activity_uri, activityUri))
    .returning()
    .get();
  return Boolean(deleted);
}

export async function handleLikeActivity(like: Like): Promise<void> {
  const activityId = like.id;
  const actorId = like.actorId;
  const objectId = like.objectId;

  if (!activityId || !actorId || !objectId) {
    logger.warn("federation", "Like activity missing id, actor, or object");
    return;
  }

  const post = resolveLocalPublishedPostFromObjectUri(objectId.href);
  if (!post) {
    logger.debug("federation", `Ignoring Like for unknown or non-local object: ${objectId.href}`);
    return;
  }

  const stored = addRemoteLike({
    post_id: post.id,
    object_uri: objectId.href,
    activity_uri: activityId.href,
    actor_uri: actorId.href,
    raw_object_uri: objectId.href,
  });

  if (stored) {
    logger.info("federation", `Stored Like ${activityId.href} for post ${post.slug}`);
  }
}
