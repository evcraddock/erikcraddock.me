import { Hono } from "hono";
import { desc, isNotNull } from "drizzle-orm";
import { db, posts } from "../db";
import { Layout } from "../templates/layout";

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
          <p class="text-gray-600">No posts yet.</p>
        ) : (
          allPosts.map((post) => (
            <article key={post.id} class="border-b border-gray-200 pb-6">
              <a href={`/posts/${post.id}`} class="block group">
                {post.title ? (
                  <h2 class="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                    {post.title}
                  </h2>
                ) : null}
                <p class="text-gray-600 mb-2">
                  {post.excerpt || post.content.slice(0, 200)}
                  {!post.excerpt && post.content.length > 200 ? "..." : ""}
                </p>
                <time class="text-sm text-gray-400">
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

export { pages };
