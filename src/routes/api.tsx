import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireApiKey } from "@/auth/api-key";
import {
  listPosts,
  getPost,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  unpublishPost,
  PostType,
  PostStatus,
} from "@/services/posts";
import { createMedia, deleteMedia, getMedia, isAllowedMimeType } from "@/services/media";
import {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
} from "@/services/sources";
import { listTags } from "@/services/tags";
import {
  federatePost,
  sendDeleteActivity,
  sendUpdateActivity,
  sendActorUpdateActivity,
} from "@/federation/publish";

export const api = new Hono();

// Apply API key middleware to all API routes
api.use("*", requireApiKey);

/**
 * GET /api/ping - Health check endpoint
 */
api.get("/ping", (c) => {
  const auth = c.get("apiAuth");
  return c.json({
    data: {
      status: "ok",
      authenticated: auth.email,
    },
  });
});

/**
 * GET /api/posts - List posts
 * Query params:
 *   - type: 'article' | 'link' | 'note'
 *   - tag: tag slug to filter by
 *   - limit: max number of posts (default 50)
 *   - status: 'draft' | 'published' | 'all' (default 'published')
 */
api.get("/posts", (c) => {
  const type = c.req.query("type") as PostType | undefined;
  const tag = c.req.query("tag");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const status = c.req.query("status") as PostStatus | undefined;

  // Validate type if provided
  if (type && !["article", "link", "note"].includes(type)) {
    return c.json({ error: "Invalid type. Must be article, link, or note" }, 400);
  }

  // Validate limit if provided
  if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
    return c.json({ error: "Invalid limit. Must be between 1 and 100" }, 400);
  }

  // Validate status if provided
  if (status && !["draft", "published", "all"].includes(status)) {
    return c.json({ error: "Invalid status. Must be draft, published, or all" }, 400);
  }

  const posts = listPosts({ type, tag, limit, status });

  return c.json({ data: posts });
});

/**
 * GET /api/posts/:id - Get single post
 */
api.get("/posts/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  const post = getPost(id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ data: post });
});

// Slug validation pattern: lowercase letters, numbers, hyphens only
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LENGTH = 200;

/**
 * POST /api/posts - Create new post
 */
api.post("/posts", async (c) => {
  const body = await c.req.json();

  // Validate type
  const { type, slug, title, content, excerpt, url, source_id, tags, banner_image_id } = body;

  if (!type || !["article", "link", "note"].includes(type)) {
    return c.json({ error: "Invalid or missing type. Must be article, link, or note" }, 400);
  }

  // Validate slug
  if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
    return c.json({ error: "Slug is required" }, 400);
  }

  if (!SLUG_PATTERN.test(slug)) {
    return c.json(
      { error: "Invalid slug format. Use only lowercase letters, numbers, and hyphens" },
      400
    );
  }

  if (slug.length > SLUG_MAX_LENGTH) {
    return c.json({ error: `Slug must be ${SLUG_MAX_LENGTH} characters or less` }, 400);
  }

  // Check for duplicate slug
  const existingPost = getPostBySlug(slug);
  if (existingPost) {
    return c.json({ error: "Slug already exists" }, 400);
  }

  // Validate content
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return c.json({ error: "Content is required" }, 400);
  }

  // Articles require title
  if (type === "article" && (!title || typeof title !== "string" || title.trim().length === 0)) {
    return c.json({ error: "Title is required for articles" }, 400);
  }

  // Links require url
  if (type === "link" && (!url || typeof url !== "string" || url.trim().length === 0)) {
    return c.json({ error: "URL is required for links" }, 400);
  }

  // Validate tags if provided
  if (tags !== undefined && !Array.isArray(tags)) {
    return c.json({ error: "Tags must be an array" }, 400);
  }

  // Validate banner_image_id if provided
  if (
    banner_image_id !== undefined &&
    banner_image_id !== null &&
    typeof banner_image_id !== "number"
  ) {
    return c.json({ error: "banner_image_id must be a number" }, 400);
  }

  // Validate source_id if provided
  if (source_id !== undefined && source_id !== null && typeof source_id !== "number") {
    return c.json({ error: "source_id must be a number" }, 400);
  }

  try {
    const post = createPost({
      type,
      slug,
      title: title?.trim() || null,
      content: content.trim(),
      excerpt: excerpt?.trim() || null,
      url: url?.trim() || null,
      source_id: source_id ?? null,
      tags: tags || [],
      banner_image_id: banner_image_id ?? null,
    });

    return c.json({ data: post }, 201);
  } catch (error) {
    return c.json({ error: String(error) }, 400);
  }
});

/**
 * PUT /api/posts/:id - Update post
 */
api.put("/posts/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  const body = await c.req.json();
  const { title, content, excerpt, url, source_id, tags, banner_image_id } = body;

  // Validate tags if provided
  if (tags !== undefined && !Array.isArray(tags)) {
    return c.json({ error: "Tags must be an array" }, 400);
  }

  // Validate banner_image_id if provided
  if (
    banner_image_id !== undefined &&
    banner_image_id !== null &&
    typeof banner_image_id !== "number"
  ) {
    return c.json({ error: "banner_image_id must be a number" }, 400);
  }

  // Validate source_id if provided
  if (source_id !== undefined && source_id !== null && typeof source_id !== "number") {
    return c.json({ error: "source_id must be a number" }, 400);
  }

  try {
    const post = updatePost(id, {
      title: title !== undefined ? title?.trim() || null : undefined,
      content: content?.trim(),
      excerpt: excerpt !== undefined ? excerpt?.trim() || null : undefined,
      url: url !== undefined ? url?.trim() || null : undefined,
      source_id,
      tags,
      banner_image_id,
    });

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    // Send Update activity if post is published
    if (post.published_at) {
      await sendUpdateActivity(post.id);
    }

    return c.json({ data: post });
  } catch (error) {
    return c.json({ error: String(error) }, 400);
  }
});

/**
 * DELETE /api/posts/:id - Delete post
 */
api.delete("/posts/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  // Check if post was published before deleting
  const existingPost = getPost(id);
  const wasPublished = existingPost?.published_at;
  const slug = existingPost?.slug;

  const deleted = deletePost(id);

  if (!deleted) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Send Delete activity if post was previously published
  if (wasPublished && slug) {
    await sendDeleteActivity(slug);
  }

  return c.body(null, 204);
});

/**
 * POST /api/posts/:id/publish - Publish a post
 * Also sends Create activity to all followers via ActivityPub.
 */
api.post("/posts/:id/publish", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  const post = publishPost(id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Send Create activity to followers (fire and forget - don't block response)
  // Fedify handles retries if delivery fails
  federatePost(id).catch(() => {
    // Error already logged in federatePost
  });

  return c.json({ data: post });
});

/**
 * POST /api/posts/:id/unpublish - Unpublish a post
 */
api.post("/posts/:id/unpublish", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  const post = unpublishPost(id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ data: post });
});

/**
 * GET /api/posts/by-slug/:slug - Get single post by slug
 */
api.get("/posts/by-slug/:slug", (c) => {
  const slug = c.req.param("slug");

  const post = getPostBySlug(slug);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ data: post });
});

/**
 * PUT /api/posts/by-slug/:slug - Update post by slug
 */
api.put("/posts/by-slug/:slug", async (c) => {
  const slug = c.req.param("slug");

  const existingPost = getPostBySlug(slug);

  if (!existingPost) {
    return c.json({ error: "Post not found" }, 404);
  }

  const body = await c.req.json();
  const { title, content, excerpt, url, source_id, tags, banner_image_id } = body;

  // Validate tags if provided
  if (tags !== undefined && !Array.isArray(tags)) {
    return c.json({ error: "Tags must be an array" }, 400);
  }

  // Validate banner_image_id if provided
  if (
    banner_image_id !== undefined &&
    banner_image_id !== null &&
    typeof banner_image_id !== "number"
  ) {
    return c.json({ error: "banner_image_id must be a number" }, 400);
  }

  // Validate source_id if provided
  if (source_id !== undefined && source_id !== null && typeof source_id !== "number") {
    return c.json({ error: "source_id must be a number" }, 400);
  }

  try {
    const post = updatePost(existingPost.id, {
      title: title !== undefined ? title?.trim() || null : undefined,
      content: content?.trim(),
      excerpt: excerpt !== undefined ? excerpt?.trim() || null : undefined,
      url: url !== undefined ? url?.trim() || null : undefined,
      source_id,
      tags,
      banner_image_id,
    });

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    // Send Update activity if post is published
    if (post.published_at) {
      await sendUpdateActivity(post.id);
    }

    return c.json({ data: post });
  } catch (error) {
    return c.json({ error: String(error) }, 400);
  }
});

/**
 * DELETE /api/posts/by-slug/:slug - Delete post by slug
 */
api.delete("/posts/by-slug/:slug", async (c) => {
  const slug = c.req.param("slug");

  const existingPost = getPostBySlug(slug);

  if (!existingPost) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Remember if post was published for federation
  const wasPublished = !!existingPost.published_at;
  const postId = existingPost.id;

  const deleted = deletePost(postId);

  if (!deleted) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Send Delete activity if post was previously published
  if (wasPublished) {
    await sendDeleteActivity(slug);
  }

  return c.body(null, 204);
});

/**
 * POST /api/posts/by-slug/:slug/publish - Publish a post by slug
 * Also sends Create activity to all followers via ActivityPub.
 */
api.post("/posts/by-slug/:slug/publish", async (c) => {
  const slug = c.req.param("slug");

  const existingPost = getPostBySlug(slug);

  if (!existingPost) {
    return c.json({ error: "Post not found" }, 404);
  }

  const post = publishPost(existingPost.id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Send Create activity to followers (fire and forget - don't block response)
  // Fedify handles retries if delivery fails
  federatePost(existingPost.id).catch(() => {
    // Error already logged in federatePost
  });

  return c.json({ data: post });
});

/**
 * POST /api/posts/by-slug/:slug/unpublish - Unpublish a post by slug
 */
api.post("/posts/by-slug/:slug/unpublish", (c) => {
  const slug = c.req.param("slug");

  const existingPost = getPostBySlug(slug);

  if (!existingPost) {
    return c.json({ error: "Post not found" }, 404);
  }

  const post = unpublishPost(existingPost.id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ data: post });
});

/**
 * GET /api/sources - List all sources
 */
api.get("/sources", (c) => {
  const sources = listSources();
  return c.json({ data: sources });
});

/**
 * GET /api/sources/:id - Get single source
 */
api.get("/sources/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid source ID" }, 400);
  }

  const source = getSource(id);

  if (!source) {
    return c.json({ error: "Source not found" }, 404);
  }

  return c.json({ data: source });
});

/**
 * POST /api/sources - Create new source
 */
api.post("/sources", async (c) => {
  const body = await c.req.json();
  const { name, url, feed_url } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return c.json({ error: "Name is required" }, 400);
  }

  if (!url || typeof url !== "string" || url.trim().length === 0) {
    return c.json({ error: "URL is required" }, 400);
  }

  try {
    const source = createSource({
      name: name.trim(),
      url: url.trim(),
      feed_url: feed_url?.trim() || null,
    });

    return c.json({ data: source }, 201);
  } catch (error) {
    return c.json({ error: String(error) }, 400);
  }
});

/**
 * PUT /api/sources/:id - Update source
 */
api.put("/sources/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid source ID" }, 400);
  }

  const body = await c.req.json();
  const { name, url, feed_url } = body;

  // Validate name if provided
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return c.json({ error: "Name cannot be empty" }, 400);
  }

  // Validate url if provided
  if (url !== undefined && (typeof url !== "string" || url.trim().length === 0)) {
    return c.json({ error: "URL cannot be empty" }, 400);
  }

  try {
    const source = updateSource(id, {
      name: name?.trim(),
      url: url?.trim(),
      feed_url: feed_url !== undefined ? feed_url?.trim() || null : undefined,
    });

    if (!source) {
      return c.json({ error: "Source not found" }, 404);
    }

    return c.json({ data: source });
  } catch (error) {
    return c.json({ error: String(error) }, 400);
  }
});

/**
 * DELETE /api/sources/:id - Delete source
 */
api.delete("/sources/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid source ID" }, 400);
  }

  const deleted = deleteSource(id);

  if (!deleted) {
    return c.json({ error: "Source not found" }, 404);
  }

  return c.body(null, 204);
});

/**
 * GET /api/tags - List all tags with counts
 */
api.get("/tags", (c) => {
  const tags = listTags();
  return c.json({ data: tags });
});

/**
 * POST /api/media - Upload media file
 * Accepts multipart/form-data with:
 *   - file: the image file (required)
 *   - alt: alt text (optional)
 *   - key: custom S3 key (optional)
 */
api.post(
  "/media",
  bodyLimit({
    maxSize: 10 * 1024 * 1024, // 10 MB
    onError: (c) => c.json({ error: "File too large. Maximum size is 10 MB" }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "File is required" }, 400);
    }

    if (!isAllowedMimeType(file.type)) {
      return c.json({ error: "Invalid file type. Allowed: jpg, png, gif, webp" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const altText = typeof body.alt === "string" ? body.alt.trim() : undefined;
    const customKey = typeof body.key === "string" ? body.key.trim() : undefined;

    try {
      const record = await createMedia({
        file: buffer,
        filename: file.name,
        mimeType: file.type,
        altText: altText || undefined,
        customKey: customKey || undefined,
      });

      return c.json({ data: record }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  }
);

/**
 * GET /api/media/:id - Get media record by ID
 */
api.get("/media/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid media ID" }, 400);
  }

  const record = getMedia(id);

  if (!record) {
    return c.json({ error: "Media not found" }, 404);
  }

  return c.json({ data: record });
});

/**
 * DELETE /api/media/:id - Delete media file
 */
api.delete("/media/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid media ID" }, 400);
  }

  try {
    const deleted = await deleteMedia(id);

    if (!deleted) {
      return c.json({ error: "Media not found" }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /api/federation/update-actor - Send actor Update activity to all followers
 *
 * Call this when actor profile changes (icon, banner, name, summary).
 * Remote servers will re-fetch and cache the updated actor info.
 */
api.post("/federation/update-actor", async (c) => {
  try {
    const sent = await sendActorUpdateActivity();
    return c.json({ success: sent });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});
