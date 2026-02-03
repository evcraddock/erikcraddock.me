import { Note, Article, Document, LanguageString } from "@fedify/fedify";
import { dateToInstant, baseUrl } from "./utils";
import { renderMarkdown } from "../utils/markdown";

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
  updated_at: Date;
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

  // Build content as HTML based on post type:
  // - Notes: full content rendered as HTML
  // - Links: commentary HTML + external URL as clickable link (Mastodon crawls first link for preview)
  // - Articles: excerpt HTML + link to article
  // Mastodon expects HTML content and parses <a> tags to find links for preview cards.
  const postUrl = new URL(`/posts/${post.slug}`, baseUrl).href;
  let content: string;

  if (post.type === "link" && post.url) {
    // Link posts: render commentary as HTML, append external URL as visible link
    const commentaryHtml = renderMarkdown(post.content);
    content = `${commentaryHtml}<p><a href="${post.url}">${post.url}</a></p>`;
  } else if (post.type === "article") {
    // Articles: render excerpt as HTML, append link to our site
    const excerptHtml = post.excerpt ? renderMarkdown(post.excerpt) : "";
    content = excerptHtml
      ? `${excerptHtml}<p><a href="${postUrl}">${postUrl}</a></p>`
      : `<p><a href="${postUrl}">${postUrl}</a></p>`;
  } else {
    // Notes: render full content as HTML
    content = renderMarkdown(post.content);
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
    // Use contents (plural) with both plain string and LanguageString to output both
    // 'content' and 'contentMap' fields. Mastodon needs 'content' for Updates to work,
    // and 'contentMap' tells it the language (avoiding "Translate" link).
    contents: [content, new LanguageString(content, "en")],
    // Only set summary for Articles - for Notes it triggers CW behavior
    summary: post.title && post.type !== "link" ? (post.excerpt ?? undefined) : undefined,
    published: post.published_at ? dateToInstant(new Date(post.published_at)) : undefined,
    updated: post.updated_at ? dateToInstant(new Date(post.updated_at)) : undefined,
    // For links, url points to external article so Mastodon links there and generates preview
    url: post.type === "link" && post.url ? new URL(post.url) : postUri,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}
