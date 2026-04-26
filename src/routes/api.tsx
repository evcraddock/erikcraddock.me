import { readFileSync } from "fs";
import type { Context } from "hono";
import { join } from "path";
import { bodyLimit } from "hono/body-limit";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { requireApiKey } from "@/auth/api-key";
import {
  listPosts,
  getPost,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  unpublishPost,
  PostType,
  PostStatus,
} from "@/services/posts";
import { createMedia, deleteMedia, getMedia, isAllowedMimeType } from "@/services/media";
import {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
  type SourceAuthorInput,
} from "@/services/sources";
import { listTags } from "@/services/tags";
import { fetchLinkPreview } from "@/services/link-preview";
import { logger } from "@/utils/logger";
import {
  federatePost,
  sendDeleteActivity,
  sendDeleteActivityForUri,
  sendUpdateActivity,
  sendActorUpdateActivity,
} from "@/federation/publish";

let version = "unknown";
try {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
  version = packageJson.version || "unknown";
} catch {
  // Fallback if package.json can't be read
}

const api = new OpenAPIHono();
const protectedApi = new OpenAPIHono();

api.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API key",
  description: "Send the API key as a Bearer token in the Authorization header.",
});

api.doc("/openapi.json", (c: Context) => ({
  openapi: "3.1.0",
  info: {
    title: "erikcraddock.me API",
    version,
    description:
      "Authenticated content management API for posts, sources, tags, media, and federation actions.",
  },
  servers: [
    {
      url: `${new URL(c.req.url).origin}/api`,
      description: "Current environment",
    },
  ],
}));

api.get(
  "/docs",
  swaggerUI({
    url: "./openapi.json",
  })
);

protectedApi.use("*", requireApiKey);
const PostTypeSchema = z.enum(["article", "link", "note"]).openapi("PostType");
const NullableStringSchema = z.string().nullable();
const IsoDateTimeSchema = z.string().datetime();

const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Post not found" }),
  })
  .openapi("ErrorResponse");

const ApiPingSchema = z
  .object({
    status: z.literal("ok").openapi({ example: "ok" }),
    authenticated: z.string().email().openapi({ example: "erik@example.com" }),
  })
  .openapi("ApiPing");

const PersonSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Paul Graham" }),
    url: NullableStringSchema.openapi({ example: "https://paulgraham.com" }),
  })
  .openapi("Person");

const SourceAuthorSchema = PersonSchema.extend({
  sort_order: z.number().int().openapi({ example: 0 }),
}).openapi("SourceAuthor");

const SourceSummarySchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Hacker News" }),
    url: z.string().url().openapi({ example: "https://news.ycombinator.com" }),
    preview_title: NullableStringSchema,
    preview_description: NullableStringSchema,
    preview_image_url: NullableStringSchema,
    preview_site_name: NullableStringSchema,
    favicon_url: NullableStringSchema,
    authors: z.array(SourceAuthorSchema),
  })
  .openapi("SourceSummary");

const SourceSchema = SourceSummarySchema.extend({
  feed_url: NullableStringSchema,
}).openapi("Source");

const TagSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Tech" }),
    slug: z.string().openapi({ example: "tech" }),
    count: z.number().int().openapi({ example: 2 }),
  })
  .openapi("Tag");

const MediaRecordSchema = z
  .object({
    id: z.number().int().openapi({ example: 42 }),
    filename: z.string().openapi({ example: "hero.jpg" }),
    mime_type: z.string().openapi({ example: "image/jpeg" }),
    s3_key: z.string().openapi({ example: "posts/my-post/hero.jpg" }),
    alt_text: NullableStringSchema,
    created_at: IsoDateTimeSchema,
    url: z.string().openapi({ example: "/media/posts/my-post/hero.jpg" }),
  })
  .openapi("MediaRecord");

const PostListItemSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    slug: z.string().openapi({ example: "my-post" }),
    type: PostTypeSchema,
    title: NullableStringSchema,
    excerpt: NullableStringSchema,
    published_at: IsoDateTimeSchema.nullable(),
    source_id: z.number().int().nullable(),
    author_id: z.number().int().nullable(),
    source: SourceSummarySchema.nullable(),
    author: PersonSchema.nullable(),
    tags: z.array(z.string()).openapi({ example: ["Tech", "Writing"] }),
  })
  .openapi("PostListItem");

const PostSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    slug: z.string().openapi({ example: "my-post" }),
    type: PostTypeSchema,
    title: NullableStringSchema,
    content: z.string().openapi({ example: "# Hello" }),
    excerpt: NullableStringSchema,
    url: NullableStringSchema,
    og_title: NullableStringSchema,
    og_description: NullableStringSchema,
    og_image_url: NullableStringSchema,
    og_site_name: NullableStringSchema,
    source_id: z.number().int().nullable(),
    author_id: z.number().int().nullable(),
    banner_image_id: z.number().int().nullable(),
    banner_url: NullableStringSchema,
    source: SourceSummarySchema.nullable(),
    author: PersonSchema.nullable(),
    published_at: IsoDateTimeSchema.nullable(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    tags: z.array(z.string()).openapi({ example: ["Tech", "Writing"] }),
  })
  .openapi("Post");

const DeleteUriResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    uri: z.string().url().openapi({ example: "https://erikcraddock.me/posts/old-post" }),
  })
  .openapi("DeleteUriResponse");

const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
  })
  .openapi("SuccessResponse");

const dataEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema });

const IdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    example: "1",
  }),
});

const SlugParamSchema = z.object({
  slug: z.string().openapi({
    param: { name: "slug", in: "path" },
    example: "my-post",
  }),
});

const PostsQuerySchema = z.object({
  type: z.string().optional().openapi({ example: "article" }),
  tag: z.string().optional().openapi({ example: "tech" }),
  limit: z.string().optional().openapi({ example: "10" }),
  status: z
    .string()
    .optional()
    .openapi({ example: "published", enum: ["draft", "published", "all"] }),
});

const CreatePostBodySchema = z
  .object({
    type: z.string().openapi({ example: "article", enum: ["article", "link", "note"] }),
    slug: z.string().optional().openapi({ example: "my-post" }),
    title: z.string().optional().nullable(),
    content: z.string().optional().openapi({ example: "# Hello" }),
    excerpt: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    source_id: z.number().int().optional().nullable(),
    author_id: z.number().int().optional().nullable(),
    tags: z.array(z.string()).optional(),
    banner_image_id: z.number().int().optional().nullable(),
    published_at: z.string().optional().nullable().openapi({ example: "2024-03-15T10:30:00Z" }),
  })
  .openapi("CreatePostBody");

const UpdatePostBodySchema = z
  .object({
    title: z.string().optional().nullable(),
    content: z.string().optional(),
    excerpt: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    source_id: z.number().int().optional().nullable(),
    author_id: z.number().int().optional().nullable(),
    tags: z.array(z.string()).optional(),
    banner_image_id: z.number().int().optional().nullable(),
  })
  .openapi("UpdatePostBody");

const SourceAuthorInputSchema = z.union([
  z.string().openapi({ example: "Paul Graham" }),
  z.object({
    name: z.string().openapi({ example: "Paul Graham" }),
    url: z.string().optional().nullable().openapi({ example: "https://paulgraham.com" }),
  }),
]);

const SourceMetadataBodySchema = {
  preview_title: z.string().optional().nullable(),
  preview_description: z.string().optional().nullable(),
  preview_image_url: z.string().optional().nullable(),
  preview_site_name: z.string().optional().nullable(),
  favicon_url: z.string().optional().nullable(),
};

const CreateSourceBodySchema = z
  .object({
    name: z.string().openapi({ example: "Hacker News" }),
    url: z.string().openapi({ example: "https://news.ycombinator.com" }),
    feed_url: z.string().optional().nullable().openapi({ example: "https://hnrss.org/frontpage" }),
    authors: z.array(SourceAuthorInputSchema).optional().nullable(),
    ...SourceMetadataBodySchema,
  })
  .openapi("CreateSourceBody");

const UpdateSourceBodySchema = z
  .object({
    name: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    feed_url: z.string().optional().nullable(),
    authors: z.array(SourceAuthorInputSchema).optional().nullable(),
    ...SourceMetadataBodySchema,
  })
  .openapi("UpdateSourceBody");

function parseNullableString(input: unknown): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }

  return typeof input === "string" ? input.trim() || null : null;
}

function parseSourceAuthors(input: unknown): SourceAuthorInput[] | string | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return [];
  }

  if (!Array.isArray(input)) {
    return "Authors must be an array";
  }

  const authors: SourceAuthorInput[] = [];

  for (const [index, author] of input.entries()) {
    if (typeof author === "string") {
      const name = author.trim();
      if (!name) {
        return `Author at index ${index} must have a name`;
      }
      authors.push({ name });
      continue;
    }

    if (!author || typeof author !== "object" || Array.isArray(author)) {
      return `Author at index ${index} must be a string or object`;
    }

    const authorRecord = author as { name?: unknown; url?: unknown };
    if (typeof authorRecord.name !== "string" || authorRecord.name.trim().length === 0) {
      return `Author at index ${index} must have a name`;
    }

    if (
      authorRecord.url !== undefined &&
      authorRecord.url !== null &&
      typeof authorRecord.url !== "string"
    ) {
      return `Author URL at index ${index} must be a string`;
    }

    const authorUrl = typeof authorRecord.url === "string" ? authorRecord.url.trim() || null : null;
    authors.push({
      name: authorRecord.name.trim(),
      url: authorUrl,
    });
  }

  return authors;
}

const DeleteUriBodySchema = z
  .object({
    uri: z.string().url().openapi({ example: "https://erikcraddock.me/posts/4" }),
  })
  .openapi("DeleteUriBody");

const MediaUploadBodySchema = z
  .object({
    file: z.any().openapi({ type: "string", format: "binary" }),
    alt: z.string().optional(),
    key: z.string().optional(),
  })
  .openapi("MediaUploadBody");

const protectedRoute = <T extends Parameters<typeof createRoute>[0]>(route: T) =>
  createRoute({
    ...route,
    security: [{ Bearer: [] }],
  });

const registerProtectedRoute = protectedApi.openapi.bind(protectedApi) as unknown as (
  route: unknown,
  handler: (c: Context) => unknown
) => unknown;

function hasStoredLinkPreview(post: {
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_site_name?: string | null;
}): boolean {
  return Boolean(post.og_title || post.og_description || post.og_image_url || post.og_site_name);
}

async function getLinkPreviewData(url: string | null | undefined): Promise<{
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  og_site_name: string | null;
} | null> {
  if (!url) {
    return null;
  }

  const preview = await fetchLinkPreview(url);
  if (!preview) {
    return null;
  }

  return {
    og_title: preview.title,
    og_description: preview.description,
    og_image_url: preview.imageUrl,
    og_site_name: preview.siteName,
  };
}

async function getSourcePreviewData(url: string): Promise<{
  preview_title: string | null;
  preview_description: string | null;
  preview_image_url: string | null;
  preview_site_name: string | null;
  favicon_url: string | null;
} | null> {
  const preview = await fetchLinkPreview(url);
  if (!preview) {
    return null;
  }

  return {
    preview_title: preview.title,
    preview_description: preview.description,
    preview_image_url: preview.imageUrl,
    preview_site_name: preview.siteName,
    favicon_url: preview.faviconUrl,
  };
}

function hasFederatedPostChanges(
  existingPost: {
    title: string | null;
    content: string;
    excerpt: string | null;
    url: string | null;
    source_id: number | null;
    author_id: number | null;
    banner_image_id: number | null;
  },
  input: {
    title?: string | null;
    content?: string;
    excerpt?: string | null;
    url?: string | null;
    source_id?: number | null;
    author_id?: number | null;
    tags?: string[];
    banner_image_id?: number | null;
  }
): boolean {
  if (input.title !== undefined && (input.title?.trim() || null) !== existingPost.title) {
    return true;
  }

  if (input.content !== undefined && input.content.trim() !== existingPost.content) {
    return true;
  }

  if (input.excerpt !== undefined && (input.excerpt?.trim() || null) !== existingPost.excerpt) {
    return true;
  }

  if (input.url !== undefined && (input.url?.trim() || null) !== existingPost.url) {
    return true;
  }

  if (input.source_id !== undefined && input.source_id !== existingPost.source_id) {
    return true;
  }

  if (input.author_id !== undefined && input.author_id !== existingPost.author_id) {
    return true;
  }

  if (
    input.banner_image_id !== undefined &&
    input.banner_image_id !== existingPost.banner_image_id
  ) {
    return true;
  }

  return input.tags !== undefined;
}

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/ping",
    tags: ["system"],
    summary: "Authenticated ping",
    responses: {
      200: {
        description: "API is reachable and the API key was accepted.",
        content: {
          "application/json": {
            schema: dataEnvelope(ApiPingSchema),
          },
        },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const auth = c.get("apiAuth");
    return c.json({
      data: {
        status: "ok",
        authenticated: auth.email,
      },
    });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/posts",
    tags: ["posts"],
    summary: "List posts",
    request: {
      query: PostsQuerySchema,
    },
    responses: {
      200: {
        description: "Posts matching the supplied filters.",
        content: {
          "application/json": {
            schema: dataEnvelope(z.array(PostListItemSchema)),
          },
        },
      },
      400: {
        description: "Invalid query parameter.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const type = c.req.query("type") as PostType | undefined;
    const tag = c.req.query("tag");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const status = c.req.query("status") as PostStatus | undefined;

    if (type && !["article", "link", "note"].includes(type)) {
      return c.json({ error: "Invalid type. Must be article, link, or note" }, 400);
    }

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return c.json({ error: "Invalid limit. Must be 1 or greater" }, 400);
    }

    if (status && !["draft", "published", "all"].includes(status)) {
      return c.json({ error: "Invalid status. Must be draft, published, or all" }, 400);
    }

    const posts = listPosts({ type, tag, limit, status });
    return c.json({ data: posts });
  }
);

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LENGTH = 200;

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/posts",
    tags: ["posts"],
    summary: "Create a post",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreatePostBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "The post was created.",
        content: {
          "application/json": {
            schema: dataEnvelope(PostSchema),
          },
        },
      },
      400: {
        description: "The request body failed validation.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const body = await c.req.json();
    const {
      type,
      slug,
      title,
      content,
      excerpt,
      url,
      source_id,
      author_id,
      tags,
      banner_image_id,
      published_at,
    } = body;

    if (!type || !["article", "link", "note"].includes(type)) {
      return c.json({ error: "Invalid or missing type. Must be article, link, or note" }, 400);
    }

    if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
      return c.json({ error: "Slug is required" }, 400);
    }

    if (!SLUG_PATTERN.test(slug)) {
      return c.json(
        { error: "Invalid slug format. Use only lowercase letters, numbers, and hyphens" },
        400
      );
    }

    if (slug.length > SLUG_MAX_LENGTH) {
      return c.json({ error: `Slug must be ${SLUG_MAX_LENGTH} characters or less` }, 400);
    }

    const existingPost = getPostBySlug(slug);
    if (existingPost) {
      return c.json({ error: "Slug already exists" }, 400);
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return c.json({ error: "Content is required" }, 400);
    }

    if (type === "article" && (!title || typeof title !== "string" || title.trim().length === 0)) {
      return c.json({ error: "Title is required for articles" }, 400);
    }

    if (type === "link" && (!url || typeof url !== "string" || url.trim().length === 0)) {
      return c.json({ error: "URL is required for links" }, 400);
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      return c.json({ error: "Tags must be an array" }, 400);
    }

    if (
      banner_image_id !== undefined &&
      banner_image_id !== null &&
      typeof banner_image_id !== "number"
    ) {
      return c.json({ error: "banner_image_id must be a number" }, 400);
    }

    if (source_id !== undefined && source_id !== null && typeof source_id !== "number") {
      return c.json({ error: "source_id must be a number" }, 400);
    }

    if (author_id !== undefined && author_id !== null && typeof author_id !== "number") {
      return c.json({ error: "author_id must be a number" }, 400);
    }

    let publishedAtDate: Date | null = null;
    if (published_at !== undefined && published_at !== null) {
      if (typeof published_at !== "string") {
        return c.json({ error: "published_at must be an ISO date string" }, 400);
      }
      publishedAtDate = new Date(published_at);
      if (isNaN(publishedAtDate.getTime())) {
        return c.json({ error: "published_at is not a valid date" }, 400);
      }
    }

    try {
      const normalizedUrl = url?.trim() || null;
      const linkPreview = type === "link" ? await getLinkPreviewData(normalizedUrl) : null;
      const post = createPost({
        type,
        slug,
        title: title?.trim() || null,
        content: content.trim(),
        excerpt: excerpt?.trim() || null,
        url: normalizedUrl,
        og_title: linkPreview?.og_title,
        og_description: linkPreview?.og_description,
        og_image_url: linkPreview?.og_image_url,
        og_site_name: linkPreview?.og_site_name,
        source_id: source_id ?? null,
        author_id: author_id ?? null,
        tags: tags || [],
        banner_image_id: banner_image_id ?? null,
        published_at: publishedAtDate,
      });

      return c.json({ data: post }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/posts/{id}",
    tags: ["posts"],
    summary: "Get a post by ID",
    request: { params: IdParamSchema },
    responses: {
      200: {
        description: "The requested post.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid post ID" }, 400);
    }

    const post = getPost(id);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    return c.json({ data: post });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "put",
    path: "/posts/{id}",
    tags: ["posts"],
    summary: "Update a post by ID",
    request: {
      params: IdParamSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: UpdatePostBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "The updated post.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      400: {
        description: "The request body or ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid post ID" }, 400);
    }

    const body = await c.req.json();
    const { title, content, excerpt, url, source_id, author_id, tags, banner_image_id } = body;

    if (tags !== undefined && !Array.isArray(tags)) {
      return c.json({ error: "Tags must be an array" }, 400);
    }

    if (
      banner_image_id !== undefined &&
      banner_image_id !== null &&
      typeof banner_image_id !== "number"
    ) {
      return c.json({ error: "banner_image_id must be a number" }, 400);
    }

    if (source_id !== undefined && source_id !== null && typeof source_id !== "number") {
      return c.json({ error: "source_id must be a number" }, 400);
    }

    if (author_id !== undefined && author_id !== null && typeof author_id !== "number") {
      return c.json({ error: "author_id must be a number" }, 400);
    }

    try {
      const existingPost = getPost(id);
      if (!existingPost) {
        return c.json({ error: "Post not found" }, 404);
      }

      const shouldFederateUpdate = hasFederatedPostChanges(existingPost, {
        title,
        content,
        excerpt,
        url,
        source_id,
        author_id,
        tags,
        banner_image_id,
      });
      const nextUrl = url !== undefined ? url?.trim() || null : existingPost.url;
      const linkPreview =
        existingPost.type === "link" && (url !== undefined || !hasStoredLinkPreview(existingPost))
          ? await getLinkPreviewData(nextUrl)
          : null;
      const post = updatePost(id, {
        title: title !== undefined ? title?.trim() || null : undefined,
        content: content?.trim(),
        excerpt: excerpt !== undefined ? excerpt?.trim() || null : undefined,
        url: url !== undefined ? url?.trim() || null : undefined,
        og_title:
          existingPost?.type === "link" &&
          (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_title ?? null)
            : undefined,
        og_description:
          existingPost?.type === "link" &&
          (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_description ?? null)
            : undefined,
        og_image_url:
          existingPost?.type === "link" &&
          (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_image_url ?? null)
            : undefined,
        og_site_name:
          existingPost?.type === "link" &&
          (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_site_name ?? null)
            : undefined,
        source_id,
        author_id,
        tags,
        banner_image_id,
      });

      if (!post) {
        return c.json({ error: "Post not found" }, 404);
      }

      if (post.published_at && shouldFederateUpdate) {
        await sendUpdateActivity(post.id);
      }

      return c.json({ data: post });
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "delete",
    path: "/posts/{id}",
    tags: ["posts"],
    summary: "Delete a post by ID",
    request: { params: IdParamSchema },
    responses: {
      204: {
        description: "The post was deleted.",
      },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid post ID" }, 400);
    }

    const existingPost = getPost(id);
    const wasPublished = existingPost?.published_at;
    const slug = existingPost?.slug;
    const deleted = deletePost(id);

    if (!deleted) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (wasPublished && slug) {
      await sendDeleteActivity(slug);
    }

    return c.body(null, 204);
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/posts/{id}/publish",
    tags: ["posts"],
    summary: "Publish a post by ID",
    request: { params: IdParamSchema },
    responses: {
      200: {
        description: "The post was published.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid post ID" }, 400);
    }

    const existingPost = getPost(id);
    if (!existingPost) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (existingPost.type === "link" && existingPost.url && !hasStoredLinkPreview(existingPost)) {
      try {
        const linkPreview = await getLinkPreviewData(existingPost.url);
        updatePost(id, {
          og_title: linkPreview?.og_title ?? null,
          og_description: linkPreview?.og_description ?? null,
          og_image_url: linkPreview?.og_image_url ?? null,
          og_site_name: linkPreview?.og_site_name ?? null,
        });
      } catch (error) {
        logger.warn("link-preview", "Failed to backfill link preview on publish", {
          postId: id,
          error: String(error),
        });
      }
    }

    const post = publishPost(id);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    federatePost(id).catch(() => {
      // Error already logged in federatePost
    });

    return c.json({ data: post });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/posts/{id}/unpublish",
    tags: ["posts"],
    summary: "Unpublish a post by ID",
    request: { params: IdParamSchema },
    responses: {
      200: {
        description: "The post was unpublished.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid post ID" }, 400);
    }

    const post = unpublishPost(id);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    return c.json({ data: post });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/posts/by-slug/{slug}",
    tags: ["posts"],
    summary: "Get a post by slug",
    request: { params: SlugParamSchema },
    responses: {
      200: {
        description: "The requested post.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const post = getPostBySlug(c.req.param("slug") ?? "");
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    return c.json({ data: post });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "put",
    path: "/posts/by-slug/{slug}",
    tags: ["posts"],
    summary: "Update a post by slug",
    request: {
      params: SlugParamSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: UpdatePostBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "The updated post.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      400: {
        description: "The request body was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const slug = c.req.param("slug") ?? "";
    const existingPost = getPostBySlug(slug);
    if (!existingPost) {
      return c.json({ error: "Post not found" }, 404);
    }

    const body = await c.req.json();
    const { title, content, excerpt, url, source_id, author_id, tags, banner_image_id } = body;

    if (tags !== undefined && !Array.isArray(tags)) {
      return c.json({ error: "Tags must be an array" }, 400);
    }

    if (
      banner_image_id !== undefined &&
      banner_image_id !== null &&
      typeof banner_image_id !== "number"
    ) {
      return c.json({ error: "banner_image_id must be a number" }, 400);
    }

    if (source_id !== undefined && source_id !== null && typeof source_id !== "number") {
      return c.json({ error: "source_id must be a number" }, 400);
    }

    if (author_id !== undefined && author_id !== null && typeof author_id !== "number") {
      return c.json({ error: "author_id must be a number" }, 400);
    }

    try {
      const shouldFederateUpdate = hasFederatedPostChanges(existingPost, {
        title,
        content,
        excerpt,
        url,
        source_id,
        author_id,
        tags,
        banner_image_id,
      });
      const nextUrl = url !== undefined ? url?.trim() || null : existingPost.url;
      const linkPreview =
        existingPost.type === "link" && (url !== undefined || !hasStoredLinkPreview(existingPost))
          ? await getLinkPreviewData(nextUrl)
          : null;
      const post = updatePost(existingPost.id, {
        title: title !== undefined ? title?.trim() || null : undefined,
        content: content?.trim(),
        excerpt: excerpt !== undefined ? excerpt?.trim() || null : undefined,
        url: url !== undefined ? url?.trim() || null : undefined,
        og_title:
          existingPost.type === "link" && (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_title ?? null)
            : undefined,
        og_description:
          existingPost.type === "link" && (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_description ?? null)
            : undefined,
        og_image_url:
          existingPost.type === "link" && (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_image_url ?? null)
            : undefined,
        og_site_name:
          existingPost.type === "link" && (url !== undefined || !hasStoredLinkPreview(existingPost))
            ? (linkPreview?.og_site_name ?? null)
            : undefined,
        source_id,
        author_id,
        tags,
        banner_image_id,
      });

      if (!post) {
        return c.json({ error: "Post not found" }, 404);
      }

      if (post.published_at && shouldFederateUpdate) {
        await sendUpdateActivity(post.id);
      }

      return c.json({ data: post });
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "delete",
    path: "/posts/by-slug/{slug}",
    tags: ["posts"],
    summary: "Delete a post by slug",
    request: { params: SlugParamSchema },
    responses: {
      204: {
        description: "The post was deleted.",
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const slug = c.req.param("slug") ?? "";
    const existingPost = getPostBySlug(slug);
    if (!existingPost) {
      return c.json({ error: "Post not found" }, 404);
    }

    const wasPublished = !!existingPost.published_at;
    const postId = existingPost.id;
    const deleted = deletePost(postId);

    if (!deleted) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (wasPublished) {
      await sendDeleteActivity(slug);
    }

    return c.body(null, 204);
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/posts/by-slug/{slug}/publish",
    tags: ["posts"],
    summary: "Publish a post by slug",
    request: { params: SlugParamSchema },
    responses: {
      200: {
        description: "The post was published.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const slug = c.req.param("slug") ?? "";
    const existingPost = getPostBySlug(slug);
    if (!existingPost) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (existingPost.type === "link" && existingPost.url && !hasStoredLinkPreview(existingPost)) {
      try {
        const linkPreview = await getLinkPreviewData(existingPost.url);
        updatePost(existingPost.id, {
          og_title: linkPreview?.og_title ?? null,
          og_description: linkPreview?.og_description ?? null,
          og_image_url: linkPreview?.og_image_url ?? null,
          og_site_name: linkPreview?.og_site_name ?? null,
        });
      } catch (error) {
        logger.warn("link-preview", "Failed to backfill link preview on publish", {
          postId: existingPost.id,
          error: String(error),
        });
      }
    }

    const post = publishPost(existingPost.id);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    federatePost(existingPost.id).catch(() => {
      // Error already logged in federatePost
    });

    return c.json({ data: post });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/posts/by-slug/{slug}/unpublish",
    tags: ["posts"],
    summary: "Unpublish a post by slug",
    request: { params: SlugParamSchema },
    responses: {
      200: {
        description: "The post was unpublished.",
        content: { "application/json": { schema: dataEnvelope(PostSchema) } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The post was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const slug = c.req.param("slug") ?? "";
    const existingPost = getPostBySlug(slug);
    if (!existingPost) {
      return c.json({ error: "Post not found" }, 404);
    }

    const post = unpublishPost(existingPost.id);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    return c.json({ data: post });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/sources",
    tags: ["sources"],
    summary: "List sources",
    responses: {
      200: {
        description: "All configured sources.",
        content: { "application/json": { schema: dataEnvelope(z.array(SourceSchema)) } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => c.json({ data: listSources() })
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/sources/{id}",
    tags: ["sources"],
    summary: "Get a source by ID",
    request: { params: IdParamSchema },
    responses: {
      200: {
        description: "The requested source.",
        content: { "application/json": { schema: dataEnvelope(SourceSchema) } },
      },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The source was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid source ID" }, 400);
    }

    const source = getSource(id);
    if (!source) {
      return c.json({ error: "Source not found" }, 404);
    }

    return c.json({ data: source });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/sources",
    tags: ["sources"],
    summary: "Create a source",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateSourceBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "The source was created.",
        content: { "application/json": { schema: dataEnvelope(SourceSchema) } },
      },
      400: {
        description: "The request body failed validation.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const body = await c.req.json();
    const {
      name,
      url,
      feed_url,
      authors,
      preview_title,
      preview_description,
      preview_image_url,
      preview_site_name,
      favicon_url,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return c.json({ error: "Name is required" }, 400);
    }

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return c.json({ error: "URL is required" }, 400);
    }

    const parsedAuthors = parseSourceAuthors(authors);
    if (typeof parsedAuthors === "string") {
      return c.json({ error: parsedAuthors }, 400);
    }

    try {
      const sourceUrl = url.trim();
      const fetchedPreview = await getSourcePreviewData(sourceUrl);
      const source = createSource({
        name: name.trim(),
        url: sourceUrl,
        feed_url: feed_url?.trim() || null,
        authors: parsedAuthors,
        preview_title: parseNullableString(preview_title) ?? fetchedPreview?.preview_title ?? null,
        preview_description:
          parseNullableString(preview_description) ?? fetchedPreview?.preview_description ?? null,
        preview_image_url:
          parseNullableString(preview_image_url) ?? fetchedPreview?.preview_image_url ?? null,
        preview_site_name:
          parseNullableString(preview_site_name) ?? fetchedPreview?.preview_site_name ?? null,
        favicon_url: parseNullableString(favicon_url) ?? fetchedPreview?.favicon_url ?? null,
      });

      return c.json({ data: source }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "put",
    path: "/sources/{id}",
    tags: ["sources"],
    summary: "Update a source",
    request: {
      params: IdParamSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: UpdateSourceBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "The updated source.",
        content: { "application/json": { schema: dataEnvelope(SourceSchema) } },
      },
      400: {
        description: "The request body or ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The source was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid source ID" }, 400);
    }

    const body = await c.req.json();
    const {
      name,
      url,
      feed_url,
      authors,
      preview_title,
      preview_description,
      preview_image_url,
      preview_site_name,
      favicon_url,
    } = body;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return c.json({ error: "Name cannot be empty" }, 400);
    }

    if (url !== undefined && (typeof url !== "string" || url.trim().length === 0)) {
      return c.json({ error: "URL cannot be empty" }, 400);
    }

    const parsedAuthors = parseSourceAuthors(authors);
    if (typeof parsedAuthors === "string") {
      return c.json({ error: parsedAuthors }, 400);
    }

    try {
      const existingSource = getSource(id);
      const sourceUrl = url?.trim() || existingSource?.url;
      const fetchedPreview =
        url !== undefined && sourceUrl ? await getSourcePreviewData(sourceUrl) : null;
      const source = updateSource(id, {
        name: name?.trim(),
        url: url?.trim(),
        feed_url: feed_url !== undefined ? feed_url?.trim() || null : undefined,
        authors: parsedAuthors,
        preview_title:
          preview_title !== undefined
            ? parseNullableString(preview_title)
            : (fetchedPreview?.preview_title ?? undefined),
        preview_description:
          preview_description !== undefined
            ? parseNullableString(preview_description)
            : (fetchedPreview?.preview_description ?? undefined),
        preview_image_url:
          preview_image_url !== undefined
            ? parseNullableString(preview_image_url)
            : (fetchedPreview?.preview_image_url ?? undefined),
        preview_site_name:
          preview_site_name !== undefined
            ? parseNullableString(preview_site_name)
            : (fetchedPreview?.preview_site_name ?? undefined),
        favicon_url:
          favicon_url !== undefined
            ? parseNullableString(favicon_url)
            : (fetchedPreview?.favicon_url ?? undefined),
      });

      if (!source) {
        return c.json({ error: "Source not found" }, 404);
      }

      return c.json({ data: source });
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "delete",
    path: "/sources/{id}",
    tags: ["sources"],
    summary: "Delete a source",
    request: { params: IdParamSchema },
    responses: {
      204: { description: "The source was deleted." },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The source was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid source ID" }, 400);
    }

    const deleted = deleteSource(id);
    if (!deleted) {
      return c.json({ error: "Source not found" }, 404);
    }

    return c.body(null, 204);
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/tags",
    tags: ["tags"],
    summary: "List tags",
    responses: {
      200: {
        description: "All tags with usage counts.",
        content: { "application/json": { schema: dataEnvelope(z.array(TagSchema)) } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => c.json({ data: listTags() })
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/media",
    tags: ["media"],
    summary: "Upload media",
    request: {
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: MediaUploadBodySchema,
          },
        },
      },
    },
    middleware: [
      bodyLimit({
        maxSize: 10 * 1024 * 1024,
        onError: (c: Context) => c.json({ error: "File too large. Maximum size is 10 MB" }, 413),
      }),
    ],
    responses: {
      201: {
        description: "The media file was uploaded.",
        content: { "application/json": { schema: dataEnvelope(MediaRecordSchema) } },
      },
      400: {
        description: "The file input failed validation.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      413: {
        description: "The uploaded file was too large.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "The file could not be stored.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "File is required" }, 400);
    }

    if (!isAllowedMimeType(file.type)) {
      return c.json({ error: "Invalid file type. Allowed: jpg, png, gif, webp" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const altText = typeof body.alt === "string" ? body.alt.trim() : undefined;
    const customKey = typeof body.key === "string" ? body.key.trim() : undefined;

    try {
      const record = await createMedia({
        file: buffer,
        filename: file.name,
        mimeType: file.type,
        altText: altText || undefined,
        customKey: customKey || undefined,
      });

      return c.json({ data: record }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "get",
    path: "/media/{id}",
    tags: ["media"],
    summary: "Get a media record by ID",
    request: { params: IdParamSchema },
    responses: {
      200: {
        description: "The requested media record.",
        content: { "application/json": { schema: dataEnvelope(MediaRecordSchema) } },
      },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The media record was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid media ID" }, 400);
    }

    const record = getMedia(id);
    if (!record) {
      return c.json({ error: "Media not found" }, 404);
    }

    return c.json({ data: record });
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "delete",
    path: "/media/{id}",
    tags: ["media"],
    summary: "Delete a media record by ID",
    request: { params: IdParamSchema },
    responses: {
      204: { description: "The media record was deleted." },
      400: {
        description: "The ID was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "The media record was not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "The media record could not be deleted.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    const id = parseInt(c.req.param("id") ?? "", 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid media ID" }, 400);
    }

    try {
      const deleted = await deleteMedia(id);
      if (!deleted) {
        return c.json({ error: "Media not found" }, 404);
      }

      return c.body(null, 204);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/federation/update-actor",
    tags: ["federation"],
    summary: "Send an ActivityPub actor update",
    responses: {
      200: {
        description: "Whether the update activity was sent.",
        content: { "application/json": { schema: SuccessResponseSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "The update activity could not be sent.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    try {
      const sent = await sendActorUpdateActivity();
      return c.json({ success: sent });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  }
);

registerProtectedRoute(
  protectedRoute({
    method: "post",
    path: "/federation/delete",
    tags: ["federation"],
    summary: "Send an ActivityPub Delete for an arbitrary URI",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: DeleteUriBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Whether the delete activity was sent.",
        content: { "application/json": { schema: DeleteUriResponseSchema } },
      },
      400: {
        description: "The URI was invalid.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "The delete activity could not be sent.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  }),
  async (c: Context) => {
    try {
      const body = await c.req.json();
      const { uri } = body;

      if (!uri || typeof uri !== "string") {
        return c.json({ error: "uri is required and must be a string" }, 400);
      }

      try {
        new URL(uri);
      } catch {
        return c.json({ error: "uri must be a valid URL" }, 400);
      }

      const sent = await sendDeleteActivityForUri(uri);
      return c.json({ success: sent, uri });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  }
);

api.route("/", protectedApi);

export { api };
