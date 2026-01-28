import { Hono } from "hono";
import { Layout } from "@/templates/layout";
import { requireAuth, requireAdmin } from "@/auth/middleware";

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
 * GET /admin - Admin dashboard
 */
admin.get("/", (c) => {
  const auth = c.get("auth");

  return c.html(
    <Layout title="Admin | erikcraddock.me">
      <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Admin Dashboard</h1>
          <a
            href="/logout"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Logout
          </a>
        </div>

        <AdminNav isAdmin={auth.isAdmin} />

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
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Posts</h1>
          <a
            href="/logout"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Logout
          </a>
        </div>

        <AdminNav isAdmin={auth.isAdmin} />

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p class="text-gray-500 dark:text-gray-400">Post management coming soon...</p>
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /admin/keys - API key management (placeholder)
 */
admin.get("/keys", (c) => {
  const auth = c.get("auth");

  return c.html(
    <Layout title="API Keys | Admin">
      <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">API Keys</h1>
          <a
            href="/logout"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Logout
          </a>
        </div>

        <AdminNav isAdmin={auth.isAdmin} />

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p class="text-gray-500 dark:text-gray-400">API key management coming soon...</p>
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /admin/authors - Author management (admin only)
 */
admin.get("/authors", requireAdmin, (c) => {
  const auth = c.get("auth");

  return c.html(
    <Layout title="Authors | Admin">
      <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Authors</h1>
          <a
            href="/logout"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Logout
          </a>
        </div>

        <AdminNav isAdmin={auth.isAdmin} />

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p class="text-gray-500 dark:text-gray-400">Author management coming soon...</p>
        </div>
      </div>
    </Layout>
  );
});
