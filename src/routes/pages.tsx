import { Hono } from "hono";
import { raw } from "hono/html";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db as defaultDb, posts, tags, postTags } from "../db";
import { Layout } from "../templates/layout";
import { NotFound } from "../templates/not-found";
import { truncate } from "../utils/text";
import { renderMarkdown } from "../utils/markdown";

// Database type for dependency injection
type Database = typeof defaultDb;

/**
 * Creates page routes with the given database instance.
 * Allows dependency injection for testing.
 */
export function createPagesRoutes(db: Database): Hono {
  const pages = new Hono();

  pages.get("/", (c) => {
    const allPosts = db
      .select()
      .from(posts)
      .where(isNotNull(posts.published_at))
      .orderBy(desc(posts.published_at))
      .all();

    return c.html(
      <Layout title="Home | erikcraddock.me">
        <div class="space-y-8">
          {allPosts.length === 0 ? (
            <p class="text-gray-600 dark:text-gray-400">No posts yet.</p>
          ) : (
            allPosts.map((post) => (
              <article key={post.id} class="border-b border-gray-200 dark:border-gray-700 pb-6">
                <a href={`/posts/${post.id}`} class="block group">
                  {post.title ? (
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2">
                      {post.title}
                    </h2>
                  ) : null}
                  <p class="text-gray-600 dark:text-gray-400 mb-2">
                    {post.excerpt || truncate(post.content, 200)}
                  </p>
                  <time class="text-sm text-gray-400 dark:text-gray-500">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Draft"}
                  </time>
                </a>
              </article>
            ))
          )}
        </div>
      </Layout>
    );
  });

  // Single post page
  pages.get("/posts/:id", (c) => {
    const id = Number(c.req.param("id"));

    // Validate ID is a number
    if (Number.isNaN(id)) {
      return c.html(
        <NotFound title="Post Not Found" message="The post you're looking for doesn't exist." />,
        404
      );
    }

    // Query the post
    const post = db.select().from(posts).where(eq(posts.id, id)).get();

    if (!post) {
      return c.html(
        <NotFound title="Post Not Found" message="The post you're looking for doesn't exist." />,
        404
      );
    }

    // Query tags for this post
    const postTagsResult = db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tag_id, tags.id))
      .where(eq(postTags.post_id, id))
      .all();

    const title = post.title || "Post";

    return c.html(
      <Layout title={`${title} | erikcraddock.me`}>
        <article class="max-w-none">
          {/* Back link */}
          <a
            href="/"
            class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mb-6 inline-block"
          >
            ← Back to home
          </a>

          {/* Post header */}
          {post.title ? (
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">{post.title}</h1>
          ) : null}

          {/* Meta: date and tags */}
          <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8">
            {post.published_at ? (
              <time>
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            ) : (
              <span class="text-yellow-600 dark:text-yellow-500">Draft</span>
            )}

            {postTagsResult.length > 0 ? (
              <div class="flex flex-wrap gap-2">
                {postTagsResult.map((tag) => (
                  <a
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    class="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs"
                  >
                    {tag.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Post content */}
          <div class="prose prose-gray max-w-none">{raw(renderMarkdown(post.content))}</div>
        </article>
      </Layout>
    );
  });

  return pages;
}

// Default export using the global database
const pages = createPagesRoutes(defaultDb);

export { pages };
