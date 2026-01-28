import { Hono } from "hono";
import { desc, isNotNull, eq } from "drizzle-orm";
import { db as defaultDb, posts, media } from "../db";
import { truncate } from "../utils/text";
import { mediaUrl } from "../services/media";

// Database type for dependency injection
type Database = typeof defaultDb;

// Site configuration
const SITE_URL = process.env.SITE_URL || "https://erikcraddock.me";
const SITE_TITLE = "erikcraddock.me";
const SITE_DESCRIPTION = "Personal blog by Erik Craddock";

/**
 * Escapes special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a date for RSS (RFC 822 format)
 */
function formatRssDate(date: Date): string {
  return date.toUTCString();
}

/**
 * Creates feed routes with the given database instance.
 * Allows dependency injection for testing.
 */
export function createFeedRoutes(db: Database): Hono {
  const feed = new Hono();

  feed.get("/feed.xml", (c) => {
    // Query recent published posts
    const recentPosts = db
      .select()
      .from(posts)
      .where(isNotNull(posts.published_at))
      .orderBy(desc(posts.published_at))
      .limit(20)
      .all();

    // Build RSS 2.0 XML
    const items = recentPosts
      .map((post) => {
        const title = post.title || "Untitled";
        const link = `${SITE_URL}/posts/${post.id}`;
        const description = post.excerpt || truncate(post.content, 300);
        const pubDate = post.published_at ? formatRssDate(new Date(post.published_at)) : "";

        // Get banner image for enclosure
        let enclosure = "";
        if (post.banner_image_id) {
          const bannerMedia = db
            .select()
            .from(media)
            .where(eq(media.id, post.banner_image_id))
            .get();
          if (bannerMedia) {
            const bannerFullUrl = `${SITE_URL}${mediaUrl(bannerMedia.s3_key)}`;
            enclosure = `\n      <enclosure url="${escapeXml(bannerFullUrl)}" type="${escapeXml(bannerMedia.mime_type)}" length="0"/>`;
          }
        }

        return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(link)}</guid>${enclosure}
    </item>`;
      })
      .join("\n");

    const lastBuildDate =
      recentPosts.length > 0 && recentPosts[0].published_at
        ? formatRssDate(new Date(recentPosts[0].published_at))
        : formatRssDate(new Date());

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return c.text(xml, 200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
    });
  });

  return feed;
}

// Default export using the global database
const feed = createFeedRoutes(defaultDb);

export { feed };
