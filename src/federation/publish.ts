import { Create, Delete, Update } from "@fedify/fedify";
import { eq } from "drizzle-orm";
import { db, posts, media, postTags, tags } from "@/db";
import { federation } from "./setup";
import { getAllFollowers } from "./followers";
import { logger } from "@/utils/logger";
import { dateToInstant, baseUrl } from "./utils";
import { postToObject, PublishedPost, PostTag } from "./post-object";
import { mediaUrl } from "@/services/media";
import { buildActorUpdateActivity } from "./actor-profile";

// ActivityPub Public address
const PUBLIC = new URL("https://www.w3.org/ns/activitystreams#Public");

/**
 * Get a published post by ID with all fields needed for federation.
 * Returns null if post not found or not published.
 */
function getPublishedPostById(postId: number): PublishedPost | null {
  const result = db
    .select({
      id: posts.id,
      slug: posts.slug,
      type: posts.type,
      title: posts.title,
      content: posts.content,
      excerpt: posts.excerpt,
      url: posts.url,
      published_at: posts.published_at,
      updated_at: posts.updated_at,
      banner_s3_key: media.s3_key,
      banner_alt: media.alt_text,
    })
    .from(posts)
    .leftJoin(media, eq(posts.banner_image_id, media.id))
    .where(eq(posts.id, postId))
    .get();

  if (!result || !result.published_at) {
    return null;
  }

  // Fetch tags for this post
  const postTagsResult: PostTag[] = db
    .select({
      name: tags.name,
      slug: tags.slug,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tag_id, tags.id))
    .where(eq(postTags.post_id, postId))
    .all();

  return {
    id: result.id,
    slug: result.slug,
    type: result.type,
    title: result.title,
    content: result.content,
    excerpt: result.excerpt,
    url: result.url,
    published_at: result.published_at,
    updated_at: result.updated_at,
    banner_url: result.banner_s3_key ? new URL(mediaUrl(result.banner_s3_key), baseUrl).href : null,
    banner_alt: result.banner_alt,
    tags: postTagsResult,
  };
}

/**
 * Convert a post to a Create activity.
 */
function postToCreateActivity(post: PublishedPost, actorUri: URL, followersUri: URL): Create {
  const activityUri = new URL(`/posts/${post.slug}#create`, baseUrl);
  const object = postToObject(post, actorUri, followersUri);

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
 * Send a Create activity for a published post to all followers.
 *
 * This should be called after a post is published (published_at is set).
 * Uses Fedify's delivery system which handles:
 * - HTTP signatures
 * - Shared inbox optimization
 * - Retry on failure
 *
 * @param postId The ID of the post to federate
 * @returns true if activity was sent, false if post not found or no followers
 */
export async function federatePost(postId: number): Promise<boolean> {
  const post = getPublishedPostById(postId);

  if (!post) {
    logger.warn("federation", `Cannot federate post ${postId}: not found or not published`);
    return false;
  }

  // Check if we have any followers
  const followers = getAllFollowers();
  if (followers.length === 0) {
    logger.debug("federation", `No followers to send post ${postId} to`);
    return true; // Not an error, just no one to send to
  }

  // Create context for sending
  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");
  const followersUri = ctx.getFollowersUri("erik");

  // Create the activity
  const activity = postToCreateActivity(post, actorUri, followersUri);

  logger.info(
    "federation",
    `Sending Create activity for post ${postId} to ${followers.length} followers`
  );

  try {
    // Send to all followers using Fedify's built-in delivery
    await ctx.sendActivity({ identifier: "erik" }, "followers", activity, {
      preferSharedInbox: true,
    });

    logger.info("federation", `Successfully queued Create activity for post ${postId}`);
    return true;
  } catch (error) {
    logger.error("federation", `Failed to send Create activity for post ${postId}`, { error });
    return false;
  }
}

/**
 * Send a Delete activity for a post to all followers.
 *
 * Should be called when a previously published post is deleted.
 * Remote servers should remove their cached copy.
 *
 * @param postId The ID of the deleted post
 * @returns true if activity was sent, false if no followers
 */
export async function sendDeleteActivity(slug: string): Promise<boolean> {
  const followers = getAllFollowers();
  if (followers.length === 0) {
    logger.debug("federation", `No followers to send Delete for post ${slug}`);
    return true;
  }

  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");
  const followersUri = ctx.getFollowersUri("erik");

  // The object URI that was deleted (must match the URI used when created)
  const objectUri = new URL(`/posts/${slug}`, baseUrl);
  const activityUri = new URL(`/posts/${slug}#delete`, baseUrl);

  const activity = new Delete({
    id: activityUri,
    actor: actorUri,
    object: objectUri,
    to: PUBLIC,
    cc: followersUri,
  });

  logger.info(
    "federation",
    `Sending Delete activity for post ${slug} to ${followers.length} followers`
  );

  try {
    await ctx.sendActivity({ identifier: "erik" }, "followers", activity, {
      preferSharedInbox: true,
    });

    logger.info("federation", `Successfully queued Delete activity for post ${slug}`);
    return true;
  } catch (error) {
    logger.error("federation", `Failed to send Delete activity for post ${slug}`, { error });
    return false;
  }
}

/**
 * Send a Delete activity for an arbitrary URI.
 *
 * Use this to delete posts that were federated with old URIs,
 * or to clean up posts during development.
 *
 * @param uri The full URI of the object to delete (e.g., https://erikcraddock.me/posts/4)
 * @returns true if activity was sent, false if no followers
 */
export async function sendDeleteActivityForUri(uri: string): Promise<boolean> {
  const followers = getAllFollowers();
  if (followers.length === 0) {
    logger.debug("federation", `No followers to send Delete for URI ${uri}`);
    return true;
  }

  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");
  const followersUri = ctx.getFollowersUri("erik");

  const objectUri = new URL(uri);
  const activityUri = new URL(`${uri}#delete-${Date.now()}`);

  const activity = new Delete({
    id: activityUri,
    actor: actorUri,
    object: objectUri,
    to: PUBLIC,
    cc: followersUri,
  });

  logger.info(
    "federation",
    `Sending Delete activity for URI ${uri} to ${followers.length} followers`
  );

  try {
    await ctx.sendActivity({ identifier: "erik" }, "followers", activity, {
      preferSharedInbox: true,
    });

    logger.info("federation", `Successfully queued Delete activity for URI ${uri}`);
    return true;
  } catch (error) {
    logger.error("federation", `Failed to send Delete activity for URI ${uri}`, { error });
    return false;
  }
}

/**
 * Send an Update activity for a post to all followers.
 *
 * Should be called when a published post is edited.
 * Remote servers should update their cached copy.
 *
 * @param postId The ID of the updated post
 * @returns true if activity was sent, false if post not found or no followers
 */
export async function sendUpdateActivity(postId: number): Promise<boolean> {
  const post = getPublishedPostById(postId);

  if (!post) {
    logger.warn("federation", `Cannot send Update for post ${postId}: not found or not published`);
    return false;
  }

  const followers = getAllFollowers();
  if (followers.length === 0) {
    logger.debug("federation", `No followers to send Update for post ${postId}`);
    return true;
  }

  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");
  const followersUri = ctx.getFollowersUri("erik");

  const activityUri = new URL(`/posts/${post.slug}#update-${Date.now()}`, baseUrl);
  const object = postToObject(post, actorUri, followersUri);

  const activity = new Update({
    id: activityUri,
    actor: actorUri,
    // Addressing: public posts visible to everyone, CC'd to followers
    to: PUBLIC,
    cc: followersUri,
    object: object,
  });

  logger.info(
    "federation",
    `Sending Update activity for post ${postId} to ${followers.length} followers`
  );

  try {
    await ctx.sendActivity({ identifier: "erik" }, "followers", activity, {
      preferSharedInbox: true,
    });

    logger.info("federation", `Successfully queued Update activity for post ${postId}`);
    return true;
  } catch (error) {
    logger.error("federation", `Failed to send Update activity for post ${postId}`, { error });
    return false;
  }
}

/**
 * Send an Update activity for the actor profile to all followers.
 *
 * Should be called when actor profile changes (icon, name, summary, etc.).
 * Remote servers should update their cached copy of the actor.
 *
 * @returns true if activity was sent, false if no followers
 */
export async function sendActorUpdateActivity(): Promise<boolean> {
  const followers = getAllFollowers();
  if (followers.length === 0) {
    logger.debug("federation", "No followers to send actor Update to");
    return true;
  }

  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");

  // Get key pairs for the actor
  const keys = await ctx.getActorKeyPairs("erik");

  const activity = buildActorUpdateActivity({
    identifier: "erik",
    canonicalOrigin: baseUrl,
    activityId: new URL(`/users/erik#update-${Date.now()}`, baseUrl),
    uris: {
      actor: actorUri,
      inbox: ctx.getInboxUri("erik"),
      outbox: ctx.getOutboxUri("erik"),
      followers: ctx.getFollowersUri("erik"),
      following: ctx.getFollowingUri("erik"),
      sharedInbox: ctx.getInboxUri(),
    },
    keys,
  });

  logger.info("federation", `Sending actor Update activity to ${followers.length} followers`);

  try {
    await ctx.sendActivity({ identifier: "erik" }, "followers", activity, {
      preferSharedInbox: true,
    });

    logger.info("federation", "Successfully queued actor Update activity");
    return true;
  } catch (error) {
    logger.error("federation", "Failed to send actor Update activity", { error });
    return false;
  }
}
