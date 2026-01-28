import { Hono } from "hono";
import { getFile } from "@/services/s3";
import { logger } from "@/utils/logger";

export const mediaRoute = new Hono();

/**
 * GET /media/:key - Serve media files from S3
 * Public route, no auth required.
 * Proxies files from S3 with caching headers.
 */
mediaRoute.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");

  if (!key) {
    return c.body("Not found", 404);
  }

  try {
    const buffer = await getFile(key);

    // Determine content type from extension
    const ext = key.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const contentType = contentTypes[ext || ""] || "application/octet-stream";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.debug("media", "File not found in S3", { key, error: String(error) });
    return c.body("Not found", 404);
  }
});
