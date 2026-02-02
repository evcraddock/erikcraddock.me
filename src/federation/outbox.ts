import { Create } from "@fedify/fedify";
import { desc, isNotNull, count } from "drizzle-orm";
import { db, posts } from "@/db";
import { logger } from "@/utils/logger";
import { baseUrl, dateToInstant } from "./utils";
import { postToObject, PublishedPost } from "./post-object";

// ActivityPub Public address
const PUBLIC = new URL("https://www.w3.org/ns/activitystreams#Public");

// Re-export for backward compatibility
export { postToObject } from "./post-object";
export type { PublishedPost } from "./post-object";

/**
 * Get published posts for the outbox, ordered by published_at descending.
 * Only returns posts that have been published (published_at is not null).
 */
export function getPublishedPosts(limit: number = 20, offset: number = 0): PublishedPost[] {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
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
 * Convert a post to a Create activity.
 */
export function postToCreateActivity(
  post: PublishedPost,
  actorUri: URL,
  followersUri: URL
): Create {
  const activityUri = new URL(`/posts/${post.id}#create`, baseUrl);
  const object = postToObject(post, actorUri, followersUri);

  logger.debug("federation", `Converting post ${post.id} to Create activity`);

  return new Create({
    id: activityUri,
    actor: actorUri,
    // Addressing: public posts visible to everyone, CC'd to followers
    to: PUBLIC,
    cc: followersUri,
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
  followersUri: URL,
  limit: number = 20,
  offset: number = 0
): Create[] {
  const publishedPosts = getPublishedPosts(limit, offset);
  return publishedPosts.map((post) => postToCreateActivity(post, actorUri, followersUri));
}
