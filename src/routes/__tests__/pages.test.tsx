/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeAll, afterEach } from "bun:test";
import { mock } from "bun:test";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});
import { createTestDb } from "../../db/test-utils";
import {
  posts,
  tags,
  postTags,
  sources,
  sourceAuthors,
  people,
  personSocialAccounts,
  media,
} from "../../db/schema";

// Create test db immediately
const testDb = createTestDb();

// Mock the db module
mock.module("../../db", () => ({
  db: testDb,
  ...require("../../db/schema"),
}));

// Set up test data
const now = new Date();

testDb
  .insert(posts)
  .values([
    {
      id: 1,
      slug: "test-post",
      type: "article",
      title: "Test Post",
      content: "This is test content with **markdown**.",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      slug: "draft-post",
      type: "article",
      title: "Draft Post",
      content: "This is a draft.",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      slug: "another-post",
      type: "article",
      title: "Another Post",
      content: "Another post content.",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      slug: "short-note",
      type: "note",
      title: null,
      content: "Short note content 🚀",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      slug: "long-note",
      type: "note",
      title: null,
      content: "x".repeat(300),
      published_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      slug: "test-link",
      type: "link",
      title: "Test Link Post",
      content: "This is commentary on an external link.\n\n> Quoted shared link text.",
      url: "https://example.com/article",
      og_title: "Example Article",
      og_description: "A rich preview description.",
      og_image_url: "https://example.com/preview.jpg",
      og_site_name: "Example Site",
      published_at: now,
      created_at: now,
      updated_at: now,
    },
  ])
  .run();

testDb
  .insert(tags)
  .values([
    { id: 1, name: "Testing", slug: "testing" },
    { id: 2, name: "TypeScript", slug: "typescript" },
    { id: 3, name: "Empty Tag", slug: "empty-tag" },
  ])
  .run();

testDb
  .insert(postTags)
  .values([
    { post_id: 1, tag_id: 1 },
    { post_id: 1, tag_id: 2 },
    { post_id: 2, tag_id: 1 },
    { post_id: 3, tag_id: 2 },
  ])
  .run();

testDb
  .insert(sources)
  .values([
    {
      id: 1,
      name: "Test Blog",
      url: "https://example.com",
      feed_url: "https://example.com/feed.xml",
      favicon_url: "https://example.com/favicon.ico",
      preview_description: "A test source preview description.",
    },
    { id: 2, name: "Another Site", url: "https://another.example.com", feed_url: null },
    { id: 3, name: "Team Blog", url: "https://team.example.com", feed_url: null },
    { id: 4, name: "Group Blog", url: "https://group.example.com", feed_url: null },
  ])
  .run();

testDb.update(posts).set({ source_id: 1 }).where(eq(posts.id, 6)).run();

testDb
  .insert(people)
  .values([
    { id: 1, name: "Test Author" },
    { id: 2, name: "Alice", url: "https://alice.example.com" },
    { id: 3, name: "Bob" },
    { id: 4, name: "Carol" },
  ])
  .run();

testDb.update(posts).set({ author_id: 1 }).where(eq(posts.id, 6)).run();

testDb
  .insert(personSocialAccounts)
  .values([
    {
      person_id: 1,
      label: "Mastodon",
      url: "https://mastodon.social/@testauthor",
      avatar_url: "https://mastodon.social/avatar.jpg",
      is_activitypub: true,
      sort_order: 0,
    },
    {
      person_id: 1,
      label: "GitHub",
      url: "https://github.com/testauthor",
      is_activitypub: false,
      sort_order: 1,
    },
  ])
  .run();

testDb
  .insert(sourceAuthors)
  .values([
    { source_id: 1, person_id: 1, sort_order: 0 },
    { source_id: 3, person_id: 2, sort_order: 0 },
    { source_id: 3, person_id: 3, sort_order: 1 },
    { source_id: 4, person_id: 2, sort_order: 0 },
    { source_id: 4, person_id: 3, sort_order: 1 },
    { source_id: 4, person_id: 4, sort_order: 2 },
  ])
  .run();

describe("pages routes", () => {
  let createPagesRoutes: typeof import("../pages").createPagesRoutes;

  beforeAll(async () => {
    const module = await import("../pages");
    createPagesRoutes = module.createPagesRoutes;
  });

  const getApp = () =>
    createPagesRoutes(testDb as unknown as Parameters<typeof createPagesRoutes>[0]);

  describe("GET /", () => {
    it("returns 200 and displays published posts", async () => {
      const app = getApp();
      const res = await app.request("/");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Post");
      expect(html).toContain("This is test content");
    });

    it("excludes draft posts (no published_at)", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).not.toContain("Draft Post");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
      expect(html).toContain("dark:border-gray-700");
    });

    it("includes navigation links to Articles and Feed", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).toContain('href="/articles"');
      expect(html).toContain('href="/feed"');
      // Sources removed from nav
      expect(html).not.toContain('href="/sources"');
      // About is linked from footer and Fediverse icon, but not in main nav
      expect(html).toContain('href="/about"');
    });

    it("displays Recent Articles section", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      expect(html).toContain("Recent Articles");
    });

    it("displays article cards with titles linked to post pages", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      // Card should link to post page
      expect(html).toContain('href="/posts/test-post"');
    });

    it("hides More Articles button when 6 or fewer articles", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      // With only 2 published articles in test data, button should be hidden
      expect(html).not.toContain("More Articles");
    });

    it("shows More Articles button when more than 6 articles", async () => {
      // Create a separate db with 7 published articles
      const manyArticlesDb = createTestDb();
      const manyArticlesNow = new Date();

      // Insert 7 published articles
      for (let i = 1; i <= 7; i++) {
        manyArticlesDb
          .insert(posts)
          .values({
            id: i,
            slug: `article-${i}`,
            type: "article",
            title: `Article ${i}`,
            content: `Content for article ${i}`,
            published_at: manyArticlesNow,
            created_at: manyArticlesNow,
            updated_at: manyArticlesNow,
          })
          .run();
      }

      const manyArticlesApp = new Hono();
      manyArticlesApp.route("/", createPagesRoutes(manyArticlesDb));

      const res = await manyArticlesApp.request("/");
      const html = await res.text();

      expect(html).toContain("More Articles");
      expect(html).toContain('href="/articles"');
    });

    it("only shows articles (type=article), not links or notes", async () => {
      const app = getApp();
      const res = await app.request("/");
      const html = await res.text();

      // Should show article
      expect(html).toContain("Test Post");
      // Should not show link post
      expect(html).not.toContain("Test Link Post");
      // Should not show note
      expect(html).not.toContain("Short note content");
    });
  });

  describe("GET /follow", () => {
    it("renders a Fediverse follow form", async () => {
      const app = getApp();
      const res = await app.request("/follow");
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(html).toContain("Follow Erik Craddock");
      expect(html).toContain('name="server"');
      expect(html).toContain("@erik@erikcraddock.me");
    });

    it("redirects a server domain to the remote follow endpoint", async () => {
      const app = getApp();
      const res = await app.request("/follow?server=mastodon.social");

      expect(res.status).toBe(302);
      const location = new URL(res.headers.get("Location") ?? "");
      expect(location.origin).toBe("https://mastodon.social");
      expect(location.pathname).toBe("/authorize_interaction");
      expect(location.searchParams.get("uri")).toContain("/users/erik");
    });

    it("uses a WebFinger subscribe template for account handles", async () => {
      global.fetch = mock(async () => {
        return Response.json({
          links: [
            {
              rel: "http://ostatus.org/schema/1.0/subscribe",
              template: "https://fosstodon.org/authorize_interaction?uri={uri}",
            },
          ],
        });
      }) as unknown as typeof fetch;

      const app = getApp();
      const res = await app.request("/follow?server=%40you%40fosstodon.org");

      expect(res.status).toBe(302);
      const location = new URL(res.headers.get("Location") ?? "");
      expect(location.origin).toBe("https://fosstodon.org");
      expect(location.pathname).toBe("/authorize_interaction");
      expect(location.searchParams.get("uri")).toContain("/users/erik");
    });

    it("handles invalid server input gracefully", async () => {
      const app = getApp();
      const res = await app.request("/follow?server=not%20a%20server");

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/follow?error=invalid-server");
    });
  });

  describe("GET /about", () => {
    it("returns 200 and displays about page", async () => {
      const app = getApp();
      const res = await app.request("/about");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("About");
      expect(html).toContain("Erik Craddock");
    });

    it("includes ActivityPub follow information", async () => {
      const app = getApp();
      const res = await app.request("/about");
      const html = await res.text();

      expect(html).toContain("@erik@erikcraddock.me");
      expect(html).toContain("Fediverse");
    });

    it("describes recommended sites and links to sources", async () => {
      const app = getApp();
      const res = await app.request("/about");
      const html = await res.text();

      expect(html).toContain("Recommended Sites");
      expect(html).toContain('href="/sources"');
      expect(html).toContain('href="/people"');
      expect(html).toContain("websites, publications, and");
      expect(html).toContain("reading log and");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/about");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
    });
  });

  describe("GET /articles", () => {
    it("returns 200 and displays articles page", async () => {
      const app = getApp();
      const res = await app.request("/articles");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("<h1");
      expect(html).toContain("Articles");
    });

    it("displays article posts with links to post pages", async () => {
      const app = getApp();
      const res = await app.request("/articles");
      const html = await res.text();

      // Should contain article
      expect(html).toContain("Test Post");
      expect(html).toContain('href="/posts/test-post"');
    });

    it("only shows articles, not links or notes", async () => {
      const app = getApp();
      const res = await app.request("/articles");
      const html = await res.text();

      expect(html).toContain("Test Post"); // article
      expect(html).not.toContain("Test Link Post"); // link
      expect(html).not.toContain("Short note content"); // note
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/articles");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
    });

    it("redirects invalid page numbers to /articles", async () => {
      const app = getApp();
      const res = await app.request("/articles?page=0");

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/articles");
    });

    it("redirects negative page numbers to /articles", async () => {
      const app = getApp();
      const res = await app.request("/articles?page=-1");

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/articles");
    });

    it("redirects non-numeric page to /articles", async () => {
      const app = getApp();
      const res = await app.request("/articles?page=abc");

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/articles");
    });
  });

  describe("GET /feed", () => {
    it("returns 200 and displays feed page", async () => {
      const app = getApp();
      const res = await app.request("/feed");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("<h1");
      expect(html).toContain("Feed");
    });

    it("displays all post types (articles, links, notes)", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      // Should contain article
      expect(html).toContain("Test Post");
      // Should contain link post
      expect(html).toContain("Test Link Post");
      // Should contain note
      expect(html).toContain("Short note content");
    });

    it("shows article posts as linked preview cards", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain('href="/posts/test-post"');
      expect(html).toContain("Test Post");
      expect(html).toContain("This is test content");
      expect(html).not.toContain("Read more →");
    });

    it("shows Mastodon-style actor/profile elements", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain("@erik@erikcraddock.me");
      expect(html).toContain("Followers");
      expect(html).toContain("Following");
      expect(html).toContain("Posts");
      expect(html).toContain('aria-label="Erik Craddock profile"');
      expect(html).toContain("rounded-full");
    });

    it("links the actor card follow button to the Fediverse follow flow", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain('href="/follow"');
      expect(html).toContain("Follow");
    });

    it("shows a social media card above recommended sites", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain("Follow me");
      expect(html).toContain('href="https://github.com/evcraddock"');
      expect(html).toContain('href="https://www.linkedin.com/in/erik-craddock-42aa9815"');
      expect(html).toContain('href="https://www.facebook.com/evcraddock"');
      expect(html).toContain('href="https://youtube.com/@ErikCraddock"');
      expect(html).toContain('href="/feed.xml"');
      expect(html.indexOf("Follow me")).toBeLessThan(html.indexOf("Recommended Sites"));
    });

    it("links the feed sidebar to recommended sites", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain('href="/sources"');
      expect(html).toContain("Recommended Sites");
    });

    it("shows stored link previews in feed items", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain("Example Site");
      expect(html).toContain("Example Article");
      expect(html).toContain("A rich preview description.");
      expect(html).toContain("https://example.com/preview.jpg");
    });

    it("links link post authors to person detail pages", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain('href="/people/1"');
      expect(html).toContain("Test Author");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/feed");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
    });

    it("redirects invalid page numbers to /feed", async () => {
      const app = getApp();
      const res = await app.request("/feed?page=0");

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/feed");
    });
  });

  describe("GET /people", () => {
    it("returns 200 and displays people page", async () => {
      const app = getApp();
      const res = await app.request("/people");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("People");
      expect(html).toContain("Search people");
    });

    it("lists people from database", async () => {
      const app = getApp();
      const res = await app.request("/people");
      const html = await res.text();

      expect(html).toContain("Test Author");
      expect(html).toContain("Alice");
      expect(html).toContain("https://alice.example.com");
      expect(html).not.toContain("No website listed");
    });

    it("uses the sources page card grid pattern", async () => {
      const app = getApp();
      const res = await app.request("/people");
      const html = await res.text();

      expect(html).toContain("mx-auto max-w-6xl");
      expect(html).toContain("grid gap-5 md:grid-cols-2 lg:grid-cols-3");
      expect(html).toContain("rounded-2xl border border-gray-200 bg-white p-5 shadow-sm");
    });

    it("filters people by search query", async () => {
      const app = getApp();
      const res = await app.request("/people?q=Alice");
      const html = await res.text();

      expect(html).toContain("Alice");
      expect(html).not.toContain("Test Author");
      expect(html).toContain("matching “Alice”");
    });

    it("links people cards to person detail pages", async () => {
      const app = getApp();
      const res = await app.request("/people");
      const html = await res.text();

      expect(html).toContain('href="/people/1"');
      expect(html).toContain('href="/people/2"');
    });

    it("shows avatars from default social accounts on people cards", async () => {
      const app = getApp();
      const res = await app.request("/people");
      const html = await res.text();

      expect(html).toContain('src="https://mastodon.social/avatar.jpg"');
    });

    it("paginates people", async () => {
      const manyPeopleDb = createTestDb();
      for (let i = 1; i <= 25; i++) {
        manyPeopleDb
          .insert(people)
          .values({
            id: i,
            name: `Person ${String(i).padStart(2, "0")}`,
            url: `https://person-${i}.example.com`,
          })
          .run();
      }
      const app = createPagesRoutes(
        manyPeopleDb as unknown as Parameters<typeof createPagesRoutes>[0]
      );

      const pageOne = await app.request("/people");
      const pageOneHtml = await pageOne.text();
      expect(pageOneHtml).toContain("Person 01");
      expect(pageOneHtml).toContain("Person 12");
      expect(pageOneHtml).not.toContain("Person 13");
      expect(pageOneHtml).toContain("Page 1 of 3");
      expect(pageOneHtml).toContain('href="/people?page=2"');
    });
  });

  describe("GET /sources", () => {
    it("returns 200 and displays sources page", async () => {
      const app = getApp();
      const res = await app.request("/sources");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Recommended Sites");
    });

    it("lists sources from database", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("Test Blog");
      expect(html).toContain("https://example.com");
      expect(html).toContain("Another Site");
    });

    it("links source cards to source detail pages", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain('href="/sources/1"');
    });

    it("shows RSS link for sources with feed_url", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("RSS");
      expect(html).toContain("https://example.com/feed.xml");
    });

    it("shows source favicons when present", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain('src="https://example.com/favicon.ico"');
      expect(html).toContain('class="h-full w-full object-cover"');
    });

    it("shows source preview descriptions when present", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("A test source preview description.");
    });

    it("shows source authors when present", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("by Test Author");
      expect(html).toContain('href="/people/1"');
    });

    it("formats two source authors naturally", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("by Alice and Bob");
    });

    it("formats three or more source authors naturally", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("by Alice, Bob, and Carol");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
      expect(html).toContain("dark:text-teal-400");
    });

    it("shows an auto-submitting search form for recommended sites", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).toContain('action="/sources"');
      expect(html).toContain('name="q"');
      expect(html).toContain('data-autosubmit-search="true"');
      expect(html).toContain("autofocus");
      expect(html).toContain('data-sources-results="true"');
      expect(html).toContain("input.focus()");
      expect(html).toContain("fetch(url");
      expect(html).toContain("Search recommended sites");
    });

    it("filters recommended sites by search query", async () => {
      const app = getApp();
      const res = await app.request("/sources?q=Another");
      const html = await res.text();

      expect(html).toContain("Another Site");
      expect(html).not.toContain("Test Blog");
      expect(html).toContain("matching “Another”");
    });

    it("searches source authors", async () => {
      const app = getApp();
      const res = await app.request("/sources?q=Carol");
      const html = await res.text();

      expect(html).toContain("Group Blog");
      expect(html).not.toContain("Test Blog");
    });

    it("paginates recommended sites", async () => {
      const manySourcesDb = createTestDb();
      for (let i = 1; i <= 25; i++) {
        manySourcesDb
          .insert(sources)
          .values({
            id: i,
            name: `Source ${String(i).padStart(2, "0")}`,
            url: `https://source-${i}.example.com`,
          })
          .run();
      }
      const app = createPagesRoutes(
        manySourcesDb as unknown as Parameters<typeof createPagesRoutes>[0]
      );

      const pageOne = await app.request("/sources");
      const pageOneHtml = await pageOne.text();
      expect(pageOneHtml).toContain("Source 01");
      expect(pageOneHtml).toContain("Source 12");
      expect(pageOneHtml).not.toContain("Source 13");
      expect(pageOneHtml).toContain("Page 1 of 3");
      expect(pageOneHtml).toContain('href="/sources?page=2"');

      const pageTwo = await app.request("/sources?page=2");
      const pageTwoHtml = await pageTwo.text();
      expect(pageTwoHtml).toContain("Source 13");
      expect(pageTwoHtml).toContain("Source 24");
      expect(pageTwoHtml).not.toContain("Source 01");
      expect(pageTwoHtml).not.toContain("Source 25");
      expect(pageTwoHtml).toContain("Page 2 of 3");

      const pageThree = await app.request("/sources?page=3");
      const pageThreeHtml = await pageThree.text();
      expect(pageThreeHtml).toContain("Source 25");
      expect(pageThreeHtml).toContain("Page 3 of 3");
    });

    it("keeps search query in pagination links", async () => {
      const manySourcesDb = createTestDb();
      for (let i = 1; i <= 25; i++) {
        manySourcesDb
          .insert(sources)
          .values({
            id: i,
            name: `Searchable Source ${String(i).padStart(2, "0")}`,
            url: `https://searchable-${i}.example.com`,
          })
          .run();
      }
      const app = createPagesRoutes(
        manySourcesDb as unknown as Parameters<typeof createPagesRoutes>[0]
      );

      const res = await app.request("/sources?q=Searchable");
      const html = await res.text();

      expect(html).toContain('href="/sources?q=Searchable&amp;page=2"');
    });

    it("does not show the old explanatory text", async () => {
      const app = getApp();
      const res = await app.request("/sources");
      const html = await res.text();

      expect(html).not.toContain("The following are websites which I found interesting enough");
    });
  });

  describe("GET /people/:id", () => {
    it("returns 200 and displays the person detail page", async () => {
      const app = getApp();
      const res = await app.request("/people/1");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Author");
      expect(html).toContain("← People");
    });

    it("uses the source detail page layout style", async () => {
      const app = getApp();
      const res = await app.request("/people/1");
      const html = await res.text();

      expect(html).toContain("lg:grid-cols-[20rem_minmax(0,42rem)]");
      expect(html).toContain("sm:rounded-2xl sm:border");
      expect(html).not.toContain("Writer, coder, and musician");
      expect(html).not.toContain("Followers");
    });

    it("lists websites authored by the selected person", async () => {
      const app = getApp();
      const res = await app.request("/people/1");
      const html = await res.text();

      expect(html).toContain("Websites");
      expect(html).toContain('href="/sources/1"');
      expect(html).toContain("Test Blog");
    });

    it("renders the selected person's social media accounts", async () => {
      const app = getApp();
      const res = await app.request("/people/1");
      const html = await res.text();

      expect(html).toContain("Follow Test Author");
      expect(html).toContain('href="https://mastodon.social/@testauthor"');
      expect(html).toContain("Mastodon");
      expect(html).toContain("ActivityPub");
      expect(html).toContain('href="https://github.com/testauthor"');
      expect(html).toContain("GitHub");
    });

    it("uses the effective default social account for avatar and follow button", async () => {
      const app = getApp();
      const res = await app.request("/people/1");
      const html = await res.text();

      expect(html).toContain('src="https://mastodon.social/avatar.jpg"');
      expect(html).toContain('href="https://mastodon.social/@testauthor"');
      expect(html).toContain(">Follow</a>");
    });

    it("shows links from the selected person with full shared link content", async () => {
      const app = getApp();
      const res = await app.request("/people/1");
      const html = await res.text();

      expect(html).toContain("This is commentary on an external link.");
      expect(html).toContain("Quoted shared link text.");
      expect(html).toContain('href="https://example.com/article"');
      expect(html).toContain("Example Article");
      expect(html).toContain("by");
      expect(html).toContain('href="/people/1"');
      expect(html).toContain("Test Author");
      expect(html).toContain("via");
    });

    it("returns 404 for missing people", async () => {
      const app = getApp();
      const res = await app.request("/people/999");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Person Not Found");
    });
  });

  describe("GET /sources/:id", () => {
    it("returns 200 and displays the source detail page", async () => {
      const app = getApp();
      const res = await app.request("/sources/1");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Blog");
      expect(html).toContain("← Recommended Sites");
    });

    it("uses the link post page layout style without the Erik profile card", async () => {
      const app = getApp();
      const res = await app.request("/sources/1");
      const html = await res.text();

      expect(html).toContain("lg:grid-cols-[20rem_minmax(0,42rem)]");
      expect(html).toContain("sm:rounded-2xl sm:border");
      expect(html).not.toContain("Writer, coder, and musician");
      expect(html).not.toContain("Followers");
    });

    it("shows the selected source card on the left side", async () => {
      const app = getApp();
      const res = await app.request("/sources/1");
      const html = await res.text();

      expect(html).toContain("A test source preview description.");
      expect(html).toContain("by Test Author");
      expect(html).toContain('href="/people/1"');
      expect(html).toContain('src="https://example.com/favicon.ico"');
    });

    it("links the selected source card title and URL to the source website", async () => {
      const app = getApp();
      const res = await app.request("/sources/1");
      const html = await res.text();

      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('aria-label="Test Blog website"');
      expect(html).toContain('target="_blank"');
      expect(html).not.toContain('href="/sources/1" class="line-clamp-2 font-semibold');
    });

    it("shows links from the selected source with full shared link content", async () => {
      const app = getApp();
      const res = await app.request("/sources/1");
      const html = await res.text();

      expect(html).toContain("This is commentary on an external link.");
      expect(html).toContain("Quoted shared link text.");
      expect(html).toContain('href="https://example.com/article"');
      expect(html).toContain("Example Article");
      expect(html).toContain("A rich preview description.");
      expect(html).toContain('src="https://example.com/preview.jpg"');
      expect(html).toContain("by Test Author");
      expect(html).toContain('href="/people/1"');
      expect(html).toContain("via");
    });

    it("returns 404 for missing sources", async () => {
      const app = getApp();
      const res = await app.request("/sources/999");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Source Not Found");
    });
  });

  describe("GET /posts/:slug", () => {
    it("returns 200 and displays post content for valid slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Test Post");
      expect(html).toContain("test content");
    });

    it("renders markdown content", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain("<strong>markdown</strong>");
    });

    it("displays tags linked to /tags/:slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain('href="/tags/testing"');
      expect(html).toContain("Testing");
      expect(html).toContain('href="/tags/typescript"');
      expect(html).toContain("TypeScript");
    });

    it("includes back link to feed", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain('href="/feed"');
      expect(html).toContain("← Feed");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");
      const html = await res.text();

      expect(html).toContain("dark:text-teal-400");
      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-300");
    });

    it("returns 404 for non-existent slug", async () => {
      const app = getApp();
      const res = await app.request("/posts/does-not-exist");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Post Not Found");
    });

    it("displays banner image when set", async () => {
      testDb
        .insert(media)
        .values({
          filename: "page-banner.jpg",
          mime_type: "image/jpeg",
          s3_key: "page-banner.jpg",
          created_at: new Date(),
        })
        .run();

      const mediaRow = testDb
        .select()
        .from(media)
        .all()
        .find((m) => m.s3_key === "page-banner.jpg")!;

      const now = new Date();
      testDb
        .insert(posts)
        .values({
          slug: "banner-post",
          type: "article",
          title: "Banner Post",
          content: "Content here",
          banner_image_id: mediaRow.id,
          published_at: now,
          created_at: now,
          updated_at: now,
        })
        .run();

      const app = getApp();
      const res = await app.request("/posts/banner-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('src="/media/page-banner.jpg"');
      expect(html).toContain('alt="Banner Post"');
    });

    it("includes og:image meta tag when banner is set", async () => {
      testDb
        .insert(media)
        .values({
          filename: "og-banner.jpg",
          mime_type: "image/jpeg",
          s3_key: "og-banner.jpg",
          created_at: new Date(),
        })
        .run();

      const mediaRow = testDb
        .select()
        .from(media)
        .all()
        .find((m) => m.s3_key === "og-banner.jpg")!;

      const now = new Date();
      testDb
        .insert(posts)
        .values({
          slug: "og-banner-post",
          type: "article",
          title: "OG Banner Post",
          content: "Content here",
          banner_image_id: mediaRow.id,
          published_at: now,
          created_at: now,
          updated_at: now,
        })
        .run();

      const app = getApp();
      const res = await app.request("/posts/og-banner-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('property="og:image"');
      expect(html).toContain("/media/og-banner.jpg");
    });

    it("does not display banner image when not set", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).not.toContain('class="w-full h-64 object-cover');
    });

    it("sets og:url to external URL for link posts", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-link");

      expect(res.status).toBe(200);

      const html = await res.text();
      // Link posts should have og:url pointing to the external article
      expect(html).toContain('property="og:url" content="https://example.com/article"');
    });

    it("renders an OG preview card for link posts", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-link");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Example Article");
      expect(html).toContain("A rich preview description.");
      expect(html).toContain("Example Site");
      expect(html).toContain('src="https://example.com/preview.jpg"');
      expect(html).toContain('href="https://example.com/article"');
    });

    it("links source attribution to the source detail page", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-link");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("via");
      expect(html).toContain('href="/sources/1"');
      expect(html).toContain("Test Blog");
      expect(html).toContain("by");
      expect(html).toContain('href="/people/1"');
      expect(html).toContain("Test Author");
    });

    it("backfills OG preview metadata for older link posts during page render", async () => {
      global.fetch = mock(
        async () =>
          new Response(
            `
            <html>
              <head>
                <meta property="og:title" content="Fetched Preview Title" />
                <meta property="og:description" content="Fetched preview description." />
                <meta property="og:image" content="https://example.com/fetched.jpg" />
                <meta property="og:site_name" content="Fetched Site" />
              </head>
            </html>
          `,
            {
              status: 200,
              headers: {
                "content-type": "text/html; charset=utf-8",
              },
            }
          )
      ) as unknown as typeof fetch;

      const renderTime = new Date();
      testDb
        .insert(posts)
        .values({
          slug: "backfill-link",
          type: "link",
          title: "Backfill Link",
          content: "Commentary for old link post.",
          url: "https://example.com/old-link",
          published_at: renderTime,
          created_at: renderTime,
          updated_at: renderTime,
        })
        .run();

      const app = getApp();
      const res = await app.request("/posts/backfill-link");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Fetched Preview Title");
      expect(html).toContain("Fetched preview description.");
      expect(html).toContain("Fetched Site");
      expect(html).toContain('src="https://example.com/fetched.jpg"');
    });

    it("sets og:url to site URL for article posts", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      // Article posts should have og:url pointing to the site
      expect(html).toContain('property="og:url"');
      expect(html).toContain("/posts/test-post");
    });

    it("uses a single-pane layout for article posts", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-post");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('class="mx-auto max-w-3xl"');
      expect(html).not.toContain("Followers");
      expect(html).not.toContain("Following");
    });

    it("keeps the actor card for link posts", async () => {
      const app = getApp();
      const res = await app.request("/posts/test-link");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("@erik@erikcraddock.me");
      expect(html).toContain("Followers");
      expect(html).toContain("Following");
    });
  });

  describe("GET /tags", () => {
    it("returns 200 and displays tags page", async () => {
      const app = getApp();
      const res = await app.request("/tags");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("<h1");
      expect(html).toContain("Tags");
    });

    it("displays tags with post counts", async () => {
      const app = getApp();
      const res = await app.request("/tags");
      const html = await res.text();

      // Should show tags that have posts
      expect(html).toContain("Testing");
      expect(html).toContain("TypeScript");
    });

    it("links tags to their tag pages", async () => {
      const app = getApp();
      const res = await app.request("/tags");
      const html = await res.text();

      expect(html).toContain('href="/tags/testing"');
      expect(html).toContain('href="/tags/typescript"');
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/tags");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
    });
  });

  describe("GET /tags/:slug", () => {
    it("returns 200 and displays tag name as heading", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("Posts tagged");
      expect(html).toContain("Testing");
    });

    it("displays only published posts with that tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      expect(html).toContain("Test Post");
      expect(html).not.toContain("Draft Post");
    });

    it("shows posts filtered by tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/typescript");
      const html = await res.text();

      expect(html).toContain("Test Post");
      expect(html).toContain("Another Post");
    });

    it("includes back link to home", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      expect(html).toContain('href="/"');
      expect(html).toContain("Back to home");
    });

    it("includes dark mode classes", async () => {
      const app = getApp();
      const res = await app.request("/tags/testing");
      const html = await res.text();

      expect(html).toContain("dark:bg-gray-900");
      expect(html).toContain("dark:text-gray-100");
      expect(html).toContain("dark:border-gray-700");
    });

    it("shows empty message for tag with no published posts", async () => {
      const app = getApp();
      const res = await app.request("/tags/empty-tag");

      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain("No posts tagged");
      expect(html).toContain("Empty Tag");
      expect(html).toContain("yet.");
    });

    it("returns 404 for non-existent tag", async () => {
      const app = getApp();
      const res = await app.request("/tags/nonexistent");

      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("Tag Not Found");
    });
  });

  describe("Note posts", () => {
    // Note: Home page now shows only article cards, not notes.
    // Notes are accessible via /posts/:slug but not listed on home page.

    describe("GET /posts/:slug (single note page)", () => {
      it("displays note in the single-post feed layout", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(res.status).toBe(200);
        expect(html).toContain("Post");
        expect(html).toContain("@erik@erikcraddock.me");
      });

      it("displays full note content", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(html).toContain("Short note content 🚀");
      });

      it("uses 'Note' as title fallback in page title", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(html).toContain("<title>Note | erikcraddock.me</title>");
      });

      it("does not display a note title heading", async () => {
        const app = getApp();
        const res = await app.request("/posts/short-note");
        const html = await res.text();

        expect(html).not.toContain("Short Note");
      });
    });
  });
});
