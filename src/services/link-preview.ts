import { logger } from "@/utils/logger";

export interface LinkPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegExp(name)}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveUrl(maybeUrl: string | null, baseUrl: string): string | null {
  if (!maybeUrl) {
    return null;
  }

  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function getFallbackSiteName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "erikcraddock.me link preview bot/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      logger.warn("link-preview", "Failed to fetch link preview", {
        url,
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    const html = await response.text();
    const finalUrl = response.url || url;

    const title =
      extractMetaContent(html, "og:title") ??
      extractMetaContent(html, "twitter:title") ??
      extractTitleTag(html);
    const description =
      extractMetaContent(html, "og:description") ??
      extractMetaContent(html, "description") ??
      extractMetaContent(html, "twitter:description");
    const imageUrl = resolveUrl(
      extractMetaContent(html, "og:image") ?? extractMetaContent(html, "twitter:image"),
      finalUrl
    );
    const siteName = extractMetaContent(html, "og:site_name") ?? getFallbackSiteName(finalUrl);

    if (!title && !description && !imageUrl && !siteName) {
      return null;
    }

    return {
      title,
      description,
      imageUrl,
      siteName,
    };
  } catch (error) {
    logger.warn("link-preview", "Error fetching link preview", {
      url,
      error: String(error),
    });
    return null;
  }
}
