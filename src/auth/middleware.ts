import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { getSession } from "./session";
import { logger } from "@/utils/logger";

// Extend Hono's context to include auth data
declare module "hono" {
  interface ContextVariableMap {
    auth: {
      email: string;
      isAdmin: boolean;
    };
  }
}

/**
 * Middleware to require authentication.
 * Redirects to /login if not authenticated.
 * Sets c.get("auth") with user info if authenticated.
 */
export async function requireAuth(c: Context, next: Next) {
  const sessionId = getCookie(c, "session");

  if (!sessionId) {
    logger.debug("auth", "No session cookie, redirecting to login");
    return c.redirect("/login");
  }

  const sessionData = await getSession(sessionId);

  if (!sessionData) {
    logger.debug("auth", "Invalid or expired session, redirecting to login");
    return c.redirect("/login");
  }

  // Check if user is admin
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const isAdmin = sessionData.authorEmail.toLowerCase() === adminEmail;

  // Set auth context
  c.set("auth", {
    email: sessionData.authorEmail,
    isAdmin,
  });

  logger.debug("auth", "Request authenticated", {
    email: sessionData.authorEmail,
    isAdmin,
  });

  await next();
}

/**
 * Middleware to require admin role.
 * Must be used after requireAuth.
 */
export async function requireAdmin(c: Context, next: Next) {
  const auth = c.get("auth");

  if (!auth) {
    logger.error("auth", "requireAdmin used without requireAuth");
    return c.redirect("/login");
  }

  if (!auth.isAdmin) {
    logger.warn("auth", "Non-admin tried to access admin-only route", {
      email: auth.email,
    });
    return c.redirect("/admin");
  }

  await next();
}
