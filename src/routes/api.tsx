import { Hono } from "hono";
import { requireApiKey } from "@/auth/api-key";
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  unpublishPost,
  PostType,
} from "@/services/posts";
import { createMedia, deleteMedia, isAllowedMimeType } from "@/services/media";

export const api = new Hono();

// Apply API key middleware to all API routes
api.use("*", requireApiKey);

/**
 * GET /api/ping - Health check endpoint
 */
api.get("/ping", (c) => {
  const auth = c.get("apiAuth");
  return c.json({
    status: "ok",
    authenticated: auth.email,
  });
});

/**
 * GET /api/posts - List posts
 * Query params:
 *   - type: 'article' | 'link' | 'note'
 *   - tag: tag slug to filter by
 *   - limit: max number of posts (default 50)
 */
api.get("/posts", (c) => {
  const type = c.req.query("type") as PostType | undefined;
  const tag = c.req.query("tag");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  // Validate type if provided
  if (type && !["article", "link", "note"].includes(type)) {
    return c.json({ error: "Invalid type. Must be article, link, or note" }, 400);
  }

  // Validate limit if provided
  if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
    return c.json({ error: "Invalid limit. Must be between 1 and 100" }, 400);
  }

  const posts = listPosts({ type, tag, limit });

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

/**
 * POST /api/posts - Create new post
 */
api.post("/posts", async (c) => {
  const body = await c.req.json();

  // Validate type
  const { type, title, content, excerpt, url, tags } = body;

  if (!type || !["article", "link", "note"].includes(type)) {
    return c.json({ error: "Invalid or missing type. Must be article, link, or note" }, 400);
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

  const post = createPost({
    type,
    title: title?.trim() || null,
    content: content.trim(),
    excerpt: excerpt?.trim() || null,
    url: url?.trim() || null,
    tags: tags || [],
  });

  return c.json({ data: post }, 201);
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
  const { title, content, excerpt, url, tags } = body;

  // Validate tags if provided
  if (tags !== undefined && !Array.isArray(tags)) {
    return c.json({ error: "Tags must be an array" }, 400);
  }

  const post = updatePost(id, {
    title: title !== undefined ? title?.trim() || null : undefined,
    content: content?.trim(),
    excerpt: excerpt !== undefined ? excerpt?.trim() || null : undefined,
    url: url !== undefined ? url?.trim() || null : undefined,
    tags,
  });

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.json({ data: post });
});

/**
 * DELETE /api/posts/:id - Delete post
 */
api.delete("/posts/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  const deleted = deletePost(id);

  if (!deleted) {
    return c.json({ error: "Post not found" }, 404);
  }

  return c.body(null, 204);
});

/**
 * POST /api/posts/:id/publish - Publish a post
 */
api.post("/posts/:id/publish", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid post ID" }, 400);
  }

  const post = publishPost(id);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

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
 * POST /api/media - Upload media file
 * Accepts multipart/form-data with:
 *   - file: the image file (required)
 *   - alt: alt text (optional)
 *   - key: custom S3 key (optional)
 */
api.post("/media", async (c) => {
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
