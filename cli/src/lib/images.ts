/**
 * Image detection, upload, and URL rewriting utilities
 */

import * as fs from "fs";
import * as path from "path";
import type { ApiClient } from "./api";

export interface ImageReference {
  original: string; // The original reference (./path.jpg, image:42, https://...)
  type: "local" | "id" | "url";
  localPath?: string; // Resolved absolute path for local files
  imageId?: number; // Parsed ID for image:N references
}

/**
 * Detect all image references in frontmatter banner and markdown content
 */
export function detectImages(
  banner: string | undefined,
  content: string,
  basePath: string
): ImageReference[] {
  const refs: ImageReference[] = [];
  const seen = new Set<string>();

  // Check banner
  if (banner) {
    const ref = parseImageRef(banner, basePath);
    if (!seen.has(ref.original)) {
      refs.push(ref);
      seen.add(ref.original);
    }
  }

  // Find markdown images: ![alt](src)
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    const src = match[1].trim();
    if (!seen.has(src)) {
      refs.push(parseImageRef(src, basePath));
      seen.add(src);
    }
  }

  return refs;
}

/**
 * Parse a single image reference
 */
function parseImageRef(src: string, basePath: string): ImageReference {
  // External URL
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return { original: src, type: "url" };
  }

  // Image ID reference: image:42
  const idMatch = src.match(/^image:(\d+)$/);
  if (idMatch) {
    return { original: src, type: "id", imageId: parseInt(idMatch[1], 10) };
  }

  // Local file path
  const resolved = path.resolve(basePath, src);
  return { original: src, type: "local", localPath: resolved };
}

/**
 * Process images: upload local files, resolve IDs, build URL map
 */
export async function processImages(
  refs: ImageReference[],
  slug: string,
  client: ApiClient
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  for (const ref of refs) {
    if (ref.type === "url") {
      // External URLs stay as-is
      urlMap.set(ref.original, ref.original);
      continue;
    }

    if (ref.type === "id") {
      // Fetch URL for image ID
      const url = await resolveImageId(ref.imageId!, client);
      if (url) {
        urlMap.set(ref.original, url);
      } else {
        throw new Error(`Image not found: ${ref.original}`);
      }
      continue;
    }

    if (ref.type === "local") {
      // Upload local file
      if (!ref.localPath) {
        throw new Error(`Invalid local path: ${ref.original}`);
      }

      if (!fs.existsSync(ref.localPath)) {
        throw new Error(`File not found: ${ref.original} (resolved to ${ref.localPath})`);
      }

      const url = await uploadImage(ref.localPath, slug, client);
      urlMap.set(ref.original, url);
    }
  }

  return urlMap;
}

/**
 * Resolve an image ID to its URL
 */
async function resolveImageId(id: number, client: ApiClient): Promise<string | null> {
  const result = await client.getMedia(id);
  if (result.error || !result.data) {
    return null;
  }
  return result.data.url;
}

/**
 * Upload a local image file
 */
async function uploadImage(filePath: string, slug: string, client: ApiClient): Promise<string> {
  const filename = path.basename(filePath);
  const key = `posts/${slug}/${filename}`;

  const result = await client.uploadMedia(filePath, key);
  if (result.error || !result.data) {
    throw new Error(`Failed to upload ${filename}: ${result.error || "Unknown error"}`);
  }

  return result.data.url;
}

/**
 * Rewrite image references in content using URL map
 */
export function rewriteContent(content: string, urlMap: Map<string, string>): string {
  let result = content;

  for (const [original, url] of urlMap) {
    // Replace in markdown image syntax: ![alt](original) -> ![alt](url)
    const escaped = escapeRegex(original);
    const regex = new RegExp(`(!\\[[^\\]]*\\]\\()${escaped}(\\))`, "g");
    result = result.replace(regex, `$1${url}$2`);
  }

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
