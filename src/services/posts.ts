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

export interface CreatePostInput {
  type: PostType;
  title?: string | null;
  content: string;
  excerpt?: string | null;
  url?: string | null;
  tags?: string[]; // Tag slugs
}

/**
 * Generate a slug from a string
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get or create a tag by slug
 */
function getOrCreateTag(slug: string): number {
  const existing = db.select().from(tags).where(eq(tags.slug, slug)).get();

  if (existing) {
    return existing.id;
  }

  // Create new tag - convert slug to title case for name
  const name = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const created = db
    .insert(tags)
    .values({ name, slug })
    .returning()
    .get();

  return created.id;
}

/**
 * Create a new post
 */
export function createPost(input: CreatePostInput) {
  const { type, title, content, excerpt, url, tags: tagSlugs } = input;

  // Auto-generate excerpt if not provided
  const finalExcerpt = excerpt ?? content.slice(0, 200) + (content.length > 200 ? "..." : "");

  const now = new Date();

  // Create the post
  const post = db
    .insert(posts)
    .values({
      type,
      title: title ?? null,
      content,
      excerpt: finalExcerpt,
      url: url ?? null,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get();

  // Handle tags
  const tagNames: string[] = [];
  if (tagSlugs && tagSlugs.length > 0) {
    for (const slug of tagSlugs) {
      const normalizedSlug = slugify(slug);
      if (normalizedSlug) {
        const tagId = getOrCreateTag(normalizedSlug);
        db.insert(postTags).values({ post_id: post.id, tag_id: tagId }).run();

        // Get the tag name for the response
        const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();
        if (tag) {
          tagNames.push(tag.name);
        }
      }
    }
  }

  return {
    ...post,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
    tags: tagNames,
  };
}

export interface UpdatePostInput {
  title?: string | null;
  content?: string;
  excerpt?: string | null;
  url?: string | null;
  tags?: string[]; // Tag slugs
}

/**
 * Update an existing post
 */
export function updatePost(id: number, input: UpdatePostInput) {
  const existing = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!existing) {
    return null;
  }

  const { title, content, excerpt, url, tags: tagSlugs } = input;

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (url !== undefined) updates.url = url;

  // Update post
  db.update(posts).set(updates).where(eq(posts.id, id)).run();

  // Update tags if provided
  if (tagSlugs !== undefined) {
    // Remove existing tag associations
    db.delete(postTags).where(eq(postTags.post_id, id)).run();

    // Add new tags
    for (const slug of tagSlugs) {
      const normalizedSlug = slugify(slug);
      if (normalizedSlug) {
        const tagId = getOrCreateTag(normalizedSlug);
        db.insert(postTags).values({ post_id: id, tag_id: tagId }).run();
      }
    }
  }

  // Return updated post
  return getPost(id);
}

/**
 * Delete a post
 */
export function deletePost(id: number): boolean {
  const existing = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!existing) {
    return false;
  }

  // Delete tag associations (cascade should handle this, but be explicit)
  db.delete(postTags).where(eq(postTags.post_id, id)).run();

  // Delete the post
  db.delete(posts).where(eq(posts.id, id)).run();

  return true;
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
