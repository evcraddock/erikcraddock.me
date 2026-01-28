import { Create, Note, Article, Image } from "@fedify/fedify";
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

/**
 * Convert a post to an ActivityPub object (Note or Article) with optional attachment.
 */
export function postToObjectWithAttachment(post: PostWithBanner, actorUri: URL): Note | Article {
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
function postToCreateActivity(post: PostWithBanner, actorUri: URL): Create {
  const activityUri = new URL(`/posts/${post.id}#create`, baseUrl);
  const object = postToObjectWithAttachment(post, actorUri);

  return new Create({
    id: activityUri,
    actor: actorUri,
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

  // Create the activity
  const activity = postToCreateActivity(post as PostWithBanner, actorUri);

  logger.info("federation", `Sending Create activity for post ${postId} to ${followers.length} followers`);

  try {
    // Send to all followers using Fedify's built-in delivery
    await ctx.sendActivity(
      { identifier: "erik" },
      "followers",
      activity,
      { preferSharedInbox: true }
    );

    logger.info("federation", `Successfully queued Create activity for post ${postId}`);
    return true;
  } catch (error) {
    logger.error("federation", `Failed to send Create activity for post ${postId}`, { error });
    return false;
  }
}
