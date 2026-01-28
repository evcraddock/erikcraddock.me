import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { Layout } from "@/templates/layout";
import { createMagicLink, verifyMagicLink } from "@/auth/magic-link";
import { createSession, deleteSession, getSessionCookieOptions } from "@/auth/session";
import { logger } from "@/utils/logger";

export const auth = new Hono();

/**
 * GET /login - Show login form
 */
auth.get("/login", (c) => {
  const error = c.req.query("error");
  const success = c.req.query("success");

  return c.html(
    <Layout title="Login | erikcraddock.me">
      <div class="max-w-md mx-auto">
        <h1 class="text-2xl font-bold mb-6">Login</h1>

        {success && (
          <div class="mb-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg">
            <p class="font-medium">Check your email!</p>
            <p class="text-sm mt-1">
              If that email is registered, you'll receive a login link shortly.
            </p>
          </div>
        )}

        {error && (
          <div class="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
            {error === "invalid" && "Invalid or expired login link."}
            {error === "email" && "Please enter a valid email address."}
          </div>
        )}

        {!success && (
          <form method="post" action="/login" class="space-y-4">
            <div>
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="you@example.com"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <button
              type="submit"
              class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Send login link
            </button>
          </form>
        )}

        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          We'll send you a magic link to log in. No password needed.
        </p>
      </div>
    </Layout>
  );
});

/**
 * POST /login - Handle login form submission
 */
auth.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = body.email;

  if (typeof email !== "string" || !email.includes("@")) {
    logger.debug("auth", "Invalid email submitted", { email });
    return c.redirect("/login?error=email");
  }

  logger.debug("auth", "Login attempt", { email });

  // Create magic link (always succeeds to avoid leaking valid emails)
  await createMagicLink(email);

  return c.redirect("/login?success=1");
});

/**
 * GET /login/verify - Verify magic link and create session
 */
auth.get("/login/verify", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    logger.debug("auth", "No token provided");
    return c.redirect("/login?error=invalid");
  }

  // Verify the magic link
  const email = await verifyMagicLink(token);

  if (!email) {
    logger.debug("auth", "Invalid or expired token");
    return c.redirect("/login?error=invalid");
  }

  // Create session
  const sessionId = await createSession(email);

  if (!sessionId) {
    logger.error("auth", "Failed to create session", { email });
    return c.redirect("/login?error=invalid");
  }

  // Set session cookie
  const isProduction = process.env.NODE_ENV === "production";
  setCookie(c, "session", sessionId, getSessionCookieOptions(isProduction));

  logger.info("auth", "User logged in", { email });

  return c.redirect("/admin");
});

/**
 * POST /logout - Clear session and redirect to home
 */
auth.post("/logout", async (c) => {
  const sessionId = c.req.header("Cookie")?.match(/session=([^;]+)/)?.[1];

  if (sessionId) {
    await deleteSession(sessionId);
  }

  // Clear the cookie
  deleteCookie(c, "session", { path: "/" });

  logger.info("auth", "User logged out");

  return c.redirect("/");
});

/**
 * GET /logout - Also support GET for simple links
 */
auth.get("/logout", async (c) => {
  const sessionId = c.req.header("Cookie")?.match(/session=([^;]+)/)?.[1];

  if (sessionId) {
    await deleteSession(sessionId);
  }

  deleteCookie(c, "session", { path: "/" });

  logger.info("auth", "User logged out");

  return c.redirect("/");
});
