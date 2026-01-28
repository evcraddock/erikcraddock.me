import { Hono } from "hono";
import { requireApiKey } from "@/auth/api-key";

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
