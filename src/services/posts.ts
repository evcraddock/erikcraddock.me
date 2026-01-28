import { eq, desc, and, isNotNull } from "drizzle-orm";
import { db, posts, tags, postTags, media, sources } from "@/db";
import { mediaUrl } from "./media";

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
  source_id?: number | null;
  tags?: string[]; // Tag slugs
  banner_image_id?: number | null;
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

  const created = db.insert(tags).values({ name, slug }).returning().get();

  return created.id;
}

/**
 * Create a new post
 */
export function createPost(input: CreatePostInput) {
  const { type, title, content, excerpt, url, source_id, tags: tagSlugs, banner_image_id } = input;

  // Validate banner_image_id if provided
  if (banner_image_id !== undefined && banner_image_id !== null) {
    const bannerMedia = db.select().from(media).where(eq(media.id, banner_image_id)).get();
    if (!bannerMedia) {
      throw new Error(`Banner image not found: ${banner_image_id}`);
    }
  }

  // Validate source_id if provided
  if (source_id !== undefined && source_id !== null) {
    const sourceRecord = db.select().from(sources).where(eq(sources.id, source_id)).get();
    if (!sourceRecord) {
      throw new Error(`Source not found: ${source_id}`);
    }
  }

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
      source_id: source_id ?? null,
      banner_image_id: banner_image_id ?? null,
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

  // Get banner URL if banner_image_id is set
  let banner_url: string | null = null;
  if (post.banner_image_id) {
    const bannerMedia = db.select().from(media).where(eq(media.id, post.banner_image_id)).get();
    if (bannerMedia) {
      banner_url = mediaUrl(bannerMedia.s3_key);
    }
  }

  // Get source info if source_id is set
  let source: { id: number; name: string; url: string } | null = null;
  if (post.source_id) {
    const sourceRecord = db.select().from(sources).where(eq(sources.id, post.source_id)).get();
    if (sourceRecord) {
      source = { id: sourceRecord.id, name: sourceRecord.name, url: sourceRecord.url };
    }
  }

  return {
    ...post,
    banner_url,
    source,
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
  source_id?: number | null;
  tags?: string[]; // Tag slugs
  banner_image_id?: number | null;
}

/**
 * Update an existing post
 */
export function updatePost(id: number, input: UpdatePostInput) {
  const existing = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!existing) {
    return null;
  }

  const { title, content, excerpt, url, source_id, tags: tagSlugs, banner_image_id } = input;

  // Validate banner_image_id if provided
  if (banner_image_id !== undefined && banner_image_id !== null) {
    const bannerMedia = db.select().from(media).where(eq(media.id, banner_image_id)).get();
    if (!bannerMedia) {
      throw new Error(`Banner image not found: ${banner_image_id}`);
    }
  }

  // Validate source_id if provided
  if (source_id !== undefined && source_id !== null) {
    const sourceRecord = db.select().from(sources).where(eq(sources.id, source_id)).get();
    if (!sourceRecord) {
      throw new Error(`Source not found: ${source_id}`);
    }
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (url !== undefined) updates.url = url;
  if (source_id !== undefined) updates.source_id = source_id;
  if (banner_image_id !== undefined) updates.banner_image_id = banner_image_id;

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
 * Publish a post (set published_at if not already set)
 */
export function publishPost(id: number) {
  const existing = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!existing) {
    return null;
  }

  // Only set published_at if not already published
  if (!existing.published_at) {
    db.update(posts)
      .set({
        published_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(posts.id, id))
      .run();
  }

  return getPost(id);
}

/**
 * Unpublish a post (clear published_at)
 */
export function unpublishPost(id: number) {
  const existing = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!existing) {
    return null;
  }

  db.update(posts)
    .set({
      published_at: null,
      updated_at: new Date(),
    })
    .where(eq(posts.id, id))
    .run();

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

  // Get banner URL if banner_image_id is set
  let banner_url: string | null = null;
  if (post.banner_image_id) {
    const bannerMedia = db.select().from(media).where(eq(media.id, post.banner_image_id)).get();
    if (bannerMedia) {
      banner_url = mediaUrl(bannerMedia.s3_key);
    }
  }

  // Get source info if source_id is set
  let source: { id: number; name: string; url: string } | null = null;
  if (post.source_id) {
    const sourceRecord = db.select().from(sources).where(eq(sources.id, post.source_id)).get();
    if (sourceRecord) {
      source = { id: sourceRecord.id, name: sourceRecord.name, url: sourceRecord.url };
    }
  }

  return {
    ...post,
    banner_url,
    source,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
    tags: postTagRecords.map((t) => t.name),
  };
}
