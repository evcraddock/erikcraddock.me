import { eq, and } from "drizzle-orm";
import { Context, Next } from "hono";
import { db, apiKeys, authors } from "@/db";
import { logger } from "@/utils/logger";
import { hashToken } from "./crypto";
import { generateApiKey, API_KEY_PREFIX, isValidApiKeyFormat } from "./api-key-utils";

// Re-export for external use
export { generateApiKey, API_KEY_PREFIX };

/**
 * Get author by email
 */
export function getAuthorByEmail(email: string) {
  return db.select().from(authors).where(eq(authors.email, email)).get();
}

/**
 * Create a new API key for an author
 */
export async function createApiKey(
  authorId: number,
  name: string
): Promise<{ id: number; key: string }> {
  const { key, keyHash } = await generateApiKey();

  const result = db
    .insert(apiKeys)
    .values({
      author_id: authorId,
      key_hash: keyHash,
      name: name || "Unnamed key",
      created_at: new Date(),
    })
    .returning()
    .get();

  logger.info("auth", "API key created", { authorId, keyId: result.id, name });

  return { id: result.id, key };
}

/**
 * List API keys for an author (without the actual keys)
 */
export function listApiKeys(authorId: number) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      created_at: apiKeys.created_at,
      last_used_at: apiKeys.last_used_at,
      revoked_at: apiKeys.revoked_at,
    })
    .from(apiKeys)
    .where(eq(apiKeys.author_id, authorId))
    .orderBy(apiKeys.created_at)
    .all();
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: number, authorId: number): Promise<boolean> {
  const key = db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.author_id, authorId)))
    .get();

  if (!key) {
    logger.warn("auth", "Attempted to revoke non-existent or unauthorized key", {
      keyId,
      authorId,
    });
    return false;
  }

  if (key.revoked_at) {
    logger.debug("auth", "Key already revoked", { keyId });
    return true;
  }

  db.update(apiKeys).set({ revoked_at: new Date() }).where(eq(apiKeys.id, keyId)).run();

  logger.info("auth", "API key revoked", { keyId, authorId });
  return true;
}

/**
 * Validate an API key and return the author email if valid
 */
export async function validateApiKey(key: string): Promise<string | null> {
  if (!isValidApiKeyFormat(key)) {
    logger.debug("auth", "Invalid API key format");
    return null;
  }

  const keyHash = await hashToken(key);

  const result = db
    .select({
      keyId: apiKeys.id,
      authorId: apiKeys.author_id,
      revokedAt: apiKeys.revoked_at,
      email: authors.email,
    })
    .from(apiKeys)
    .innerJoin(authors, eq(apiKeys.author_id, authors.id))
    .where(eq(apiKeys.key_hash, keyHash))
    .get();

  if (!result) {
    logger.debug("auth", "API key not found");
    return null;
  }

  if (result.revokedAt) {
    logger.debug("auth", "API key revoked", { keyId: result.keyId });
    return null;
  }

  // Update last_used_at
  db.update(apiKeys).set({ last_used_at: new Date() }).where(eq(apiKeys.id, result.keyId)).run();

  logger.debug("auth", "API key validated", { keyId: result.keyId, email: result.email });

  return result.email;
}

/**
 * Middleware to require API key authentication
 * Sets c.set("apiAuth", { email }) if valid
 */
export async function requireApiKey(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.debug("auth", "Missing or invalid Authorization header");
    return c.json({ error: "Invalid or missing API key" }, 401);
  }

  const key = authHeader.substring(7); // Remove "Bearer "
  const email = await validateApiKey(key);

  if (!email) {
    return c.json({ error: "Invalid or missing API key" }, 401);
  }

  // Set auth context for API requests
  c.set("apiAuth", { email });

  await next();
}

// Extend Hono's context
declare module "hono" {
  interface ContextVariableMap {
    apiAuth: {
      email: string;
    };
  }
}
