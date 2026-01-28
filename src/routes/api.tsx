import { Hono } from "hono";
import { requireApiKey } from "@/auth/api-key";
import { listPosts, PostType } from "@/services/posts";

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
