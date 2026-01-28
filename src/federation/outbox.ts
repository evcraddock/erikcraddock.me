import { Create, Note, Article } from "@fedify/fedify";
import { desc, isNotNull, count } from "drizzle-orm";
import { db, posts } from "@/db";
import { logger } from "@/utils/logger";
import { dateToInstant, baseUrl } from "./utils";

export interface PublishedPost {
  id: number;
  type: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  url: string | null;
  published_at: Date;
}

/**
 * Get published posts for the outbox, ordered by published_at descending.
 * Only returns posts that have been published (published_at is not null).
 */
export function getPublishedPosts(limit: number = 20, offset: number = 0): PublishedPost[] {
  return db
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      content: posts.content,
      excerpt: posts.excerpt,
      url: posts.url,
      published_at: posts.published_at,
    })
    .from(posts)
    .where(isNotNull(posts.published_at))
    .orderBy(desc(posts.published_at))
    .limit(limit)
    .offset(offset)
    .all() as PublishedPost[];
}

/**
 * Get total count of published posts.
 */
export function getPublishedPostCount(): number {
  const result = db
    .select({ count: count() })
    .from(posts)
    .where(isNotNull(posts.published_at))
    .get();
  return result?.count ?? 0;
}

/**
 * Convert a post to an ActivityPub object (Note or Article).
 */
export function postToObject(post: PublishedPost, actorUri: URL): Note | Article {
  const postUri = new URL(`/posts/${post.id}`, baseUrl);

  // Use Article for posts with titles, Note for everything else (notes, links)
  const ObjectClass = post.title ? Article : Note;

  return new ObjectClass({
    id: postUri,
    attribution: actorUri,
    name: post.title ?? undefined,
    content: post.content,
    summary: post.excerpt ?? undefined,
    published: post.published_at ? dateToInstant(new Date(post.published_at)) : undefined,
    url: postUri,
  });
}

/**
 * Convert a post to a Create activity.
 */
export function postToCreateActivity(post: PublishedPost, actorUri: URL): Create {
  const activityUri = new URL(`/posts/${post.id}#create`, baseUrl);
  const object = postToObject(post, actorUri);

  logger.debug("federation", `Converting post ${post.id} to Create activity`);

  return new Create({
    id: activityUri,
    actor: actorUri,
    object: object,
    published: post.published_at ? dateToInstant(new Date(post.published_at)) : undefined,
  });
}

/**
 * Get Create activities for the outbox.
 * Returns activities for all published posts, ordered by published_at descending.
 */
export function getOutboxActivities(
  actorUri: URL,
  limit: number = 20,
  offset: number = 0
): Create[] {
  const publishedPosts = getPublishedPosts(limit, offset);
  return publishedPosts.map((post) => postToCreateActivity(post, actorUri));
}
