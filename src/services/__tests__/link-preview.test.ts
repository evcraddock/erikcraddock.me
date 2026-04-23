import { afterEach, describe, expect, it, mock } from "bun:test";
import { fetchLinkPreview } from "../link-preview";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("fetchLinkPreview", () => {
  it("extracts Open Graph metadata from HTML", async () => {
    global.fetch = mock(
      async () =>
        new Response(
          `
          <html>
            <head>
              <meta property="og:title" content="Example Article" />
              <meta property="og:description" content="An example description" />
              <meta property="og:image" content="/images/card.jpg" />
              <meta property="og:site_name" content="Example Site" />
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

    const preview = await fetchLinkPreview("https://example.com/posts/test");

    expect(preview).toEqual({
      title: "Example Article",
      description: "An example description",
      imageUrl: "https://example.com/images/card.jpg",
      siteName: "Example Site",
    });
  });

  it("falls back to title tag and hostname when og tags are missing", async () => {
    global.fetch = mock(
      async () =>
        new Response(
          `
          <html>
            <head>
              <title>Fallback Title</title>
              <meta name="description" content="Fallback description" />
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

    const preview = await fetchLinkPreview("https://www.example.com/articles/fallback");

    expect(preview).toEqual({
      title: "Fallback Title",
      description: "Fallback description",
      imageUrl: null,
      siteName: "example.com",
    });
  });

  it("returns null for non-html responses", async () => {
    global.fetch = mock(
      async () =>
        new Response("{}", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
    ) as unknown as typeof fetch;

    const preview = await fetchLinkPreview("https://example.com/data.json");

    expect(preview).toBeNull();
  });
});
