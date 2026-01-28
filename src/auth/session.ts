import { eq } from "drizzle-orm";
import { db, sessions, authors } from "@/db";
import { logger } from "@/utils/logger";

const SESSION_EXPIRY_DAYS = 7;

/**
 * Generate a session ID using crypto.randomUUID
 */
function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new session for an author
 */
export async function createSession(email: string): Promise<string | null> {
  // Look up author by email
  const author = db.select().from(authors).where(eq(authors.email, email)).get();

  if (!author) {
    logger.error("auth", "Cannot create session - author not found", { email });
    return null;
  }

  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  db.insert(sessions)
    .values({
      id: sessionId,
      author_id: author.id,
      expires_at: expiresAt,
      created_at: now,
    })
    .run();

  logger.info("auth", "Session created", { email, sessionId: sessionId.substring(0, 8) + "..." });

  return sessionId;
}

/**
 * Get session and author info by session ID
 * Returns null if session doesn't exist or is expired
 */
export async function getSession(
  sessionId: string
): Promise<{ session: typeof sessions.$inferSelect; authorEmail: string } | null> {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session) {
    logger.debug("auth", "Session not found");
    return null;
  }

  // Check if expired (handle both Date and number types)
  const expiresAtMs =
    session.expires_at instanceof Date
      ? session.expires_at.getTime()
      : Number(session.expires_at) * 1000;

  if (expiresAtMs < Date.now()) {
    logger.debug("auth", "Session expired");
    return null;
  }

  // Get author
  const author = db.select().from(authors).where(eq(authors.id, session.author_id)).get();

  if (!author) {
    logger.error("auth", "Session author not found", { sessionId: sessionId.substring(0, 8) });
    return null;
  }

  return { session, authorEmail: author.email };
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  logger.info("auth", "Session deleted", { sessionId: sessionId.substring(0, 8) + "..." });
}

/**
 * Cookie options for session cookie
 */
export function getSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax" as const,
    path: "/",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // seconds
  };
}

export { SESSION_EXPIRY_DAYS };
