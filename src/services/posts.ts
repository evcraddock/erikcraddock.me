import { asc, eq, desc, and, isNotNull, isNull } from "drizzle-orm";
import { db, posts, tags, postTags, media, sources, sourceAuthors, people } from "@/db";
import { mediaUrl } from "./media";

export type PostType = "article" | "link" | "note";

export interface PostListItem {
  id: number;
  slug: string;
  type: string;
  title: string | null;
  excerpt: string | null;
  published_at: string | null;
  is_featured: boolean;
  source_id: number | null;
  author_id: number | null;
  source: SourceSummary | null;
  author: PersonSummary | null;
  tags: string[];
}

export type PostStatus = "draft" | "published" | "all";

type PersonSummary = {
  id: number;
  name: string;
  url: string | null;
};

type SourceSummary = {
  id: number;
  name: string;
  url: string;
  preview_title: string | null;
  preview_description: string | null;
  preview_image_url: string | null;
  preview_site_name: string | null;
  favicon_url: string | null;
  authors: Array<{
    id: number;
    name: string;
    url: string | null;
    sort_order: number;
  }>;
};

function getPersonSummary(personId: number): PersonSummary | null {
  const person = db.select().from(people).where(eq(people.id, personId)).get();
  return person ? { id: person.id, name: person.name, url: person.url } : null;
}

function validatePersonId(personId: number): void {
  if (!getPersonSummary(personId)) {
    throw new Error(`Person not found: ${personId}`);
  }
}

function getSourceSummary(sourceId: number): SourceSummary | null {
  const sourceRecord = db.select().from(sources).where(eq(sources.id, sourceId)).get();
  if (!sourceRecord) {
    return null;
  }

  const authors = db
    .select({
      id: people.id,
      name: people.name,
      url: people.url,
      sort_order: sourceAuthors.sort_order,
    })
    .from(sourceAuthors)
    .innerJoin(people, eq(sourceAuthors.person_id, people.id))
    .where(eq(sourceAuthors.source_id, sourceRecord.id))
    .orderBy(asc(sourceAuthors.sort_order), asc(sourceAuthors.id))
    .all();

  return {
    id: sourceRecord.id,
    name: sourceRecord.name,
    url: sourceRecord.url,
    preview_title: sourceRecord.preview_title,
    preview_description: sourceRecord.preview_description,
    preview_image_url: sourceRecord.preview_image_url,
    preview_site_name: sourceRecord.preview_site_name,
    favicon_url: sourceRecord.favicon_url,
    authors,
  };
}

export interface ListPostsOptions {
  type?: PostType;
  tag?: string;
  limit?: number;
  status?: PostStatus;
}

/**
 * List posts with optional filtering
 */
export function listPosts(options: ListPostsOptions = {}): PostListItem[] {
  const { type, tag, limit = 50, status } = options;

  // Build conditions
  const conditions = [];

  // Status filter (default to published only for backwards compatibility)
  if (status === "draft") {
    conditions.push(isNull(posts.published_at));
  } else if (status === "all") {
    // No filter - show both drafts and published
  } else {
    // Default and "published": show published only (backwards compatible)
    conditions.push(isNotNull(posts.published_at));
  }

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
  // Order by created_at for drafts/all, published_at for published only
  const orderColumn =
    status === "draft" || status === "all" ? posts.created_at : posts.published_at;

  const selectQuery = db
    .select({
      id: posts.id,
      slug: posts.slug,
      type: posts.type,
      title: posts.title,
      excerpt: posts.excerpt,
      published_at: posts.published_at,
      is_featured: posts.is_featured,
      source_id: posts.source_id,
      author_id: posts.author_id,
    })
    .from(posts);

  // Apply conditions if any, otherwise no where clause
  const baseQuery =
    conditions.length > 0
      ? selectQuery.where(and(...conditions)).orderBy(desc(orderColumn))
      : selectQuery.orderBy(desc(orderColumn));

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
      slug: post.slug,
      type: post.type,
      title: post.title,
      excerpt: post.excerpt,
      published_at: post.published_at?.toISOString() ?? null,
      is_featured: post.is_featured,
      source_id: post.source_id,
      author_id: post.author_id,
      source: post.source_id ? getSourceSummary(post.source_id) : null,
      author: post.author_id ? getPersonSummary(post.author_id) : null,
      tags: postTagRecords.map((t) => t.name),
    };
  });

  return postsWithTags;
}

export interface CreatePostInput {
  type: PostType;
  slug: string;
  title?: string | null;
  content: string;
  excerpt?: string | null;
  url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_site_name?: string | null;
  source_id?: number | null;
  author_id?: number | null;
  tags?: string[]; // Tag slugs
  banner_image_id?: number | null;
  is_featured?: boolean;
  published_at?: Date | null; // For imports - set to create as already published
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
  const {
    type,
    slug,
    title,
    content,
    excerpt,
    url,
    og_title,
    og_description,
    og_image_url,
    og_site_name,
    source_id,
    author_id,
    tags: tagSlugs,
    banner_image_id,
    is_featured,
    published_at,
  } = input;

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

  // Validate author_id if provided
  if (author_id !== undefined && author_id !== null) {
    validatePersonId(author_id);
  }

  // Auto-generate excerpt if not provided
  const finalExcerpt = excerpt ?? content.slice(0, 200) + (content.length > 200 ? "..." : "");

  const now = new Date();

  // Create the post
  // If published_at is provided, use it for updated_at too (for imports)
  const post = db
    .insert(posts)
    .values({
      type,
      slug,
      title: title ?? null,
      content,
      excerpt: finalExcerpt,
      url: url ?? null,
      og_title: og_title ?? null,
      og_description: og_description ?? null,
      og_image_url: og_image_url ?? null,
      og_site_name: og_site_name ?? null,
      source_id: source_id ?? null,
      author_id: author_id ?? null,
      banner_image_id: banner_image_id ?? null,
      is_featured: is_featured ?? false,
      created_at: published_at ?? now,
      updated_at: published_at ?? now,
      published_at: published_at ?? null,
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

  // Get source and author info if set
  const source = post.source_id ? getSourceSummary(post.source_id) : null;
  const author = post.author_id ? getPersonSummary(post.author_id) : null;

  return {
    ...post,
    banner_url,
    source,
    author,
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
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_site_name?: string | null;
  source_id?: number | null;
  author_id?: number | null;
  tags?: string[]; // Tag slugs
  banner_image_id?: number | null;
  is_featured?: boolean;
}

/**
 * Update an existing post
 */
export function updatePost(id: number, input: UpdatePostInput) {
  const existing = db.select().from(posts).where(eq(posts.id, id)).get();

  if (!existing) {
    return null;
  }

  const {
    title,
    content,
    excerpt,
    url,
    og_title,
    og_description,
    og_image_url,
    og_site_name,
    source_id,
    author_id,
    tags: tagSlugs,
    banner_image_id,
    is_featured,
  } = input;

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

  // Validate author_id if provided
  if (author_id !== undefined && author_id !== null) {
    validatePersonId(author_id);
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (url !== undefined) updates.url = url;
  if (og_title !== undefined) updates.og_title = og_title;
  if (og_description !== undefined) updates.og_description = og_description;
  if (og_image_url !== undefined) updates.og_image_url = og_image_url;
  if (og_site_name !== undefined) updates.og_site_name = og_site_name;
  if (source_id !== undefined) updates.source_id = source_id;
  if (author_id !== undefined) updates.author_id = author_id;
  if (banner_image_id !== undefined) updates.banner_image_id = banner_image_id;
  if (is_featured !== undefined) updates.is_featured = is_featured;

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

  // Get source and author info if set
  const source = post.source_id ? getSourceSummary(post.source_id) : null;
  const author = post.author_id ? getPersonSummary(post.author_id) : null;

  return {
    ...post,
    banner_url,
    source,
    author,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
    tags: postTagRecords.map((t) => t.name),
  };
}

/**
 * Get a single post by slug
 */
export function getPostBySlug(slug: string) {
  const post = db.select().from(posts).where(eq(posts.slug, slug)).get();

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

  // Get source and author info if set
  const source = post.source_id ? getSourceSummary(post.source_id) : null;
  const author = post.author_id ? getPersonSummary(post.author_id) : null;

  return {
    ...post,
    banner_url,
    source,
    author,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
    tags: postTagRecords.map((t) => t.name),
  };
}
