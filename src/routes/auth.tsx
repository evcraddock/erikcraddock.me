import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { Layout } from "@/templates/layout";
import { createMagicLink, verifyMagicLink } from "@/auth/magic-link";
import { createSession, deleteSession, getSessionCookieOptions } from "@/auth/session";
import { generatePasskeyAuthOptions, verifyPasskeyAuth } from "@/auth/passkey";
import { createApiKey, getAuthorByEmail } from "@/auth/api-key";
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
          <>
            {/* Passkey login button */}
            <button
              type="button"
              id="passkey-login"
              class="w-full py-2 px-4 mb-4 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                />
              </svg>
              Login with Passkey
            </button>

            <div class="relative mb-4">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white dark:bg-gray-900 text-gray-500">or</span>
              </div>
            </div>

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

            {/* Passkey login script */}
            <script src="https://unpkg.com/@simplewebauthn/browser@13/dist/bundle/index.umd.min.js"></script>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                document.getElementById('passkey-login').addEventListener('click', async () => {
                  try {
                    // Get authentication options
                    const optionsRes = await fetch('/login/passkey/options', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                    });
                    const options = await optionsRes.json();

                    // Start WebAuthn authentication
                    const credential = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });

                    // Verify with server
                    const verifyRes = await fetch('/login/passkey', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ credential }),
                    });
                    const result = await verifyRes.json();

                    if (result.success) {
                      window.location.href = '/admin';
                    } else {
                      alert(result.error || 'Login failed');
                    }
                  } catch (err) {
                    if (err.name === 'NotAllowedError') {
                      // User cancelled
                      return;
                    }
                    console.error(err);
                    alert('Login failed. You may not have a passkey registered.');
                  }
                });
              `,
              }}
            />
          </>
        )}

        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Use a passkey for instant login, or we'll send you a magic link.
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
  const redirectTo = c.req.query("redirect");

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

  // Redirect to specified URL or default to /admin
  // Only allow relative paths to prevent open redirect vulnerability
  // Reject protocol-relative URLs (//evil.com) and absolute URLs
  const isRelativePath = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//");
  const safeRedirect = isRelativePath ? redirectTo : "/admin";
  return c.redirect(safeRedirect);
});

/**
 * POST /logout - Clear session and redirect to home
 */
auth.post("/logout", async (c) => {
  const sessionId = getCookie(c, "session");

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
  const sessionId = getCookie(c, "session");

  if (sessionId) {
    await deleteSession(sessionId);
  }

  deleteCookie(c, "session", { path: "/" });

  logger.info("auth", "User logged out");

  return c.redirect("/");
});

/**
 * POST /login/passkey/options - Get passkey authentication options
 */
auth.post("/login/passkey/options", async (c) => {
  const options = await generatePasskeyAuthOptions();
  return c.json(options);
});

/**
 * POST /login/passkey - Verify passkey and create session
 */
auth.post("/login/passkey", async (c) => {
  const body = await c.req.json();
  const { credential } = body;

  const result = await verifyPasskeyAuth(credential);

  if (!result.success || !result.email) {
    return c.json({ success: false, error: result.error || "Authentication failed" });
  }

  // Create session
  const sessionId = await createSession(result.email);

  if (!sessionId) {
    return c.json({ success: false, error: "Failed to create session" });
  }

  // Set session cookie
  const isProduction = process.env.NODE_ENV === "production";
  setCookie(c, "session", sessionId, getSessionCookieOptions(isProduction));

  logger.info("auth", "User logged in via passkey", { email: result.email });

  return c.json({ success: true });
});

/**
 * GET /cli/auth - CLI authentication page
 * Shows login form if not authenticated, generates API key if authenticated
 */
auth.get("/cli/auth", async (c) => {
  const sessionId = getCookie(c, "session");

  // If not authenticated, show login form with redirect back
  if (!sessionId) {
    return c.html(
      <Layout title="CLI Login | erikcraddock.me">
        <div class="max-w-md mx-auto">
          <h1 class="text-2xl font-bold mb-2">CLI Authentication</h1>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Sign in to generate an API key for the CLI.
          </p>

          {/* Passkey login button */}
          <button
            type="button"
            id="passkey-login"
            class="w-full py-2 px-4 mb-4 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
              />
            </svg>
            Login with Passkey
          </button>

          <div class="relative mb-4">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-900 text-gray-500">or</span>
            </div>
          </div>

          <form method="post" action="/cli/auth/login" class="space-y-4">
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

          {/* Passkey login script */}
          <script src="https://unpkg.com/@simplewebauthn/browser@13/dist/bundle/index.umd.min.js"></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
              document.getElementById('passkey-login').addEventListener('click', async () => {
                try {
                  const optionsRes = await fetch('/login/passkey/options', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                  });
                  const options = await optionsRes.json();
                  const credential = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });
                  const verifyRes = await fetch('/cli/auth/passkey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ credential }),
                  });
                  const result = await verifyRes.json();
                  if (result.success) {
                    window.location.reload();
                  } else {
                    alert(result.error || 'Login failed');
                  }
                } catch (err) {
                  if (err.name === 'NotAllowedError') return;
                  console.error(err);
                  alert('Login failed. You may not have a passkey registered.');
                }
              });
            `,
            }}
          />
        </div>
      </Layout>
    );
  }

  // User is authenticated - get their email from session
  const { getSession } = await import("@/auth/session");
  const sessionData = await getSession(sessionId);

  if (!sessionData) {
    // Invalid session, redirect to refresh
    deleteCookie(c, "session", { path: "/" });
    return c.redirect("/cli/auth");
  }

  const email = sessionData.authorEmail;

  // Get author to create API key
  const author = getAuthorByEmail(email);
  if (!author) {
    return c.html(
      <Layout title="Error | erikcraddock.me">
        <div class="max-w-md mx-auto">
          <h1 class="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p>Author not found. Please contact the administrator.</p>
        </div>
      </Layout>
    );
  }

  // Generate API key
  const keyName = `CLI - ${new Date().toISOString().split("T")[0]}`;
  const { key } = await createApiKey(author.id, keyName);

  logger.info("auth", "CLI API key generated", { email, keyName });

  return c.html(
    <Layout title="CLI API Key | erikcraddock.me">
      <div class="max-w-lg mx-auto">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <svg
              class="w-8 h-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 class="text-2xl font-bold mb-2">API Key Generated</h1>
          <p class="text-gray-600 dark:text-gray-400">
            Copy this key and paste it into your terminal.
          </p>
        </div>

        <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Your API Key</span>
            <button
              id="copy-btn"
              class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Copy
            </button>
          </div>
          <code
            id="api-key"
            class="block w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded font-mono text-sm break-all select-all"
          >
            {key}
          </code>
        </div>

        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div class="flex">
            <svg
              class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p class="font-medium text-amber-800 dark:text-amber-200">
                This key won't be shown again
              </p>
              <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Make sure to copy it now. If you lose it, you'll need to generate a new one.
              </p>
            </div>
          </div>
        </div>

        <div class="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>You can close this window after copying the key.</p>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            document.getElementById('copy-btn').addEventListener('click', async () => {
              const key = document.getElementById('api-key').textContent;
              await navigator.clipboard.writeText(key);
              const btn = document.getElementById('copy-btn');
              btn.textContent = 'Copied!';
              setTimeout(() => btn.textContent = 'Copy', 2000);
            });
          `,
          }}
        />
      </div>
    </Layout>
  );
});

/**
 * POST /cli/auth/login - Handle CLI auth login form
 */
auth.post("/cli/auth/login", async (c) => {
  const body = await c.req.parseBody();
  const email = body.email;

  if (typeof email !== "string" || !email.includes("@")) {
    return c.redirect("/cli/auth?error=email");
  }

  logger.debug("auth", "CLI login attempt", { email });

  // Create magic link that redirects back to /cli/auth
  await createMagicLink(email, "/cli/auth");

  return c.html(
    <Layout title="Check Your Email | erikcraddock.me">
      <div class="max-w-md mx-auto text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
          <svg
            class="w-8 h-8 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 class="text-2xl font-bold mb-2">Check your email</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          We've sent a login link to your email. Click it to continue.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          After clicking the link, you'll be redirected back here to get your API key.
        </p>
      </div>
    </Layout>
  );
});

/**
 * POST /cli/auth/passkey - Verify passkey for CLI auth
 */
auth.post("/cli/auth/passkey", async (c) => {
  const body = await c.req.json();
  const { credential } = body;

  const result = await verifyPasskeyAuth(credential);

  if (!result.success || !result.email) {
    return c.json({ success: false, error: result.error || "Authentication failed" });
  }

  // Create session
  const sessionId = await createSession(result.email);

  if (!sessionId) {
    return c.json({ success: false, error: "Failed to create session" });
  }

  // Set session cookie
  const isProduction = process.env.NODE_ENV === "production";
  setCookie(c, "session", sessionId, getSessionCookieOptions(isProduction));

  logger.info("auth", "User logged in via passkey for CLI", { email: result.email });

  return c.json({ success: true });
});
