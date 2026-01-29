import { Hono } from "hono";
import { raw } from "hono/html";
import { desc, eq, isNotNull, and } from "drizzle-orm";
import { db as defaultDb, posts, tags, postTags, sources, media } from "../db";
import { Layout } from "../templates/layout";
import { NotFound } from "../templates/not-found";
import { truncate } from "../utils/text";
import { renderMarkdown } from "../utils/markdown";
import { mediaUrl } from "../services/media";

// Database type for dependency injection
type Database = typeof defaultDb;

// Post type for the card component (with optional source)
type Post = typeof posts.$inferSelect;
type Source = typeof sources.$inferSelect;
type PostWithSource = Post & { source?: Source | null };

/** Max length for showing full note content inline */
const NOTE_INLINE_MAX_LENGTH = 280;

/** Reusable post card component */
function PostCard({ post }: { post: PostWithSource }) {
  const isLink = post.type === "link";
  const isNote = post.type === "note";

  // Notes show full content if short enough
  const noteContent = isNote && post.content.length <= NOTE_INLINE_MAX_LENGTH ? post.content : null;

  return (
    <article
      class={`border-b border-gray-200 dark:border-gray-700 ${isNote ? "pb-4" : "pb-6"} ${isNote ? "pl-4 border-l-2 border-l-gray-300 dark:border-l-gray-600" : ""}`}
    >
      {/* Link posts: show external URL prominently */}
      {isLink && post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mb-2 inline-flex items-center gap-1"
        >
          <span class="truncate max-w-md">{new URL(post.url).hostname}</span>
          <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}

      <a href={`/posts/${post.slug}`} class="block group">
        {/* Title for articles and links (notes don't have titles) */}
        {post.title ? (
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2">
            {post.title}
          </h2>
        ) : null}

        {/* Content: notes show full content if short, others show excerpt */}
        {isNote ? (
          <p class="text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
            {noteContent || truncate(post.content, 200) + "…"}
          </p>
        ) : (
          <p class="text-gray-600 dark:text-gray-400 mb-2">
            {post.excerpt || truncate(post.content, 200)}
          </p>
        )}

        {/* Meta: date and source attribution */}
        <div class="flex flex-wrap items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
          <time>
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Draft"}
          </time>

          {/* Source attribution for link posts */}
          {isLink && post.source && (
            <span class="ml-2">
              • via{" "}
              <a
                href={post.source.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={(e) => e.stopPropagation()}
              >
                {post.source.name}
              </a>
            </span>
          )}
        </div>
      </a>
    </article>
  );
}

/** Reusable post list component */
function PostList({
  posts: postList,
  emptyMessage,
}: {
  posts: PostWithSource[];
  emptyMessage?: string;
}) {
  return (
    <div class="space-y-8">
      {postList.length === 0 ? (
        <p class="text-gray-600 dark:text-gray-400">{emptyMessage || "No posts yet."}</p>
      ) : (
        postList.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}

/**
 * Creates page routes with the given database instance.
 * Allows dependency injection for testing.
 */
export function createPagesRoutes(db: Database): Hono {
  const pages = new Hono();

  // Home page
  pages.get("/", (c) => {
    // Fetch posts with source info via left join
    const results = db
      .select({
        post: posts,
        source: sources,
      })
      .from(posts)
      .leftJoin(sources, eq(posts.source_id, sources.id))
      .where(isNotNull(posts.published_at))
      .orderBy(desc(posts.published_at))
      .all();

    // Transform to PostWithSource
    const allPosts: PostWithSource[] = results.map((row) => ({
      ...row.post,
      source: row.source,
    }));

    return c.html(
      <Layout title="Home | erikcraddock.me">
        <PostList posts={allPosts} />
      </Layout>
    );
  });

  // About page
  pages.get("/about", (c) => {
    return c.html(
      <Layout title="About | erikcraddock.me">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">About</h1>

        <div class="prose prose-gray dark:prose-invert max-w-none">
          <p>
            Hi, I'm Erik Craddock. This is my personal blog where I write about software
            development, technology, and whatever else interests me.
          </p>

          <p>
            This site is built with modern web technologies and supports ActivityPub, which means
            you can follow it from Mastodon and other federated platforms.
          </p>

          <h2>Follow Me</h2>
          <p>
            You can follow this blog on the Fediverse at <code>@erik@erikcraddock.me</code>. New
            posts will appear in your home feed just like any other account you follow.
          </p>

          <h2>Contact</h2>
          <p>Feel free to reach out via the Fediverse or check out my projects on GitHub.</p>
        </div>
      </Layout>
    );
  });

  // Sources / Blogroll page
  pages.get("/sources", (c) => {
    const allSources = db.select().from(sources).orderBy(sources.name).all();

    return c.html(
      <Layout title="Sources | erikcraddock.me">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Sources</h1>

        <p class="text-gray-600 dark:text-gray-400 mb-8">
          Blogs and websites I read and recommend. These are the sources that inspire my thinking
          and writing.
        </p>

        {allSources.length === 0 ? (
          <p class="text-gray-600 dark:text-gray-400">No sources yet.</p>
        ) : (
          <ul class="space-y-4">
            {allSources.map((source) => (
              <li key={source.id} class="border-b border-gray-200 dark:border-gray-700 pb-4">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-lg font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {source.name}
                </a>
                {source.feed_url ? (
                  <span class="ml-2 text-sm text-gray-400 dark:text-gray-500">
                    (
                    <a
                      href={source.feed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      RSS
                    </a>
                    )
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Layout>
    );
  });

  // Single post page
  pages.get("/posts/:slug", (c) => {
    const slug = c.req.param("slug");

    // Query the post with source info
    const result = db
      .select({
        post: posts,
        source: sources,
      })
      .from(posts)
      .leftJoin(sources, eq(posts.source_id, sources.id))
      .where(eq(posts.slug, slug))
      .get();

    if (!result) {
      return c.html(
        <NotFound title="Post Not Found" message="The post you're looking for doesn't exist." />,
        404
      );
    }

    const post = result.post;
    const source = result.source;
    const isLink = post.type === "link";
    const isNote = post.type === "note";

    // Query tags for this post
    const postTagsResult = db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tag_id, tags.id))
      .where(eq(postTags.post_id, post.id))
      .all();

    // Get banner image URL if set
    let bannerUrl: string | null = null;
    if (post.banner_image_id) {
      const bannerMedia = db.select().from(media).where(eq(media.id, post.banner_image_id)).get();
      if (bannerMedia) {
        bannerUrl = mediaUrl(bannerMedia.s3_key);
      }
    }

    const title = post.title || (isNote ? "Note" : "Post");
    const description = post.excerpt || truncate(post.content, 160);

    return c.html(
      <Layout
        title={`${title} | erikcraddock.me`}
        ogImage={bannerUrl ?? undefined}
        description={description}
      >
        <article
          class={`max-w-none ${isNote ? "pl-4 border-l-4 border-l-gray-300 dark:border-l-gray-600" : ""}`}
        >
          {/* Back link */}
          <a
            href="/"
            class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mb-6 inline-block"
          >
            ← Back to home
          </a>

          {/* Banner image */}
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt={post.title || "Post banner"}
              class="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}

          {/* Post header */}
          {post.title ? (
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">{post.title}</h1>
          ) : null}

          {/* Meta: date, source, and tags */}
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

            {/* Source attribution for link posts */}
            {isLink && source && (
              <span>
                via{" "}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {source.name}
                </a>
              </span>
            )}

            {/* Link to original for link posts */}
            {isLink && post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                → original
              </a>
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

  // Posts by tag page
  pages.get("/tags/:slug", (c) => {
    const slug = c.req.param("slug");

    // Query the tag by slug
    const tag = db.select().from(tags).where(eq(tags.slug, slug)).get();

    if (!tag) {
      return c.html(
        <NotFound title="Tag Not Found" message="The tag you're looking for doesn't exist." />,
        404
      );
    }

    // Query published posts with this tag (including source info)
    const results = db
      .select({
        post: posts,
        source: sources,
      })
      .from(posts)
      .innerJoin(postTags, eq(posts.id, postTags.post_id))
      .leftJoin(sources, eq(posts.source_id, sources.id))
      .where(and(eq(postTags.tag_id, tag.id), isNotNull(posts.published_at)))
      .orderBy(desc(posts.published_at))
      .all();

    // Transform to PostWithSource
    const taggedPosts: PostWithSource[] = results.map((row) => ({
      ...row.post,
      source: row.source,
    }));

    return c.html(
      <Layout title={`${tag.name} | erikcraddock.me`}>
        {/* Back link */}
        <a
          href="/"
          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mb-6 inline-block"
        >
          ← Back to home
        </a>

        {/* Tag heading */}
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Posts tagged "{tag.name}"
        </h1>

        {/* Post list */}
        <PostList posts={taggedPosts} emptyMessage={`No posts tagged "${tag.name}" yet.`} />
      </Layout>
    );
  });

  return pages;
}

// Default export using the global database
const pages = createPagesRoutes(defaultDb);

export { pages };
