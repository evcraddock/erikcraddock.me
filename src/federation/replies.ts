import { and, count, eq, isNotNull, or } from "drizzle-orm";
import { Create, isActor, Link, Note } from "@fedify/fedify";

import { db, posts, remoteComments } from "@/db";
import { escapeHtml, stripHtml } from "@/utils/markdown";
import { logger } from "@/utils/logger";
import { getOrigin } from "./utils";

const domain = process.env.DOMAIN || "localhost:5000";
type RepliesDatabase = typeof db;

export const REMOTE_COMMENT_PENDING_STATUS = "pending";

export interface RemoteComment {
  id: number;
  post_id: number;
  activity_uri: string;
  object_uri: string;
  actor_uri: string;
  actor_name: string | null;
  actor_url: string | null;
  content_html: string;
  content_text: string;
  in_reply_to_uri: string;
  moderation_status: string;
  raw_source: string;
  published_at: Date | null;
  received_at: Date;
}

export interface NewRemoteComment {
  post_id: number;
  activity_uri: string;
  object_uri: string;
  actor_uri: string;
  actor_name?: string | null;
  actor_url?: string | null;
  content_html: string;
  content_text: string;
  in_reply_to_uri: string;
  raw_source: string;
  published_at?: Date | null;
  moderation_status?: string;
}

interface LocalPostReference {
  id: number;
  slug: string;
}

export function sanitizeRemoteReplyContent(content: string): { html: string; text: string } {
  const text = stripHtml(content).trim();
  return {
    html: escapeHtml(text),
    text,
  };
}

export function resolveLocalPublishedPostFromReplyTargetUri(
  replyTargetUri: string
): LocalPostReference | null {
  let url: URL;

  try {
    url = new URL(replyTargetUri);
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
  return (
    db
      .select({ id: posts.id, slug: posts.slug })
      .from(posts)
      .where(and(eq(posts.slug, slug), isNotNull(posts.published_at)))
      .get() ?? null
  );
}

export function addRemoteComment(
  input: NewRemoteComment,
  database: RepliesDatabase = db
): RemoteComment | null {
  const existing = database
    .select()
    .from(remoteComments)
    .where(
      or(
        eq(remoteComments.activity_uri, input.activity_uri),
        eq(remoteComments.object_uri, input.object_uri)
      )
    )
    .get();

  if (existing) {
    logger.debug("federation", `Remote comment already exists: ${input.object_uri}`);
    return existing;
  }

  return database
    .insert(remoteComments)
    .values({
      post_id: input.post_id,
      activity_uri: input.activity_uri,
      object_uri: input.object_uri,
      actor_uri: input.actor_uri,
      actor_name: input.actor_name ?? null,
      actor_url: input.actor_url ?? null,
      content_html: input.content_html,
      content_text: input.content_text,
      in_reply_to_uri: input.in_reply_to_uri,
      moderation_status: input.moderation_status ?? REMOTE_COMMENT_PENDING_STATUS,
      raw_source: input.raw_source,
      published_at: input.published_at ?? null,
      received_at: new Date(),
    })
    .returning()
    .get();
}

export function getRemoteCommentsForPost(
  postId: number,
  database: RepliesDatabase = db
): RemoteComment[] {
  return database.select().from(remoteComments).where(eq(remoteComments.post_id, postId)).all();
}

export function getRemoteCommentCountForPost(
  postId: number,
  database: RepliesDatabase = db
): number {
  const result = database
    .select({ count: count() })
    .from(remoteComments)
    .where(eq(remoteComments.post_id, postId))
    .get();
  return result?.count ?? 0;
}

export function deleteRemoteCommentByActivityUri(
  activityUri: string,
  database: RepliesDatabase = db
): boolean {
  const deleted = database
    .delete(remoteComments)
    .where(eq(remoteComments.activity_uri, activityUri))
    .returning()
    .get();
  return Boolean(deleted);
}

export async function handleCreateActivity(create: Create): Promise<void> {
  const activityId = create.id;
  const actorId = create.actorId;

  if (!activityId || !actorId) {
    logger.warn("federation", "Create activity missing id or actor");
    return;
  }

  const object = await create.getObject({ suppressError: true });
  if (!(object instanceof Note)) {
    logger.debug("federation", `Ignoring Create with unsupported object type: ${activityId.href}`);
    return;
  }

  const replyTargetId = object.replyTargetId;
  const objectId = object.id;
  if (!replyTargetId || !objectId) {
    logger.debug(
      "federation",
      `Ignoring Create without reply target or object id: ${activityId.href}`
    );
    return;
  }

  const post = resolveLocalPublishedPostFromReplyTargetUri(replyTargetId.href);
  if (!post) {
    logger.debug(
      "federation",
      `Ignoring Create reply for unknown or non-local object: ${replyTargetId.href}`
    );
    return;
  }

  const content = stringValue(object.content);
  const sanitized = sanitizeRemoteReplyContent(content);
  const actor = await create.getActor({ suppressError: true });
  const rawSource = await serializeRawSource(object);
  const stored = addRemoteComment({
    post_id: post.id,
    activity_uri: activityId.href,
    object_uri: objectId.href,
    actor_uri: actorId.href,
    actor_name: actor && isActor(actor) ? stringValue(actor.name) : null,
    actor_url: actor && isActor(actor) ? urlValue(actor.url) : null,
    content_html: sanitized.html,
    content_text: sanitized.text,
    in_reply_to_uri: replyTargetId.href,
    raw_source: rawSource,
    published_at: object.published ? new Date(object.published.epochMilliseconds) : null,
  });

  if (stored) {
    logger.info("federation", `Stored Create reply ${activityId.href} for post ${post.slug}`);
  }
}

function stringValue(value: string | { toString(): string } | null): string {
  return typeof value === "string" ? value : (value?.toString() ?? "");
}

function urlValue(value: URL | Link | null): string | null {
  if (value instanceof URL) {
    return value.href;
  }

  return value?.href?.href ?? null;
}

async function serializeRawSource(object: Note): Promise<string> {
  try {
    return JSON.stringify(await object.toJsonLd({ format: "compact" }));
  } catch (error) {
    logger.debug("federation", "Failed to serialize remote reply source", {
      error: error instanceof Error ? error.message : String(error),
    });
    return JSON.stringify({ id: object.id?.href ?? null, type: "Note" });
  }
}
