import { Hono } from "hono";
import { getFile } from "@/services/s3";
import { getMediaByKey } from "@/services/media";
import { logger } from "@/utils/logger";

export const mediaRoute = new Hono();

/**
 * GET /media/:key - Serve media files from S3
 * Public route, no auth required.
 * Proxies files from S3 with caching headers.
 * Uses stored mime_type from DB as source of truth.
 */
mediaRoute.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");

  if (!key) {
    return c.body("Not found", 404);
  }

  // Look up media record for content type
  const record = getMediaByKey(key);
  if (!record) {
    return c.body("Not found", 404);
  }

  try {
    const buffer = await getFile(key);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": record.mime_type,
        "Cache-Control": "public, max-age=86400",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.debug("media", "File not found in S3", { key, error: String(error) });
    return c.body("Not found", 404);
  }
});
