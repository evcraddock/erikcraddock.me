import { Hono } from "hono";
import { raw } from "hono/html";
import { asc, desc, eq, isNotNull, and } from "drizzle-orm";
import {
  db as defaultDb,
  posts,
  tags,
  postTags,
  sources,
  sourceAuthors,
  people,
  media,
  followers,
} from "../db";
import { Layout } from "../templates/layout";
import { NotFound } from "../templates/not-found";
import { truncate } from "../utils/text";
import { renderMarkdown } from "../utils/markdown";
import { mediaUrl } from "../services/media";
import { listTags } from "../services/tags";
import { fetchLinkPreview } from "../services/link-preview";
import { postToObject, PublishedPost } from "../federation/post-object";
import { baseUrl } from "../federation/utils";
import { logger } from "../utils/logger";

// Database type for dependency injection
type Database = typeof defaultDb;

// Post type for the card component (with optional source)
type Post = typeof posts.$inferSelect;
type Source = typeof sources.$inferSelect;
type SourceAuthor = {
  id: number;
  name: string;
  url: string | null;
  sort_order: number;
};
type SourceWithAuthors = Source & { authors: SourceAuthor[] };
type Tag = { id: number; name: string; slug: string };
type PostWithSource = Post & { source?: Source | null };

/** Max length for showing full note content inline */
const NOTE_INLINE_MAX_LENGTH = 280;
const ACTOR_HANDLE = "@erik@erikcraddock.me";
const ACTOR_URI = new URL("/users/erik", baseUrl).toString();
const WEBFINGER_SUBSCRIBE_REL = "http://ostatus.org/schema/1.0/subscribe";

interface WebFingerResponse {
  links?: Array<{
    rel?: string;
    template?: string;
  }>;
}

function hasStoredLinkPreview(post: {
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_site_name?: string | null;
}): boolean {
  return Boolean(post.og_title || post.og_description || post.og_image_url || post.og_site_name);
}

function getLinkPreviewSiteLabel(url: string | null, siteName: string | null): string | null {
  if (siteName) {
    return siteName;
  }

  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function parseFediverseAccount(input: string): { username: string; host: string } | null {
  const account = input.trim().replace(/^@/, "");
  if (account.includes("://")) {
    return null;
  }

  const [username, host, extra] = account.split("@");
  if (!username || !host || extra) {
    return null;
  }

  return { username, host };
}

function normalizeFediverseServer(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const account = parseFediverseAccount(trimmedInput);
  const hostInput = account?.host ?? trimmedInput;

  try {
    const url = new URL(hostInput.includes("://") ? hostInput : `https://${hostInput}`);
    if (url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function formatAuthorByline(authors: SourceAuthor[]): string | null {
  const names = authors.map((author) => author.name);

  if (names.length === 0) {
    return null;
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function SourceCard({ source }: { source: SourceWithAuthors }) {
  const hostname = getLinkPreviewSiteLabel(source.url, null) ?? source.url;

  return (
    <article class="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-teal-900/60 dark:hover:bg-teal-950/20">
      <div class="flex items-start gap-4">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${source.name} website`}
          class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-100 text-lg font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
        >
          {source.favicon_url ? (
            <img
              src={source.favicon_url}
              alt=""
              class="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            source.name.charAt(0).toUpperCase()
          )}
        </a>
        <div class="min-w-0 flex-1">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            class="line-clamp-2 font-semibold text-gray-950 hover:text-teal-600 dark:text-gray-50 dark:hover:text-teal-400"
          >
            {source.name}
          </a>
          <p class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{hostname}</p>
        </div>
      </div>

      {source.preview_description ? (
        <p class="mt-4 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {source.preview_description}
        </p>
      ) : null}

      {source.authors.length > 0 ? (
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-300">
          by {formatAuthorByline(source.authors)}
        </p>
      ) : null}

      {source.feed_url ? (
        <div class="mt-auto pt-5 text-sm font-medium">
          <a
            href={source.feed_url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            RSS
          </a>
        </div>
      ) : null}
    </article>
  );
}

function buildRemoteFollowUrl(serverOrigin: string): string {
  const url = new URL("/authorize_interaction", serverOrigin);
  url.searchParams.set("uri", ACTOR_URI);
  return url.toString();
}

async function getSubscribeTemplateFollowUrl(input: string): Promise<string | null> {
  const account = parseFediverseAccount(input);
  if (!account) {
    return null;
  }

  try {
    const resource = `acct:${account.username}@${account.host}`;
    const webFingerUrl = new URL("/.well-known/webfinger", `https://${account.host}`);
    webFingerUrl.searchParams.set("resource", resource);
    const response = await fetch(webFingerUrl, { headers: { accept: "application/jrd+json" } });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as WebFingerResponse;
    const template = data.links?.find((link) => link.rel === WEBFINGER_SUBSCRIBE_REL)?.template;
    return template?.includes("{uri}")
      ? template.replace("{uri}", encodeURIComponent(ACTOR_URI))
      : null;
  } catch {
    return null;
  }
}

async function buildFediverseFollowUrl(input: string): Promise<string | null> {
  // Fediverse servers advertise remote-follow URLs via the WebFinger subscribe relation.
  const subscribeUrl = await getSubscribeTemplateFollowUrl(input);
  if (subscribeUrl) {
    return subscribeUrl;
  }

  const serverOrigin = normalizeFediverseServer(input);
  return serverOrigin ? buildRemoteFollowUrl(serverOrigin) : null;
}

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
    {
      name: "LinkedIn",
      url: "https://www.linkedin.com/in/erik-craddock-42aa9815",
      icon: <LinkedInIcon />,
    },
    { name: "Facebook", url: "https://www.facebook.com/evcraddock", icon: <FacebookIcon /> },
    { name: "YouTube", url: "https://youtube.com/@ErikCraddock", icon: <YouTubeIcon /> },
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

/** Reusable tag badge component */
function TagBadge({ tag }: { tag: Tag }) {
  return (
    <a
      href={`/tags/${tag.slug}`}
      class="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      {tag.name}
    </a>
  );
}

/** Tag badges list component */
function TagBadges({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <div class="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </div>
  );
}

/** Article card for grid display */
function ArticleCard({
  post,
  getBannerUrl,
  tags: postTags = [],
}: {
  post: Post;
  getBannerUrl: (id: number) => string | null;
  tags?: Tag[];
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
          <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-2">
            {post.excerpt || truncate(post.content, 150)}
          </p>
          {postTags.length > 0 && <TagBadges tags={postTags} />}
        </div>
      </a>
    </article>
  );
}

/** Article cards grid section */
function ArticleCardsSection({
  articles,
  getBannerUrl,
  getTagsForPost,
  hasMore,
}: {
  articles: Post[];
  getBannerUrl: (id: number) => string | null;
  getTagsForPost: (postId: number) => Tag[];
  hasMore: boolean;
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
          <ArticleCard
            key={article.id}
            post={article}
            getBannerUrl={getBannerUrl}
            tags={getTagsForPost(article.id)}
          />
        ))}
      </div>

      {/* More Articles button - only show if there are more articles */}
      {hasMore && (
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
      )}
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

function FeedActorAvatar({ className = "" }: { className?: string }) {
  return (
    <img
      src="/images/erik-logo.png"
      alt="Erik Craddock"
      class={`rounded-full bg-gray-200 object-cover ring-2 ring-white dark:bg-gray-700 dark:ring-gray-900 ${className}`}
    />
  );
}

function FeedProfileCard({
  followerCount,
  followingCount,
  postCount,
}: {
  followerCount: number;
  followingCount: number;
  postCount: number;
}) {
  return (
    <section class="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <img src="/images/banner.png" alt="" class="h-32 w-full object-cover sm:h-40" />
      <div class="px-4 pb-5 sm:px-6">
        <div class="-mt-12 flex items-end justify-between gap-4 sm:-mt-16">
          <FeedActorAvatar className="h-24 w-24 border-4 border-white dark:border-gray-900 sm:h-32 sm:w-32" />
          <a
            href="/follow"
            class="mb-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Follow
          </a>
        </div>
        <div class="mt-4">
          <h2 class="text-2xl font-bold text-gray-950 dark:text-gray-50">Erik Craddock</h2>
          <p class="text-gray-500 dark:text-gray-400">{ACTOR_HANDLE}</p>
          <p class="mt-4 text-gray-800 dark:text-gray-200">
            Writer, coder, and musician — not always in that order.
          </p>
          <dl class="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Followers</dt>
              <dd class="font-semibold text-gray-950 dark:text-gray-50">{followerCount}</dd>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Following</dt>
              <dd class="font-semibold text-gray-950 dark:text-gray-50">{followingCount}</dd>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Posts</dt>
              <dd class="font-semibold text-gray-950 dark:text-gray-50">{postCount}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function FeedArticlePreview({
  post,
  bannerUrl,
}: {
  post: PostWithSource;
  bannerUrl?: string | null;
}) {
  return (
    <a
      href={`/posts/${post.slug}`}
      class="group mt-3 block overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
    >
      {bannerUrl && (
        <img
          src={bannerUrl}
          alt={post.title || "Article banner"}
          class="aspect-video w-full object-cover"
        />
      )}
      <div class="p-4">
        {post.title && (
          <h2 class="line-clamp-2 text-2xl font-bold text-gray-950 group-hover:text-teal-600 dark:text-gray-50 dark:group-hover:text-teal-400">
            {post.title}
          </h2>
        )}
        <p class="mt-4 line-clamp-3 leading-6 text-gray-700 dark:text-gray-300">
          {post.excerpt || truncate(post.content, 200)}
        </p>
      </div>
    </a>
  );
}

function FeedLinkPreview({ post }: { post: PostWithSource }) {
  if (!post.url) {
    return null;
  }

  const siteLabel = getLinkPreviewSiteLabel(post.url, post.og_site_name);
  const hasPreview = Boolean(
    post.og_title || post.og_description || post.og_image_url || siteLabel
  );

  if (!hasPreview) {
    return null;
  }

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      class="mt-4 block overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
    >
      {post.og_image_url && (
        <img
          src={post.og_image_url}
          alt={post.og_title || "Link preview image"}
          class="aspect-video w-full object-cover"
        />
      )}
      <div class="p-4">
        {siteLabel && (
          <p class="mb-1 truncate text-sm text-gray-500 dark:text-gray-400">{siteLabel}</p>
        )}
        {post.og_title && (
          <h3 class="line-clamp-2 font-semibold text-gray-950 dark:text-gray-50">
            {post.og_title}
          </h3>
        )}
        {post.og_description && (
          <p class="mt-2 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {post.og_description}
          </p>
        )}
      </div>
    </a>
  );
}

function FeedPostMeta({ post, tags: postTags }: { post: PostWithSource; tags: Tag[] }) {
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Draft";

  return (
    <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <time>{formattedDate}</time>
      <span aria-hidden="true">·</span>
      <span class="capitalize">{post.type}</span>
      {post.source && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            via{" "}
            <a
              href={post.source.url}
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-gray-700 dark:hover:text-gray-300"
            >
              {post.source.name}
            </a>
          </span>
        </>
      )}
      {postTags.length > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <TagBadges tags={postTags} />
        </>
      )}
    </div>
  );
}

/** Feed post component - renders differently based on post type */
function FeedPost({
  post,
  tags: postTags = [],
  bannerUrl,
}: {
  post: PostWithSource;
  tags?: Tag[];
  bannerUrl?: string | null;
}) {
  const isArticle = post.type === "article";
  const isLink = post.type === "link";

  return (
    <article class="border-b border-gray-200 bg-white px-4 py-5 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 sm:px-6">
      <div class="mb-3 flex items-center gap-3 sm:gap-4">
        <a href="/about" aria-label="Erik Craddock profile" class="shrink-0">
          <FeedActorAvatar className="h-11 w-11 sm:h-12 sm:w-12" />
        </a>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <a href="/about" class="font-semibold text-gray-950 hover:underline dark:text-gray-50">
              Erik Craddock
            </a>
            <span class="text-sm text-gray-500 dark:text-gray-400">@erik</span>
            <span class="text-sm text-gray-400 dark:text-gray-600" aria-hidden="true">
              ·
            </span>
            <span class="text-sm capitalize text-gray-500 dark:text-gray-400">{post.type}</span>
          </div>
        </div>
      </div>

      {isArticle ? (
        <FeedArticlePreview post={post} bannerUrl={bannerUrl} />
      ) : (
        <>
          {post.title && (
            <a href={`/posts/${post.slug}`} class="group block">
              <h2 class="mb-4 text-2xl font-bold text-gray-950 group-hover:text-teal-600 dark:text-gray-50 dark:group-hover:text-teal-400">
                {post.title}
              </h2>
            </a>
          )}
          <div class="prose prose-gray max-w-none dark:prose-invert">
            {raw(renderMarkdown(post.content))}
          </div>
        </>
      )}

      {isLink && <FeedLinkPreview post={post} />}

      <FeedPostMeta post={post} tags={postTags} />
    </article>
  );
}

function SingleFeedPost({
  post,
  tags: postTags = [],
  bannerUrl,
}: {
  post: PostWithSource;
  tags?: Tag[];
  bannerUrl?: string | null;
}) {
  const isLink = post.type === "link";

  return (
    <article class="bg-white px-4 py-5 dark:bg-gray-900 sm:px-6">
      <div class="mb-3 flex items-center gap-3 sm:gap-4">
        <a href="/about" aria-label="Erik Craddock profile" class="shrink-0">
          <FeedActorAvatar className="h-11 w-11 sm:h-12 sm:w-12" />
        </a>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <a href="/about" class="font-semibold text-gray-950 hover:underline dark:text-gray-50">
              Erik Craddock
            </a>
            <span class="text-sm text-gray-500 dark:text-gray-400">@erik</span>
            <span class="text-sm text-gray-400 dark:text-gray-600" aria-hidden="true">
              ·
            </span>
            <span class="text-sm capitalize text-gray-500 dark:text-gray-400">{post.type}</span>
          </div>
        </div>
      </div>

      {bannerUrl && (
        <img
          src={bannerUrl}
          alt={post.title || "Post banner"}
          class="mb-4 aspect-video w-full rounded-2xl object-cover"
        />
      )}

      {post.title && (
        <h1 class="mb-4 text-2xl font-bold text-gray-950 dark:text-gray-50">{post.title}</h1>
      )}

      <div class="prose prose-gray max-w-none dark:prose-invert">
        {raw(renderMarkdown(post.content))}
      </div>

      {isLink && <FeedLinkPreview post={post} />}

      <FeedPostMeta post={post} tags={postTags} />
    </article>
  );
}

/** Reusable post card component */
function PostCard({ post, tags: postTags = [] }: { post: PostWithSource; tags?: Tag[] }) {
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

          {/* Tags */}
          {postTags.length > 0 && (
            <span class="ml-2 flex flex-wrap gap-1">
              •{" "}
              {postTags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
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
  getTagsForPost,
  emptyMessage,
}: {
  posts: PostWithSource[];
  getTagsForPost: (postId: number) => Tag[];
  emptyMessage?: string;
}) {
  return (
    <div class="space-y-8">
      {postList.length === 0 ? (
        <p class="text-gray-600 dark:text-gray-400">{emptyMessage || "No posts yet."}</p>
      ) : (
        postList.map((post) => (
          <PostCard key={post.id} post={post} tags={getTagsForPost(post.id)} />
        ))
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
  const HOME_ARTICLES_LIMIT = 6;

  pages.get("/", (c) => {
    // Fetch one extra article to check if there are more
    const fetchedArticles = db
      .select()
      .from(posts)
      .where(and(eq(posts.type, "article"), isNotNull(posts.published_at)))
      .orderBy(desc(posts.published_at))
      .limit(HOME_ARTICLES_LIMIT + 1)
      .all();

    // Check if there are more articles beyond what we display
    const hasMoreArticles = fetchedArticles.length > HOME_ARTICLES_LIMIT;
    const recentArticles = fetchedArticles.slice(0, HOME_ARTICLES_LIMIT);

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

    // Fetch tags for all displayed articles
    const articleIds = recentArticles.map((a) => a.id);
    const articleTags =
      articleIds.length > 0
        ? db
            .select({
              postId: postTags.post_id,
              tagId: tags.id,
              tagName: tags.name,
              tagSlug: tags.slug,
            })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tag_id, tags.id))
            .all()
            .filter((t) => articleIds.includes(t.postId))
        : [];

    // Create a map of post_id -> tags[]
    const tagsMap = new Map<number, Tag[]>();
    for (const t of articleTags) {
      const existing = tagsMap.get(t.postId) || [];
      existing.push({ id: t.tagId, name: t.tagName, slug: t.tagSlug });
      tagsMap.set(t.postId, existing);
    }

    // Helper function to get tags for a post
    const getTagsForPost = (postId: number) => tagsMap.get(postId) || [];

    return c.html(
      <Layout title="Home | erikcraddock.me">
        <HeroSection />
        <ArticleCardsSection
          articles={recentArticles}
          getBannerUrl={getBannerUrl}
          getTagsForPost={getTagsForPost}
          hasMore={hasMoreArticles}
        />
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

    // Fetch tags for all displayed articles
    const articleIds = pageArticles.map((a) => a.id);
    const articleTags =
      articleIds.length > 0
        ? db
            .select({
              postId: postTags.post_id,
              tagId: tags.id,
              tagName: tags.name,
              tagSlug: tags.slug,
            })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tag_id, tags.id))
            .all()
            .filter((t) => articleIds.includes(t.postId))
        : [];

    // Create a map of post_id -> tags[]
    const tagsMap = new Map<number, Tag[]>();
    for (const t of articleTags) {
      const existing = tagsMap.get(t.postId) || [];
      existing.push({ id: t.tagId, name: t.tagName, slug: t.tagSlug });
      tagsMap.set(t.postId, existing);
    }

    // Helper function to get tags for a post
    const getTagsForPost = (postId: number) => tagsMap.get(postId) || [];

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
            <ArticleCard
              key={article.id}
              post={article}
              getBannerUrl={getBannerUrl}
              tags={getTagsForPost(article.id)}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} baseUrl="/articles" />
        )}
      </Layout>
    );
  });

  // Feed page - all post types with full content for notes/links, excerpts for articles
  const FEED_POSTS_PER_PAGE = 10;

  pages.get("/feed", (c) => {
    // Get page number from query string
    const pageParam = c.req.query("page");
    const page = pageParam ? parseInt(pageParam, 10) : 1;

    // Validate page number
    if (isNaN(page) || page < 1) {
      return c.redirect("/feed");
    }

    // Count total posts
    const countResult = db
      .select({ count: posts.id })
      .from(posts)
      .where(isNotNull(posts.published_at))
      .all();
    const totalPosts = countResult.length;
    const totalPages = Math.ceil(totalPosts / FEED_POSTS_PER_PAGE);
    const followerCount = db.select().from(followers).all().length;
    const followingCount = 0;

    // Handle no posts
    if (totalPosts === 0) {
      return c.html(
        <Layout title="Feed | erikcraddock.me">
          <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[20rem_minmax(0,42rem)] lg:items-start lg:justify-center">
            <aside class="lg:sticky lg:top-24">
              <FeedProfileCard
                followerCount={followerCount}
                followingCount={followingCount}
                postCount={totalPosts}
              />
            </aside>
            <div class="overflow-hidden border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 sm:rounded-2xl sm:border">
              <header class="border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:px-6">
                <h1 class="text-xl font-bold text-gray-950 dark:text-gray-50">Feed</h1>
              </header>
              <div class="px-4 py-10 text-center text-gray-600 dark:text-gray-400 sm:px-6">
                No posts yet.
              </div>
            </div>
          </div>
        </Layout>
      );
    }

    // Handle page out of range
    if (page > totalPages) {
      return c.redirect(`/feed?page=${totalPages}`);
    }

    // Fetch posts for current page with source info
    const offset = (page - 1) * FEED_POSTS_PER_PAGE;
    const results = db
      .select({
        post: posts,
        source: sources,
      })
      .from(posts)
      .leftJoin(sources, eq(posts.source_id, sources.id))
      .where(isNotNull(posts.published_at))
      .orderBy(desc(posts.published_at))
      .limit(FEED_POSTS_PER_PAGE)
      .offset(offset)
      .all();

    const pagePosts: PostWithSource[] = results.map((row) => ({
      ...row.post,
      source: row.source,
    }));

    // Fetch tags for all displayed posts
    const postIds = pagePosts.map((p) => p.id);
    const feedTags =
      postIds.length > 0
        ? db
            .select({
              postId: postTags.post_id,
              tagId: tags.id,
              tagName: tags.name,
              tagSlug: tags.slug,
            })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tag_id, tags.id))
            .all()
            .filter((t) => postIds.includes(t.postId))
        : [];

    // Create a map of post_id -> tags[]
    const feedTagsMap = new Map<number, Tag[]>();
    for (const t of feedTags) {
      const existing = feedTagsMap.get(t.postId) || [];
      existing.push({ id: t.tagId, name: t.tagName, slug: t.tagSlug });
      feedTagsMap.set(t.postId, existing);
    }

    // Helper function to get tags for a post
    const getTagsForPost = (postId: number) => feedTagsMap.get(postId) || [];

    const bannerIds = pagePosts
      .map((post) => post.banner_image_id)
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
    const getBannerUrl = (post: PostWithSource) =>
      post.banner_image_id ? bannerUrlMap.get(post.banner_image_id) || null : null;

    return c.html(
      <Layout title={`Feed${page > 1 ? ` - Page ${page}` : ""} | erikcraddock.me`}>
        <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[20rem_minmax(0,42rem)] lg:items-start lg:justify-center">
          <aside class="lg:sticky lg:top-24">
            <FeedProfileCard
              followerCount={followerCount}
              followingCount={followingCount}
              postCount={totalPosts}
            />
          </aside>
          <div class="overflow-hidden border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 sm:rounded-2xl sm:border">
            <header class="flex items-center justify-between gap-4 border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:px-6">
              <h1 class="text-xl font-bold text-gray-950 dark:text-gray-50">Feed</h1>
              {totalPages > 1 && (
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Page {page} of {totalPages}
                </p>
              )}
            </header>
            <div>
              {pagePosts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  tags={getTagsForPost(post.id)}
                  bannerUrl={getBannerUrl(post)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div class="border-t border-gray-200 px-4 pb-6 dark:border-gray-800 sm:px-6">
                <Pagination currentPage={page} totalPages={totalPages} baseUrl="/feed" />
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  });

  pages.get("/follow", async (c) => {
    const server = c.req.query("server");
    const error = c.req.query("error");

    if (server !== undefined) {
      const followUrl = await buildFediverseFollowUrl(server);
      if (followUrl) {
        return c.redirect(followUrl);
      }

      return c.redirect("/follow?error=invalid-server");
    }

    return c.html(
      <Layout title="Follow | erikcraddock.me">
        <div class="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <h1 class="text-3xl font-bold text-gray-950 dark:text-gray-50">Follow Erik Craddock</h1>
          <p class="mt-4 text-gray-700 dark:text-gray-300">
            Follow <code>{ACTOR_HANDLE}</code> from Mastodon or another Fediverse server.
          </p>
          <form action="/follow" method="get" class="mt-6 space-y-4">
            <div>
              <label
                for="server"
                class="block text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                Your Fediverse server or account
              </label>
              <input
                id="server"
                name="server"
                type="text"
                required
                placeholder="mastodon.social or @you@mastodon.social"
                class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            {error === "invalid-server" && (
              <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                Enter a valid Fediverse server, such as mastodon.social, or an account handle like
                @you@mastodon.social.
              </p>
            )}
            <button
              type="submit"
              class="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Continue to Follow
            </button>
          </form>
          <p class="mt-5 text-sm text-gray-500 dark:text-gray-400">
            This uses your account's WebFinger subscribe template when available, with a
            Mastodon-compatible remote-follow URL as a fallback. If your server does not support it,
            search for <code>{ACTOR_HANDLE}</code> in your Fediverse app.
          </p>
        </div>
      </Layout>
    );
  });

  // About page
  pages.get("/about", (c) => {
    const socialLinks = [
      { name: "GitHub", url: "https://github.com/evcraddock", icon: <GitHubIcon /> },
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/erik-craddock-42aa9815",
        icon: <LinkedInIcon />,
      },
      { name: "Facebook", url: "https://www.facebook.com/evcraddock", icon: <FacebookIcon /> },
      { name: "YouTube", url: "https://youtube.com/@ErikCraddock", icon: <YouTubeIcon /> },
      { name: "RSS", url: "/feed.xml", icon: <RssIcon /> },
    ];

    return c.html(
      <Layout title="About | Erik Craddock">
        {/* Hero-style header */}
        <section class="mb-12 py-8 bg-gray-100 dark:bg-gray-800 -mx-4 px-4 rounded-lg">
          <div class="flex flex-col md:flex-row items-center gap-8">
            {/* Logo */}
            <div class="flex-shrink-0">
              <div class="w-48 h-48 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border-4 border-gray-300 dark:border-gray-600 shadow-lg">
                <img
                  src="/images/erik-logo.png"
                  alt="Erik Craddock"
                  class="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Bio */}
            <div class="text-center md:text-left">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Erik Craddock
              </h1>
              <p class="text-xl text-gray-600 dark:text-gray-300 mb-4">
                <span class="text-teal-600 dark:text-teal-400">Writer</span>,{" "}
                <span class="text-blue-600 dark:text-blue-400">coder</span>, and{" "}
                <span class="text-purple-600 dark:text-purple-400">musician</span> —{" "}
                <em>not always in that order.</em>
              </p>

              {/* Social links */}
              <div class="flex justify-center md:justify-start gap-4">
                {socialLinks.map((link) => (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    title={link.name}
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div class="prose prose-gray dark:prose-invert max-w-none">
          {/* About me */}
          <p class="text-lg">
            This is my haphazard living autobiography — a place where I share articles, link to
            things I find interesting, and jot down quick notes and thoughts.
          </p>

          <h2>Follow This Site</h2>
          <p>
            This site is an{" "}
            <a href="https://activitypub.rocks/" target="_blank" rel="noopener noreferrer">
              ActivityPub
            </a>{" "}
            actor, which means you can follow it directly from Mastodon or any other Fediverse
            platform. New posts will appear in your home feed just like any other account you
            follow.
          </p>

          <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 not-prose my-6">
            <p class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Follow me at:</p>
            <code class="text-xl text-teal-600 dark:text-teal-400 bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded">
              @erik@erikcraddock.me
            </code>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-4">
              <strong>How to follow:</strong> Copy the handle above, then in your Mastodon (or other
              Fediverse) app, paste it into the search box and click "Follow" on the profile that
              appears.
            </p>
          </div>

          <h2>Get in Touch</h2>
          <p>
            The best way to reach me is through the Fediverse — just mention{" "}
            <code>@erik@erikcraddock.me</code> in a post. You can also find me on the social
            platforms linked above.
          </p>
        </div>
      </Layout>
    );
  });

  // Sources / Blogroll page
  pages.get("/sources", (c) => {
    const allSourceRows = db.select().from(sources).orderBy(sources.name).all();
    const allSourceAuthors = db
      .select({
        sourceId: sourceAuthors.source_id,
        id: people.id,
        name: people.name,
        url: people.url,
        sort_order: sourceAuthors.sort_order,
      })
      .from(sourceAuthors)
      .innerJoin(people, eq(sourceAuthors.person_id, people.id))
      .orderBy(asc(sourceAuthors.source_id), asc(sourceAuthors.sort_order), asc(sourceAuthors.id))
      .all();

    const authorsBySourceId = new Map<number, SourceAuthor[]>();
    for (const author of allSourceAuthors) {
      const existing = authorsBySourceId.get(author.sourceId) ?? [];
      existing.push({
        id: author.id,
        name: author.name,
        url: author.url,
        sort_order: author.sort_order,
      });
      authorsBySourceId.set(author.sourceId, existing);
    }

    const allSources: SourceWithAuthors[] = allSourceRows.map((source) => ({
      ...source,
      authors: authorsBySourceId.get(source.id) ?? [],
    }));

    return c.html(
      <Layout title="Recommended Sites | erikcraddock.me">
        <div class="mx-auto max-w-6xl">
          <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-950 dark:text-gray-50">Recommended Sites</h1>
            <p class="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
              The following are websites which I found interesting enough to share links from at
              some point in the past.
            </p>
          </div>

          {allSources.length === 0 ? (
            <div class="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 sm:px-6">
              No sources yet.
            </div>
          ) : (
            <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {allSources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  });

  // Single post page
  pages.get("/posts/:slug", async (c) => {
    const slug = c.req.param("slug");

    // Content negotiation: return ActivityPub JSON-LD if requested
    const accept = c.req.header("Accept") || "";
    const wantsActivityPub =
      accept.includes("application/activity+json") || accept.includes("application/ld+json");

    if (wantsActivityPub) {
      // Query the post for ActivityPub
      const post = db
        .select({
          id: posts.id,
          slug: posts.slug,
          type: posts.type,
          title: posts.title,
          content: posts.content,
          excerpt: posts.excerpt,
          url: posts.url,
          published_at: posts.published_at,
          updated_at: posts.updated_at,
          banner_image_id: posts.banner_image_id,
        })
        .from(posts)
        .where(eq(posts.slug, slug))
        .get();

      if (!post || !post.published_at) {
        return c.json({ error: "Not found" }, 404);
      }

      // Get banner URL if present
      let bannerUrl: string | null = null;
      let bannerAlt: string | null = null;
      if (post.banner_image_id) {
        const bannerMedia = db.select().from(media).where(eq(media.id, post.banner_image_id)).get();
        if (bannerMedia) {
          bannerUrl = new URL(mediaUrl(bannerMedia.s3_key), baseUrl).href;
          bannerAlt = bannerMedia.alt_text;
        }
      }

      const publishedPost: PublishedPost = {
        id: post.id,
        slug: post.slug,
        type: post.type,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        url: post.url,
        published_at: post.published_at,
        updated_at: post.updated_at,
        banner_url: bannerUrl,
        banner_alt: bannerAlt,
      };

      const actorUri = new URL("/users/erik", baseUrl);
      const followersUri = new URL("/users/erik/followers", baseUrl);
      const object = postToObject(publishedPost, actorUri, followersUri);

      const jsonLd = await object.toJsonLd();
      return c.json(jsonLd, 200, {
        "Content-Type": "application/activity+json",
      });
    }

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

    let post = result.post;
    const source = result.source;
    const isLink = post.type === "link";
    const isNote = post.type === "note";

    if (isLink && post.url && !hasStoredLinkPreview(post)) {
      const preview = await fetchLinkPreview(post.url);

      if (preview) {
        db.update(posts)
          .set({
            og_title: preview.title,
            og_description: preview.description,
            og_image_url: preview.imageUrl,
            og_site_name: preview.siteName,
            updated_at: new Date(),
          })
          .where(eq(posts.id, post.id))
          .run();

        post = {
          ...post,
          og_title: preview.title,
          og_description: preview.description,
          og_image_url: preview.imageUrl,
          og_site_name: preview.siteName,
        };
      } else {
        logger.debug("link-preview", "No preview metadata found during page render", {
          postId: post.id,
          url: post.url,
        });
      }
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
    // For link posts, use external URL for OG tags so Mastodon generates correct preview
    const canonicalUrl = post.type === "link" && post.url ? post.url : `/posts/${slug}`;
    const totalPosts = db
      .select({ count: posts.id })
      .from(posts)
      .where(isNotNull(posts.published_at))
      .all().length;
    const followerCount = db.select().from(followers).all().length;
    const followingCount = 0;
    const feedPost: PostWithSource = { ...post, source };

    return c.html(
      <Layout
        title={`${title} | erikcraddock.me`}
        ogImage={bannerUrl ?? undefined}
        description={description}
        canonicalUrl={canonicalUrl}
      >
        <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[20rem_minmax(0,42rem)] lg:items-start lg:justify-center">
          <aside class="lg:sticky lg:top-24">
            <FeedProfileCard
              followerCount={followerCount}
              followingCount={followingCount}
              postCount={totalPosts}
            />
          </aside>
          <div class="overflow-hidden border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 sm:rounded-2xl sm:border">
            <header class="border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:px-6">
              <a
                href="/feed"
                class="text-xl font-bold text-gray-950 hover:text-teal-600 dark:text-gray-50 dark:hover:text-teal-400"
              >
                ← Feed
              </a>
            </header>
            <SingleFeedPost post={feedPost} tags={postTagsResult} bannerUrl={bannerUrl} />
          </div>
        </div>
      </Layout>
    );
  });

  // Tags listing page
  pages.get("/tags", (c) => {
    const allTags = listTags().filter((t) => t.count > 0);

    return c.html(
      <Layout title="Tags | erikcraddock.me">
        {/* Back link */}
        <a
          href="/"
          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mb-6 inline-block"
        >
          ← Back to home
        </a>

        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Tags</h1>

        {allTags.length === 0 ? (
          <p class="text-gray-600 dark:text-gray-400">No tags yet.</p>
        ) : (
          <div class="flex flex-wrap gap-3">
            {allTags.map((tag) => (
              <a
                key={tag.id}
                href={`/tags/${tag.slug}`}
                class="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors"
              >
                <span class="font-medium">{tag.name}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">({tag.count})</span>
              </a>
            ))}
          </div>
        )}
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

    // Fetch all tags for the displayed posts
    const taggedPostIds = taggedPosts.map((p) => p.id);
    const allPostTags =
      taggedPostIds.length > 0
        ? db
            .select({
              postId: postTags.post_id,
              tagId: tags.id,
              tagName: tags.name,
              tagSlug: tags.slug,
            })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tag_id, tags.id))
            .all()
            .filter((t) => taggedPostIds.includes(t.postId))
        : [];

    // Create a map of post_id -> tags[]
    const taggedPostTagsMap = new Map<number, Tag[]>();
    for (const t of allPostTags) {
      const existing = taggedPostTagsMap.get(t.postId) || [];
      existing.push({ id: t.tagId, name: t.tagName, slug: t.tagSlug });
      taggedPostTagsMap.set(t.postId, existing);
    }

    // Helper function to get tags for a post
    const getTagsForPost = (postId: number) => taggedPostTagsMap.get(postId) || [];

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
        <PostList
          posts={taggedPosts}
          getTagsForPost={getTagsForPost}
          emptyMessage={`No posts tagged "${tag.name}" yet.`}
        />
      </Layout>
    );
  });

  return pages;
}

// Default export using the global database
const pages = createPagesRoutes(defaultDb);

export { pages };
