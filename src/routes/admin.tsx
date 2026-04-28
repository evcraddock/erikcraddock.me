import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { Layout } from "@/templates/layout";
import { requireAuth, requireAdmin } from "@/auth/middleware";
import { db, followers } from "@/db";
import { listApiKeys, createApiKey, revokeApiKey, getAuthorByEmail } from "@/auth/api-key";
import { listAuthors, addAuthor, deleteAuthor } from "@/auth/authors";
import {
  listPasskeys,
  generatePasskeyRegistrationOptions,
  verifyAndStorePasskey,
  deletePasskey,
} from "@/auth/passkey";
import {
  REMOTE_FOLLOW_ACCEPTED_STATUS,
  REMOTE_FOLLOW_PENDING_STATUS,
  createOrRetryRemoteFollow,
  getRemoteFollowStatusLabel,
  listRemoteFollows,
  resolveRemoteActor,
  unfollowRemoteFollow,
  type ResolvedRemoteActor,
} from "@/federation/following";

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
        <li>
          <a href="/admin/passkeys" class="text-blue-600 dark:text-blue-400 hover:underline">
            Passkeys
          </a>
        </li>
        <li>
          <a href="/admin/followers" class="text-blue-600 dark:text-blue-400 hover:underline">
            Followers
          </a>
        </li>
        <li>
          <a href="/admin/following" class="text-blue-600 dark:text-blue-400 hover:underline">
            Following
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
 * Format date and time for ActivityPub admin records.
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MissingValue() {
  return <span class="text-gray-400 dark:text-gray-500">Not provided</span>;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span class="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
      {getRemoteFollowStatusLabel(status)}
    </span>
  );
}

function ResolvedActorPreview({ actor }: { actor: ResolvedRemoteActor }) {
  return (
    <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <h2 class="mb-2 text-lg font-semibold text-blue-950 dark:text-blue-100">Resolved account</h2>
      <p class="text-sm text-blue-900 dark:text-blue-200">
        {actor.displayName ?? actor.preferredUsername ?? actor.handle ?? actor.actorUri}
      </p>
      <p class="break-all text-xs text-blue-700 dark:text-blue-300">{actor.actorUri}</p>
      <form method="post" action="/admin/following" class="mt-4">
        <input type="hidden" name="actor" value={actor.actorUri} />
        <button class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" type="submit">
          Follow
        </button>
      </form>
    </div>
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
        <AdminHeader title="Admin Dashboard" isAdmin={auth.isAdmin} />

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold mb-4">Welcome</h2>
            <p class="text-gray-600 dark:text-gray-300 mb-2">
              Logged in as{" "}
              <span class="font-medium text-gray-900 dark:text-white">{auth.email}</span>
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Role: {auth.isAdmin ? "Admin" : "Author"}
            </p>
          </div>

          <a
            href="/admin/followers"
            class="block bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:ring-2 hover:ring-blue-500"
          >
            <h2 class="text-lg font-semibold mb-2">ActivityPub Followers</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Inspect remote Fediverse accounts that follow this site.
            </p>
          </a>

          <a
            href="/admin/following"
            class="block bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:ring-2 hover:ring-blue-500"
          >
            <h2 class="text-lg font-semibold mb-2">Following</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Follow Fediverse accounts from this site actor.
            </p>
          </a>
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /admin/followers - ActivityPub follower inspection
 */
admin.get("/followers", (c) => {
  const auth = c.get("auth");
  const storedFollowers = db.select().from(followers).orderBy(desc(followers.followed_at)).all();
  const followerCount = storedFollowers.length;

  return c.html(
    <Layout title="Followers | Admin">
      <div class="max-w-5xl mx-auto">
        <AdminHeader title="ActivityPub Followers" isAdmin={auth.isAdmin} />

        <div class="mb-6 grid gap-4 sm:grid-cols-2">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Stored followers</p>
            <p class="mt-2 text-3xl font-bold text-gray-950 dark:text-white">{followerCount}</p>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Page status</p>
            <p class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">Read-only</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Approval, rejection, and removal are handled by separate tasks.
            </p>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {storedFollowers.length === 0 ? (
            <div class="p-6 text-gray-600 dark:text-gray-300">
              <h2 class="text-lg font-semibold text-gray-950 dark:text-white mb-2">
                No ActivityPub followers yet
              </h2>
              <p>When remote Fediverse accounts follow this site, they will appear here.</p>
            </div>
          ) : (
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Actor
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Inbox
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Shared inbox
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Followed
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  {storedFollowers.map((follower) => (
                    <tr>
                      <td class="px-4 py-3 align-top text-sm">
                        <a
                          href={follower.actor_uri}
                          class="break-all text-blue-600 hover:underline dark:text-blue-400"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {follower.actor_uri}
                        </a>
                      </td>
                      <td class="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300 break-all">
                        {follower.inbox_uri}
                      </td>
                      <td class="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300 break-all">
                        {follower.shared_inbox_uri ?? <MissingValue />}
                      </td>
                      <td class="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDateTime(follower.followed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /admin/following - ActivityPub following management
 */
admin.get("/following", async (c) => {
  const auth = c.get("auth");
  const handle = c.req.query("handle")?.trim() ?? "";
  const success = c.req.query("success");
  const error = c.req.query("error");
  let resolvedActor: ResolvedRemoteActor | null = null;
  let resolveError: string | null = null;

  if (handle) {
    try {
      resolvedActor = await resolveRemoteActor(handle);
    } catch (cause) {
      resolveError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  const follows = listRemoteFollows();

  return c.html(
    <Layout title="Following | Admin">
      <div class="mx-auto max-w-5xl">
        <AdminHeader title="Following" isAdmin={auth.isAdmin} />

        {success && (
          <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {success}
          </div>
        )}
        {(error || resolveError) && (
          <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error ?? resolveError}
          </div>
        )}

        <div class="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 class="mb-4 text-lg font-semibold">Follow a Fediverse account</h2>
          <form method="get" action="/admin/following" class="flex flex-col gap-3 sm:flex-row">
            <input
              class="flex-1 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
              name="handle"
              placeholder="@alice@example.social"
              type="text"
              value={handle}
            />
            <button
              class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              type="submit"
            >
              Resolve
            </button>
          </form>
        </div>

        {resolvedActor && <ResolvedActorPreview actor={resolvedActor} />}

        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 class="mb-4 text-lg font-semibold">Stored follows</h2>
          {follows.length === 0 ? (
            <p class="text-gray-600 dark:text-gray-300">No followed accounts yet.</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th class="px-3 py-2 text-left text-xs uppercase text-gray-500">Account</th>
                    <th class="px-3 py-2 text-left text-xs uppercase text-gray-500">Status</th>
                    <th class="px-3 py-2 text-left text-xs uppercase text-gray-500">Person</th>
                    <th class="px-3 py-2 text-left text-xs uppercase text-gray-500">Followed</th>
                    <th class="px-3 py-2 text-left text-xs uppercase text-gray-500">Resolved</th>
                    <th class="px-3 py-2 text-left text-xs uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  {follows.map((follow) => (
                    <tr>
                      <td class="px-3 py-2 text-sm">
                        <a
                          class="break-all text-blue-600 hover:underline"
                          href={follow.profile_url ?? follow.actor_uri}
                        >
                          {follow.display_name ?? follow.handle ?? follow.actor_uri}
                        </a>
                        <div class="break-all text-xs text-gray-500">{follow.actor_uri}</div>
                      </td>
                      <td class="px-3 py-2 text-sm">
                        <StatusBadge status={follow.status} />
                      </td>
                      <td class="px-3 py-2 text-sm">
                        {follow.person_id ? (
                          <a
                            class="text-blue-600 hover:underline"
                            href={`/people/${follow.person_id}`}
                          >
                            Person #{follow.person_id}
                          </a>
                        ) : (
                          <MissingValue />
                        )}
                      </td>
                      <td class="px-3 py-2 text-sm">{formatDateTime(follow.followed_at)}</td>
                      <td class="px-3 py-2 text-sm">
                        {follow.unfollowed_at ? (
                          <span>Unfollowed {formatDateTime(follow.unfollowed_at)}</span>
                        ) : follow.accepted_at ? (
                          <span>Accepted {formatDateTime(follow.accepted_at)}</span>
                        ) : follow.rejected_at ? (
                          <span>Rejected {formatDateTime(follow.rejected_at)}</span>
                        ) : (
                          <MissingValue />
                        )}
                      </td>
                      <td class="px-3 py-2 text-sm">
                        {follow.status === REMOTE_FOLLOW_PENDING_STATUS ||
                        follow.status === REMOTE_FOLLOW_ACCEPTED_STATUS ? (
                          <form method="post" action={`/admin/following/${follow.id}/unfollow`}>
                            <button
                              class="rounded bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                              type="submit"
                            >
                              {follow.status === REMOTE_FOLLOW_PENDING_STATUS
                                ? "Cancel request"
                                : "Unfollow"}
                            </button>
                          </form>
                        ) : (
                          <MissingValue />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

admin.post("/following/:id/unfollow", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) {
    return c.redirect("/admin/following?error=Invalid follow request");
  }

  try {
    const follow = await unfollowRemoteFollow({ followId: id });
    if (!follow) {
      return c.redirect("/admin/following?error=Follow not found");
    }
    return c.redirect("/admin/following?success=Account unfollowed");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return c.redirect(`/admin/following?error=${encodeURIComponent(message)}`);
  }
});

admin.post("/following", async (c) => {
  const form = await c.req.formData();
  const actorInput = String(form.get("actor") ?? "").trim();
  if (!actorInput) {
    return c.redirect("/admin/following?error=Fediverse account is required");
  }

  try {
    const actor = await resolveRemoteActor(actorInput);
    const follow = await createOrRetryRemoteFollow({ actor });
    return c.redirect(
      `/admin/following?success=${encodeURIComponent(`Follow request sent to ${follow.display_name ?? follow.handle ?? follow.actor_uri}`)}`
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return c.redirect(`/admin/following?error=${encodeURIComponent(message)}`);
  }
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

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.redirect("/login");
  }

  const authorId = author?.id ?? null;
  const keys = listApiKeys(authorId);
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

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.redirect("/login");
  }

  const authorId = author?.id ?? null;

  const body = await c.req.parseBody();
  const name = body.name as string;

  if (!name || name.trim().length === 0) {
    return c.redirect("/admin/keys?error=Name is required");
  }

  const { key } = await createApiKey(authorId, name.trim());

  // Redirect with the new key in query param (shown once)
  return c.redirect(`/admin/keys?newKey=${encodeURIComponent(key)}`);
});

/**
 * POST /admin/keys/:id/revoke - Revoke API key
 */
admin.post("/keys/:id/revoke", async (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.redirect("/login");
  }

  const authorId = author?.id ?? null;
  const keyId = parseInt(c.req.param("id"), 10);

  if (isNaN(keyId)) {
    return c.redirect("/admin/keys?error=Invalid key ID");
  }

  const success = await revokeApiKey(keyId, authorId);

  if (!success) {
    return c.redirect("/admin/keys?error=Could not revoke key");
  }

  return c.redirect("/admin/keys");
});

/**
 * GET /admin/passkeys - Passkey management
 */
admin.get("/passkeys", (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.redirect("/login");
  }

  const authorId = author?.id ?? null;
  const userPasskeys = listPasskeys(authorId);
  const error = c.req.query("error");
  const success = c.req.query("success");

  return c.html(
    <Layout title="Passkeys | Admin">
      <div class="max-w-4xl mx-auto">
        <AdminHeader title="Passkeys" isAdmin={auth.isAdmin} />

        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p class="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <p class="text-green-700 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* Register new passkey */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 class="text-lg font-semibold mb-4">Register New Passkey</h2>
          <p class="text-gray-600 dark:text-gray-300 mb-4">
            Passkeys let you log in securely using your device's biometrics (fingerprint, face) or
            PIN.
          </p>
          <button
            type="button"
            id="register-passkey"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Register Passkey
          </button>
        </div>

        {/* Existing passkeys */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold">Your Passkeys</h2>
          </div>

          {userPasskeys.length === 0 ? (
            <div class="p-6 text-gray-500 dark:text-gray-400">
              No passkeys registered yet. Register one above for faster login.
            </div>
          ) : (
            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
              {userPasskeys.map((pk) => (
                <li class="p-4 flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      {pk.name || "Unnamed passkey"}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      Created: {formatDate(pk.created_at)}
                      {pk.last_used_at && ` • Last used: ${formatDate(pk.last_used_at)}`}
                    </p>
                  </div>
                  <form method="post" action={`/admin/passkeys/${pk.id}/delete`}>
                    <button
                      type="submit"
                      class="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      onclick="return confirm('Delete this passkey? You cannot undo this.')"
                    >
                      Delete
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Client-side passkey registration script */}
        <script src="https://unpkg.com/@simplewebauthn/browser@13/dist/bundle/index.umd.min.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            document.getElementById('register-passkey').addEventListener('click', async () => {
              const name = prompt('Name this passkey (e.g., MacBook, iPhone):');
              if (!name) return;

              try {
                // Get registration options
                const optionsRes = await fetch('/admin/passkeys/register/options', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                const options = await optionsRes.json();

                // Start WebAuthn registration
                const credential = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });

                // Verify with server
                const verifyRes = await fetch('/admin/passkeys/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, credential }),
                });
                const result = await verifyRes.json();

                if (result.success) {
                  window.location.href = '/admin/passkeys?success=Passkey registered successfully';
                } else {
                  alert(result.error || 'Registration failed');
                }
              } catch (err) {
                console.error(err);
                alert('Registration failed: ' + err.message);
              }
            });
          `,
          }}
        />
      </div>
    </Layout>
  );
});

/**
 * POST /admin/passkeys/register/options - Get registration options
 */
admin.post("/passkeys/register/options", async (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const authorId = author?.id ?? null;
  const options = await generatePasskeyRegistrationOptions(authorId, auth.email);
  return c.json(options);
});

/**
 * POST /admin/passkeys/register - Verify and store passkey
 */
admin.post("/passkeys/register", async (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const authorId = author?.id ?? null;
  const body = await c.req.json();
  const { name, credential } = body;

  const result = await verifyAndStorePasskey(authorId, auth.email, name, credential);
  return c.json(result);
});

/**
 * POST /admin/passkeys/:id/delete - Delete passkey
 */
admin.post("/passkeys/:id/delete", async (c) => {
  const auth = c.get("auth");
  const author = getAuthorByEmail(auth.email);

  // Admin uses null author_id, regular authors use their id
  if (!author && !auth.isAdmin) {
    return c.redirect("/login");
  }

  const authorId = author?.id ?? null;
  const passkeyId = parseInt(c.req.param("id"), 10);

  if (isNaN(passkeyId)) {
    return c.redirect("/admin/passkeys?error=Invalid passkey ID");
  }

  const success = deletePasskey(passkeyId, authorId);

  if (!success) {
    return c.redirect("/admin/passkeys?error=Could not delete passkey");
  }

  return c.redirect("/admin/passkeys?success=Passkey deleted");
});

/**
 * GET /admin/authors - Author management (admin only)
 */
admin.get("/authors", requireAdmin, (c) => {
  const auth = c.get("auth");
  const authorsList = listAuthors();
  const error = c.req.query("error");
  const success = c.req.query("success");

  return c.html(
    <Layout title="Authors | Admin">
      <div class="max-w-4xl mx-auto">
        <AdminHeader title="Authors" isAdmin={auth.isAdmin} />

        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p class="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <p class="text-green-700 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* Add author form */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 class="text-lg font-semibold mb-4">Add Author</h2>
          <form method="post" action="/admin/authors" class="flex gap-4">
            <input
              type="email"
              name="email"
              placeholder="Email address"
              required
              class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Author
            </button>
          </form>
        </div>

        {/* Authors list */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold">Allowed Authors</h2>
          </div>

          {authorsList.length === 0 ? (
            <div class="p-6 text-gray-500 dark:text-gray-400">No authors yet. Add one above.</div>
          ) : (
            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
              {authorsList.map((author) => {
                const isSelf = author.email.toLowerCase() === auth.email.toLowerCase();
                return (
                  <li class="p-4 flex items-center justify-between">
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">
                        {author.email}
                        {isSelf && (
                          <span class="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                            You
                          </span>
                        )}
                      </p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        Added: {formatDate(author.created_at)}
                      </p>
                    </div>
                    {!isSelf && (
                      <form method="post" action={`/admin/authors/${author.id}/delete`}>
                        <button
                          type="submit"
                          class="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          onclick="return confirm('Remove this author? They will lose access.')"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /admin/authors - Add author (admin only)
 */
admin.post("/authors", requireAdmin, async (c) => {
  const body = await c.req.parseBody();
  const email = body.email as string;

  if (!email || !email.trim()) {
    return c.redirect("/admin/authors?error=Email is required");
  }

  const result = addAuthor(email);

  if (!result) {
    return c.redirect("/admin/authors?error=Invalid email or author already exists");
  }

  return c.redirect(`/admin/authors?success=${encodeURIComponent(`Added ${result.email}`)}`);
});

/**
 * POST /admin/authors/:id/delete - Remove author (admin only)
 */
admin.post("/authors/:id/delete", requireAdmin, (c) => {
  const auth = c.get("auth");
  const authorId = parseInt(c.req.param("id"), 10);

  if (isNaN(authorId)) {
    return c.redirect("/admin/authors?error=Invalid author ID");
  }

  const success = deleteAuthor(authorId, auth.email);

  if (!success) {
    return c.redirect("/admin/authors?error=Could not remove author");
  }

  return c.redirect("/admin/authors?success=Author removed");
});
