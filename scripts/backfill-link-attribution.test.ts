import { describe, expect, it } from "bun:test";
import {
  buildPlan,
  inferAuthor,
  normalizeHostname,
  parseMetadata,
  type LinkListItem,
  type LinkPost,
  type Person,
  type Source,
} from "./backfill-link-attribution";

describe("backfill-link-attribution", () => {
  it("normalizes hostnames", () => {
    expect(normalizeHostname("https://www.Example.com/path")).toBe("example.com");
    expect(normalizeHostname("not a url")).toBeNull();
  });

  it("extracts JSON-LD authors", () => {
    const metadata = parseMetadata(`
      <html><head>
        <meta property="og:site_name" content="Example Site">
        <script type="application/ld+json">
          {"@type":"Article","author":{"name":"Ada Lovelace","url":"https://example.com/ada"}}
        </script>
      </head></html>
    `);

    expect(metadata.siteName).toBe("Example Site");
    expect(metadata.authorName).toBe("Ada Lovelace");
    expect(metadata.authorUrl).toBe("https://example.com/ada");
    expect(metadata.evidence).toContain("json_ld_author");
  });

  it("extracts RSS and Atom feed URLs", () => {
    const metadata = parseMetadata(
      `
      <html><head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      </head></html>
    `,
      "https://example.com/posts/one"
    );

    expect(metadata.feedUrl).toBe("https://example.com/feed.xml");
  });

  it("infers author from title byline", () => {
    const author = inferAuthor(
      {
        slug: "example",
        title: "An Interesting Post - by Jane Doe",
        url: "https://example.com/post",
        source_id: null,
        author_id: null,
      },
      null
    );

    expect(author).toEqual({
      name: "Jane Doe",
      url: null,
      confidence: "high",
      evidence: ["title_byline"],
    });
  });

  it("builds a plan grouped by site without mutating existing attribution", async () => {
    const links: LinkListItem[] = [
      { slug: "missing-both", title: "Post - by Jane Doe", source_id: null, author_id: null },
      { slug: "has-both", title: "Already Done", source_id: 1, author_id: 2 },
      { slug: "missing-author", title: "No Author", source_id: 1, author_id: null },
    ];
    const sources: Source[] = [
      {
        id: 1,
        name: "Example Site",
        url: "https://example.com/",
        feed_url: null,
        authors: [],
      },
    ];
    const people: Person[] = [{ id: 2, name: "Existing Author", url: null }];
    const posts: Record<string, LinkPost> = {
      "missing-both": {
        slug: "missing-both",
        title: "Post - by Jane Doe",
        url: "https://www.example.com/post",
        source_id: null,
        author_id: null,
      },
      "has-both": {
        slug: "has-both",
        title: "Already Done",
        url: "https://example.com/finished",
        source_id: 1,
        author_id: 2,
      },
      "missing-author": {
        slug: "missing-author",
        title: "No Author",
        url: "https://unknown.example/post",
        source_id: 1,
        author_id: null,
      },
    };

    const plan = await buildPlan({
      links,
      sources,
      people,
      fetchPages: false,
      loadLink: (slug) => posts[slug],
    });

    expect(plan.groups).toHaveLength(2);
    const exampleGroup = plan.groups.find((group) => group.siteKey === "example.com");
    expect(exampleGroup?.existingSourceId).toBe(1);
    expect(exampleGroup?.links.find((link) => link.slug === "missing-both")?.action).toBe(
      "update-source-and-author"
    );
    expect(exampleGroup?.links.find((link) => link.slug === "has-both")?.action).toBe("skip");
    expect(plan.ambiguous.map((link) => link.slug)).toContain("missing-author");
  });

  it("proposes discovered feed URLs for sources without feeds", async () => {
    const links: LinkListItem[] = [
      { slug: "post", title: "Post", source_id: null, author_id: null },
    ];
    const posts: Record<string, LinkPost> = {
      post: {
        slug: "post",
        title: "Post",
        url: "https://example.com/post",
        source_id: null,
        author_id: null,
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        `<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>`,
        { headers: { "content-type": "text/html" } }
      );

    try {
      const plan = await buildPlan({
        links,
        sources: [],
        people: [],
        fetchPages: true,
        loadLink: (slug) => posts[slug],
      });

      expect(plan.groups[0].proposedSource.feed_url).toBe("https://example.com/atom.xml");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("supports offset and limit for batches", async () => {
    const links: LinkListItem[] = [
      { slug: "first", title: "First", source_id: null, author_id: null },
      { slug: "second", title: "Second - by Jane Doe", source_id: null, author_id: null },
    ];
    const posts: Record<string, LinkPost> = {
      first: {
        slug: "first",
        title: "First",
        url: "https://first.example/post",
        source_id: null,
        author_id: null,
      },
      second: {
        slug: "second",
        title: "Second - by Jane Doe",
        url: "https://second.example/post",
        source_id: null,
        author_id: null,
      },
    };

    const plan = await buildPlan({
      links,
      sources: [],
      people: [],
      fetchPages: false,
      offset: 1,
      limit: 1,
      loadLink: (slug) => posts[slug],
    });

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].siteKey).toBe("second.example");
  });

  it("uses known site rules only as high-confidence author evidence", () => {
    const author = inferAuthor(
      {
        slug: "known-site",
        title: "Something Interesting",
        url: "https://simonwillison.net/2026/example",
        source_id: null,
        author_id: null,
      },
      null
    );

    expect(author.name).toBe("Simon Willison");
    expect(author.confidence).toBe("high");
    expect(author.evidence).toContain("known_site_rule");
  });
});
