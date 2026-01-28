import { Create, Note, Article } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { desc, isNotNull } from "drizzle-orm";
import { db, posts } from "@/db";
import { logger } from "@/utils/logger";

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";
const protocol = domain.includes("localhost") ? "http" : "https";

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
    .select({ id: posts.id })
    .from(posts)
    .where(isNotNull(posts.published_at))
    .all();
  return result.length;
}

/**
 * Convert a Date to Temporal.Instant for Fedify.
 */
function dateToInstant(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}

/**
 * Convert a post to an ActivityPub object (Note or Article).
 */
export function postToObject(post: PublishedPost, actorUri: URL): Note | Article {
  const postUri = new URL(`/posts/${post.id}`, `${protocol}://${domain}`);
  
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
  const activityUri = new URL(`/posts/${post.id}#create`, `${protocol}://${domain}`);
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
export function getOutboxActivities(actorUri: URL, limit: number = 20, offset: number = 0): Create[] {
  const publishedPosts = getPublishedPosts(limit, offset);
  return publishedPosts.map((post) => postToCreateActivity(post, actorUri));
}
