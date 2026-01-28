import { Hono } from "hono";
import { requireApiKey } from "@/auth/api-key";
import { listPosts, getPost, createPost, PostType } from "@/services/posts";

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
