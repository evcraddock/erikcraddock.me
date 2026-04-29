import { and, count, desc, eq, isNotNull } from "drizzle-orm";

import { db, media, postTags, posts, tags } from "@/db";
import { mediaUrl } from "@/services/media";
import { baseUrl } from "./utils";
import { postToObject, type PostTag, type PublishedPost } from "./post-object";

/**
 * Get published posts marked as featured, ordered newest-first for stable
 * Mastodon-compatible profile pinning. Draft featured posts are intentionally
 * excluded so unpublished content never leaks through ActivityPub collections.
 */
export function getFeaturedPosts(): PublishedPost[] {
  const results = db
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
    .where(and(eq(posts.is_featured, true), isNotNull(posts.published_at)))
    .orderBy(desc(posts.published_at), desc(posts.id))
    .all();

  const postIds = results.map((post) => post.id);
  const allTags =
    postIds.length > 0
      ? db
          .select({
            postId: postTags.post_id,
            name: tags.name,
            slug: tags.slug,
          })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tag_id, tags.id))
          .all()
          .filter((tag) => postIds.includes(tag.postId))
      : [];

  const tagsMap = new Map<number, PostTag[]>();
  for (const tag of allTags) {
    const existing = tagsMap.get(tag.postId) ?? [];
    existing.push({ name: tag.name, slug: tag.slug });
    tagsMap.set(tag.postId, existing);
  }

  return results.map((post) => ({
    id: post.id,
    slug: post.slug,
    type: post.type,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    url: post.url,
    published_at: post.published_at!,
    updated_at: post.updated_at,
    banner_url: post.banner_s3_key ? new URL(mediaUrl(post.banner_s3_key), baseUrl).href : null,
    banner_alt: post.banner_alt,
    tags: tagsMap.get(post.id) ?? [],
  }));
}

export function getFeaturedPostCount(): number {
  const result = db
    .select({ count: count() })
    .from(posts)
    .where(and(eq(posts.is_featured, true), isNotNull(posts.published_at)))
    .get();

  return result?.count ?? 0;
}

export function getFeaturedPostObjects(actorUri: URL, followersUri: URL) {
  return getFeaturedPosts().map((post) => postToObject(post, actorUri, followersUri));
}
