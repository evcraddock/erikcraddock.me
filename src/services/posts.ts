import { eq, desc, and, isNotNull } from "drizzle-orm";
import { db, posts, tags, postTags } from "@/db";

export type PostType = "article" | "link" | "note";

export interface PostListItem {
  id: number;
  type: string;
  title: string | null;
  excerpt: string | null;
  published_at: string | null;
  tags: string[];
}

export interface ListPostsOptions {
  type?: PostType;
  tag?: string;
  limit?: number;
}

/**
 * List published posts with optional filtering
 */
export function listPosts(options: ListPostsOptions = {}): PostListItem[] {
  const { type, tag, limit = 50 } = options;

  // Build conditions
  const conditions = [isNotNull(posts.published_at)];

  if (type) {
    conditions.push(eq(posts.type, type));
  }

  // If filtering by tag, we need a subquery
  let postIds: number[] | null = null;
  if (tag) {
    const tagRecord = db.select({ id: tags.id }).from(tags).where(eq(tags.slug, tag)).get();

    if (!tagRecord) {
      return []; // Tag doesn't exist, no posts
    }

    const taggedPosts = db
      .select({ post_id: postTags.post_id })
      .from(postTags)
      .where(eq(postTags.tag_id, tagRecord.id))
      .all();

    postIds = taggedPosts.map((p) => p.post_id);

    if (postIds.length === 0) {
      return []; // No posts with this tag
    }
  }

  // Get posts - don't apply limit at DB level if filtering by tag
  // (we need to filter first, then apply limit)
  const baseQuery = db
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      excerpt: posts.excerpt,
      published_at: posts.published_at,
    })
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.published_at));

  // Only apply DB-level limit if not filtering by tag
  const postResults = postIds ? baseQuery.all() : baseQuery.limit(limit).all();

  // Filter by tag if needed, then apply limit
  let filteredPosts = postIds ? postResults.filter((p) => postIds!.includes(p.id)) : postResults;

  // Apply limit after tag filtering
  if (postIds && filteredPosts.length > limit) {
    filteredPosts = filteredPosts.slice(0, limit);
  }

  // Get tags for each post
  const postsWithTags: PostListItem[] = filteredPosts.map((post) => {
    const postTagRecords = db
      .select({ name: tags.name })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tag_id, tags.id))
      .where(eq(postTags.post_id, post.id))
      .all();

    return {
      id: post.id,
      type: post.type,
      title: post.title,
      excerpt: post.excerpt,
      published_at: post.published_at?.toISOString() ?? null,
      tags: postTagRecords.map((t) => t.name),
    };
  });

  return postsWithTags;
}

/**
 * Get a single post by ID
 */
export function getPost(id: number) {
  const post = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!post) {
    return null;
  }

  const postTagRecords = db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tag_id, tags.id))
    .where(eq(postTags.post_id, post.id))
    .all();

  return {
    ...post,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
    tags: postTagRecords.map((t) => t.name),
  };
}
