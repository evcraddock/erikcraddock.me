import { Note, Article, Document } from "@fedify/fedify";
import { dateToInstant, baseUrl } from "./utils";

// ActivityPub Public address
const PUBLIC = new URL("https://www.w3.org/ns/activitystreams#Public");

export interface PublishedPost {
  id: number;
  slug: string;
  type: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  url: string | null;
  published_at: Date;
  banner_url?: string | null;
  banner_alt?: string | null;
}

/**
 * Convert a post to an ActivityPub object (Note or Article).
 */
export function postToObject(
  post: PublishedPost,
  actorUri: URL,
  followersUri: URL
): Note | Article {
  const postUri = new URL(`/posts/${post.slug}`, baseUrl);

  // Use Article for articles (posts with titles that aren't links)
  // Use Note for notes and links (links are commentary + URL, displayed inline)
  const ObjectClass = post.title && post.type !== "link" ? Article : Note;

  // Build content based on post type:
  // - Notes: full content (short by nature)
  // - Links: commentary + external URL (Mastodon generates preview card)
  // - Articles: excerpt + link to article (Mastodon generates preview card from our site)
  let content = post.content;
  const postUrl = new URL(`/posts/${post.slug}`, baseUrl).href;

  if (post.type === "link" && post.url) {
    content = `${post.content}\n\n${post.url}`;
  } else if (post.type === "article") {
    content = post.excerpt ? `${post.excerpt}\n\n${postUrl}` : postUrl;
  }

  // Build attachments array for media (banner images on articles only)
  const attachments: Document[] = [];
  if (post.type === "article" && post.banner_url) {
    // Determine media type from URL extension
    const ext = post.banner_url.split(".").pop()?.toLowerCase();
    const mediaType =
      ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";

    const bannerUrlObj = new URL(post.banner_url);
    attachments.push(
      new Document({
        id: bannerUrlObj,
        url: bannerUrlObj,
        mediaType,
        name: post.banner_alt ?? post.title ?? undefined,
      })
    );
  }

  return new ObjectClass({
    id: postUri,
    attribution: actorUri,
    // Addressing: public posts visible to everyone, CC'd to followers
    to: PUBLIC,
    cc: followersUri,
    // Only set name for Articles (not links, not notes)
    name: post.title && post.type !== "link" ? post.title : undefined,
    content: content,
    // Only set summary for Articles - for Notes it triggers CW behavior
    summary: post.title && post.type !== "link" ? (post.excerpt ?? undefined) : undefined,
    published: post.published_at ? dateToInstant(new Date(post.published_at)) : undefined,
    url: postUri,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}
