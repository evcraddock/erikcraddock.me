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

/** Social link icons */
function GitHubIcon() {
  return (
    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clip-rule="evenodd"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
        clip-rule="evenodd"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
        clip-rule="evenodd"
      />
    </svg>
  );
}

function RssIcon() {
  return (
    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248-1.796 0-3.252-1.454-3.252-3.248 0-1.794 1.456-3.248 3.252-3.248 1.795.001 3.251 1.454 3.251 3.248zm-6.503-12.572v4.811c6.05.062 10.96 4.966 11.022 11.009h4.817c-.062-8.71-7.118-15.758-15.839-15.82zm0-3.368c10.58.046 19.152 8.594 19.183 19.188h4.817c-.03-13.231-10.755-23.954-24-24v4.812z" />
    </svg>
  );
}

/** Hero section with bio, social links, and logo */
function HeroSection() {
  const socialLinks = [
    { name: "GitHub", url: "https://github.com/evcraddock", icon: <GitHubIcon /> },
    { name: "LinkedIn", url: "https://linkedin.com/in/erikvancraddock", icon: <LinkedInIcon /> },
    { name: "Facebook", url: "https://facebook.com/erikvancraddock", icon: <FacebookIcon /> },
    { name: "YouTube", url: "https://youtube.com/@erikvancraddock", icon: <YouTubeIcon /> },
    { name: "RSS", url: "/feed.xml", icon: <RssIcon /> },
  ];

  return (
    <section class="mb-12 py-8 bg-gray-100 dark:bg-gray-800 -mx-4 px-4 rounded-lg">
      <div class="flex flex-col md:flex-row items-stretch gap-8">
        {/* Logo - shown first on mobile, second on desktop */}
        <div class="order-first md:order-last flex-shrink-0">
          <div class="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border-4 border-gray-300 dark:border-gray-600 shadow-lg">
            <img
              src="/images/erik-logo.png"
              alt="Erik Craddock"
              class="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Bio and social links */}
        <div class="flex-1 flex flex-col justify-center items-center">
          <div class="text-left">
            <p class="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
              I am a <span class="text-blue-600 dark:text-blue-400 font-medium">writer</span>,{" "}
              <span class="text-green-600 dark:text-green-400 font-medium">coder</span>, and{" "}
              <span class="text-purple-600 dark:text-purple-400 font-medium">musician</span>
            </p>
            <p class="text-lg text-gray-500 dark:text-gray-400 mb-2 italic">
              — not always in that order.
            </p>
            <p class="text-base text-gray-400 dark:text-gray-500 mb-8">
              This is my haphazard living autobiography.
            </p>

            {/* Social links */}
            <div class="flex justify-start gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target={link.url.startsWith("/") ? undefined : "_blank"}
                  rel={link.url.startsWith("/") ? undefined : "noopener noreferrer"}
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                  aria-label={link.name}
                  title={link.name}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Article card for grid display */
function ArticleCard({
  post,
  getBannerUrl,
}: {
  post: Post;
  getBannerUrl: (id: number) => string | null;
}) {
  const bannerUrl = post.banner_image_id ? getBannerUrl(post.banner_image_id) : null;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      <a href={`/posts/${post.slug}`} class="block">
        {/* Banner image with date badge */}
        <div class="relative aspect-video bg-gray-200 dark:bg-gray-700">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={post.title || "Article banner"}
              class="w-full h-full object-cover"
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center">
              <span class="text-gray-400 dark:text-gray-500 text-4xl">📝</span>
            </div>
          )}
          {/* Date badge */}
          {formattedDate && (
            <div class="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formattedDate}
            </div>
          )}
        </div>

        {/* Content */}
        <div class="p-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-blue-600">
            {post.title}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-3">
            {post.excerpt || truncate(post.content, 150)}
          </p>
        </div>
      </a>
    </article>
  );
}

/** Article cards grid section */
function ArticleCardsSection({
  articles,
  getBannerUrl,
}: {
  articles: Post[];
  getBannerUrl: (id: number) => string | null;
}) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Recent Articles</h2>

      {/* Responsive grid: 1 col mobile, 2 tablet, 3 desktop */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} post={article} getBannerUrl={getBannerUrl} />
        ))}
      </div>

      {/* More Articles button */}
      <div class="mt-8 text-center">
        <a
          href="/articles"
          class="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
        >
          More Articles
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      </div>
    </section>
  );
}

/** Pagination component */
function Pagination({
  currentPage,
  totalPages,
  baseUrl,
}: {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}) {
  const prevUrl = currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null;
  const nextUrl = currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null;

  // Clean up URL for page 1 (no query param needed)
  const cleanPrevUrl = currentPage === 2 ? baseUrl : prevUrl;

  return (
    <div class="flex flex-col items-center gap-4 mt-8">
      {/* Page indicator */}
      <p class="text-gray-600 dark:text-gray-400">
        Page {currentPage} of {totalPages}
      </p>

      {/* Navigation */}
      <div class="flex gap-4">
        {cleanPrevUrl ? (
          <a
            href={cleanPrevUrl}
            class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </a>
        ) : null}
        {nextUrl ? (
          <a
            href={nextUrl}
            class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
          >
            Next
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        ) : null}
      </div>
    </div>
  );
}

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
    // Fetch recent articles (type=article, published, limit 6)
    const recentArticles = db
      .select()
      .from(posts)
      .where(and(eq(posts.type, "article"), isNotNull(posts.published_at)))
      .orderBy(desc(posts.published_at))
      .limit(6)
      .all();

    // Get all banner IDs for the articles
    const bannerIds = recentArticles
      .map((a) => a.banner_image_id)
      .filter((id): id is number => id !== null);

    // Fetch media for banners
    const bannerMedia =
      bannerIds.length > 0
        ? db
            .select()
            .from(media)
            .where(
              bannerIds.length === 1
                ? eq(media.id, bannerIds[0])
                : // For multiple IDs, we need to check each one
                  // Using a simple approach: fetch all and filter
                  isNotNull(media.id)
            )
            .all()
            .filter((m) => bannerIds.includes(m.id))
        : [];

    // Create a map of banner_id -> URL
    const bannerUrlMap = new Map<number, string>();
    for (const m of bannerMedia) {
      bannerUrlMap.set(m.id, mediaUrl(m.s3_key));
    }

    // Helper function to get banner URL
    const getBannerUrl = (id: number) => bannerUrlMap.get(id) || null;

    return c.html(
      <Layout title="Home | erikcraddock.me">
        <HeroSection />
        <ArticleCardsSection articles={recentArticles} getBannerUrl={getBannerUrl} />
      </Layout>
    );
  });

  // Articles page with pagination
  const ARTICLES_PER_PAGE = 12;

  pages.get("/articles", (c) => {
    // Get page number from query string
    const pageParam = c.req.query("page");
    const page = pageParam ? parseInt(pageParam, 10) : 1;

    // Validate page number
    if (isNaN(page) || page < 1) {
      return c.redirect("/articles");
    }

    // Count total articles
    const countResult = db
      .select({ count: posts.id })
      .from(posts)
      .where(and(eq(posts.type, "article"), isNotNull(posts.published_at)))
      .all();
    const totalArticles = countResult.length;
    const totalPages = Math.ceil(totalArticles / ARTICLES_PER_PAGE);

    // Handle no articles
    if (totalArticles === 0) {
      return c.html(
        <Layout title="Articles | erikcraddock.me">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Articles</h1>
          <p class="text-gray-600 dark:text-gray-400">No articles yet.</p>
        </Layout>
      );
    }

    // Handle page out of range
    if (page > totalPages) {
      return c.redirect(`/articles?page=${totalPages}`);
    }

    // Fetch articles for current page
    const offset = (page - 1) * ARTICLES_PER_PAGE;
    const pageArticles = db
      .select()
      .from(posts)
      .where(and(eq(posts.type, "article"), isNotNull(posts.published_at)))
      .orderBy(desc(posts.published_at))
      .limit(ARTICLES_PER_PAGE)
      .offset(offset)
      .all();

    // Get banner URLs
    const bannerIds = pageArticles
      .map((a) => a.banner_image_id)
      .filter((id): id is number => id !== null);

    const bannerMedia =
      bannerIds.length > 0
        ? db
            .select()
            .from(media)
            .where(isNotNull(media.id))
            .all()
            .filter((m) => bannerIds.includes(m.id))
        : [];

    const bannerUrlMap = new Map<number, string>();
    for (const m of bannerMedia) {
      bannerUrlMap.set(m.id, mediaUrl(m.s3_key));
    }

    const getBannerUrl = (id: number) => bannerUrlMap.get(id) || null;

    return c.html(
      <Layout title={`Articles${page > 1 ? ` - Page ${page}` : ""} | erikcraddock.me`}>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Articles</h1>

        {/* Pagination indicator at top */}
        {totalPages > 1 && (
          <p class="text-center text-gray-600 dark:text-gray-400 mb-6">
            Page {page} of {totalPages}
          </p>
        )}

        {/* Article cards grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pageArticles.map((article) => (
            <ArticleCard key={article.id} post={article} getBannerUrl={getBannerUrl} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} baseUrl="/articles" />
        )}
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
