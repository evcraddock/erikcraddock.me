import { Hono } from "hono";
import { Layout } from "@/templates/layout";
import { requireAuth, requireAdmin } from "@/auth/middleware";
import { listApiKeys, createApiKey, revokeApiKey, getAuthorByEmail } from "@/auth/api-key";

export const admin = new Hono();

// Apply auth middleware to all admin routes
admin.use("*", requireAuth);

/**
 * Admin navigation component
 */
function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav class="mb-8">
      <ul class="flex flex-wrap gap-4">
        <li>
          <a href="/admin" class="text-blue-600 dark:text-blue-400 hover:underline">
            Dashboard
          </a>
        </li>
        <li>
          <a href="/admin/posts" class="text-blue-600 dark:text-blue-400 hover:underline">
            Posts
          </a>
        </li>
        <li>
          <a href="/admin/keys" class="text-blue-600 dark:text-blue-400 hover:underline">
            API Keys
          </a>
        </li>
        {isAdmin && (
          <li>
            <a href="/admin/authors" class="text-blue-600 dark:text-blue-400 hover:underline">
              Authors
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}

/**
 * Admin page header component
 */
function AdminHeader({ title, isAdmin }: { title: string; isAdmin: boolean }) {
  return (
    <>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">{title}</h1>
        <a
          href="/logout"
          class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          Logout
        </a>
      </div>
      <AdminNav isAdmin={isAdmin} />
    </>
  );
}

/**
 * Format date for display
 */
function formatDate(date: Date | null): string {
  if (!date) return "Never";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * GET /admin - Admin dashboard
 */
admin.get("/", (c) => {
  const auth = c.get("auth");

  return c.html(
    <Layout title="Admin | erikcraddock.me">
      <div class="max-w-4xl mx-auto">
        <AdminHeader title="Admin Dashboard" isAdmin={auth.isAdmin} />

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold mb-4">Welcome</h2>
          <p class="text-gray-600 dark:text-gray-300 mb-2">
            Logged in as <span class="font-medium text-gray-900 dark:text-white">{auth.email}</span>
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Role: {auth.isAdmin ? "Admin" : "Author"}
          </p>
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /admin/posts - Posts management (placeholder)
 */
admin.get("/posts", (c) => {
  const auth = c.get("auth");

  return c.html(
    <Layout title="Posts | Admin">
      <div class="max-w-4xl mx-auto">
        <AdminHeader title="Posts" isAdmin={auth.isAdmin} />

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p class="text-gray-500 dark:text-gray-400">Post management coming soon...</p>
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /admin/keys - API key management
 */
admin.get("/keys", (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  if (!author) {
    return c.redirect("/login");
  }

  const keys = listApiKeys(author.id);
  const newKey = c.req.query("newKey");
  const error = c.req.query("error");

  return c.html(
    <Layout title="API Keys | Admin">
      <div class="max-w-4xl mx-auto">
        <AdminHeader title="API Keys" isAdmin={auth.isAdmin} />

        {/* Success message with new key */}
        {newKey && (
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <h3 class="text-green-800 dark:text-green-200 font-semibold mb-2">API Key Created</h3>
            <p class="text-sm text-green-700 dark:text-green-300 mb-3">
              Copy this key now. You won't be able to see it again!
            </p>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded font-mono text-sm break-all">
                {newKey}
              </code>
              <button
                type="button"
                onclick={`navigator.clipboard.writeText('${newKey}'); this.textContent = 'Copied!'`}
                class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p class="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Create new key form */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 class="text-lg font-semibold mb-4">Create New API Key</h2>
          <form method="post" action="/admin/keys" class="flex gap-4">
            <input
              type="text"
              name="name"
              placeholder="Key name (e.g., CLI tool, Mobile app)"
              required
              class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Key
            </button>
          </form>
        </div>

        {/* Existing keys list */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold">Your API Keys</h2>
          </div>

          {keys.length === 0 ? (
            <div class="p-6 text-gray-500 dark:text-gray-400">
              No API keys yet. Create one above.
            </div>
          ) : (
            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
              {keys.map((key) => (
                <li class="p-4 flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      {key.name || "Unnamed key"}
                      {key.revoked_at && (
                        <span class="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                          Revoked
                        </span>
                      )}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      Created: {formatDate(key.created_at)}
                      {key.last_used_at && ` • Last used: ${formatDate(key.last_used_at)}`}
                    </p>
                  </div>
                  {!key.revoked_at && (
                    <form method="post" action={`/admin/keys/${key.id}/revoke`}>
                      <button
                        type="submit"
                        class="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        onclick="return confirm('Revoke this API key? This cannot be undone.')"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /admin/keys - Create new API key
 */
admin.post("/keys", async (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  if (!author) {
    return c.redirect("/login");
  }

  const body = await c.req.parseBody();
  const name = body.name as string;

  if (!name || name.trim().length === 0) {
    return c.redirect("/admin/keys?error=Name is required");
  }

  const { key } = await createApiKey(author.id, name.trim());

  // Redirect with the new key in query param (shown once)
  return c.redirect(`/admin/keys?newKey=${encodeURIComponent(key)}`);
});

/**
 * POST /admin/keys/:id/revoke - Revoke API key
 */
admin.post("/keys/:id/revoke", async (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  if (!author) {
    return c.redirect("/login");
  }

  const keyId = parseInt(c.req.param("id"), 10);

  if (isNaN(keyId)) {
    return c.redirect("/admin/keys?error=Invalid key ID");
  }

  const success = await revokeApiKey(keyId, author.id);

  if (!success) {
    return c.redirect("/admin/keys?error=Could not revoke key");
  }

  return c.redirect("/admin/keys");
});

/**
 * GET /admin/authors - Author management (admin only)
 */
admin.get("/authors", requireAdmin, (c) => {
  const auth = c.get("auth");

  return c.html(
    <Layout title="Authors | Admin">
      <div class="max-w-4xl mx-auto">
        <AdminHeader title="Authors" isAdmin={auth.isAdmin} />

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p class="text-gray-500 dark:text-gray-400">Author management coming soon...</p>
        </div>
      </div>
    </Layout>
  );
});
