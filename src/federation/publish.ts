import { Create, Delete, Update, Note, Article, Image, Person, Endpoints } from "@fedify/fedify";
import { eq } from "drizzle-orm";
import { db, posts, media } from "@/db";
import { federation } from "./setup";
import { getAllFollowers } from "./followers";
import { logger } from "@/utils/logger";
import { dateToInstant, baseUrl } from "./utils";

/**
 * Post with banner image info for federation.
 */
interface PostWithBanner {
  id: number;
  type: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  published_at: Date;
  banner_image_id: number | null;
}

/**
 * Banner image info.
 */
export interface BannerImage {
  s3_key: string;
  mime_type: string;
  alt_text: string | null;
}

/**
 * Get banner image info for a post.
 */
export function getBannerImage(bannerImageId: number): BannerImage | null {
  const banner = db.select().from(media).where(eq(media.id, bannerImageId)).get();
  if (!banner) return null;

  return {
    s3_key: banner.s3_key,
    mime_type: banner.mime_type,
    alt_text: banner.alt_text,
  };
}

/**
 * Create an ActivityPub Image attachment for a banner.
 */
export function createImageAttachment(banner: BannerImage): Image {
  const imageUrl = new URL(`/media/${banner.s3_key}`, baseUrl);

  return new Image({
    url: imageUrl,
    mediaType: banner.mime_type,
    name: banner.alt_text ?? undefined,
  });
}

// ActivityPub Public address
const PUBLIC = new URL("https://www.w3.org/ns/activitystreams#Public");

/**
 * Convert a post to an ActivityPub object (Note or Article) with optional attachment.
 */
export function postToObjectWithAttachment(
  post: PostWithBanner,
  actorUri: URL,
  followersUri: URL
): Note | Article {
  const postUri = new URL(`/posts/${post.id}`, baseUrl);

  // Use Article for posts with titles, Note for everything else
  const ObjectClass = post.title ? Article : Note;

  // Get banner image if present
  let attachments: Image[] | undefined;
  if (post.banner_image_id) {
    const banner = getBannerImage(post.banner_image_id);
    if (banner) {
      attachments = [createImageAttachment(banner)];
    }
  }

  return new ObjectClass({
    id: postUri,
    attribution: actorUri,
    // Addressing: public posts visible to everyone, CC'd to followers
    to: PUBLIC,
    cc: followersUri,
    name: post.title ?? undefined,
    content: post.content,
    summary: post.excerpt ?? undefined,
    published: post.published_at ? dateToInstant(new Date(post.published_at)) : undefined,
    url: postUri,
    attachments: attachments,
  });
}

/**
 * Convert a post to a Create activity.
 */
function postToCreateActivity(post: PostWithBanner, actorUri: URL, followersUri: URL): Create {
  const activityUri = new URL(`/posts/${post.id}#create`, baseUrl);
  const object = postToObjectWithAttachment(post, actorUri, followersUri);

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
  // Get the post with banner info
  const post = db
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      content: posts.content,
      excerpt: posts.excerpt,
      published_at: posts.published_at,
      banner_image_id: posts.banner_image_id,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .get();

  if (!post || !post.published_at) {
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
  const activity = postToCreateActivity(post as PostWithBanner, actorUri, followersUri);

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
export async function sendDeleteActivity(postId: number): Promise<boolean> {
  const followers = getAllFollowers();
  if (followers.length === 0) {
    logger.debug("federation", `No followers to send Delete for post ${postId}`);
    return true;
  }

  const ctx = federation.createContext(new URL(baseUrl), undefined);
  const actorUri = ctx.getActorUri("erik");

  // The object URI that was deleted
  const objectUri = new URL(`/posts/${postId}`, baseUrl);
  const activityUri = new URL(`/posts/${postId}#delete`, baseUrl);

  const activity = new Delete({
    id: activityUri,
    actor: actorUri,
    object: objectUri,
  });

  logger.info(
    "federation",
    `Sending Delete activity for post ${postId} to ${followers.length} followers`
  );

  try {
    await ctx.sendActivity({ identifier: "erik" }, "followers", activity, {
      preferSharedInbox: true,
    });

    logger.info("federation", `Successfully queued Delete activity for post ${postId}`);
    return true;
  } catch (error) {
    logger.error("federation", `Failed to send Delete activity for post ${postId}`, { error });
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
  // Get the post with banner info
  const post = db
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      content: posts.content,
      excerpt: posts.excerpt,
      published_at: posts.published_at,
      banner_image_id: posts.banner_image_id,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .get();

  if (!post || !post.published_at) {
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

  const activityUri = new URL(`/posts/${postId}#update-${Date.now()}`, baseUrl);
  const object = postToObjectWithAttachment(post as PostWithBanner, actorUri, followersUri);

  const activity = new Update({
    id: activityUri,
    actor: actorUri,
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

  // Build the Person object (same as actor dispatcher)
  const iconUrl = new URL("/images/erik-logo.png", baseUrl);
  const bannerUrl = new URL("/images/banner.png", baseUrl);

  const person = new Person({
    id: actorUri,
    preferredUsername: "erik",
    name: "Erik Craddock",
    summary: "Writer, coder, and musician — not always in that order.",
    icon: new Image({ url: iconUrl, mediaType: "image/png" }),
    image: new Image({ url: bannerUrl, mediaType: "image/png" }),
    url: new URL("/", baseUrl),
    inbox: ctx.getInboxUri("erik"),
    outbox: ctx.getOutboxUri("erik"),
    followers: ctx.getFollowersUri("erik"),
    endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
    publicKey: keys[0].cryptographicKey,
    assertionMethods: keys.map((key) => key.multikey),
  });

  const activityUri = new URL(`/users/erik#update-${Date.now()}`, baseUrl);
  const activity = new Update({
    id: activityUri,
    actor: actorUri,
    object: person,
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
