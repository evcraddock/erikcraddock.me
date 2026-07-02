# Slugkit API route specs

These design specs translate `docs/SLUGKIT_API_CONVERSION.md` into implementation-ready route groups for the `/api/v1` migration. They are docs-only and do not change runtime behavior.

## Shared conventions

- Mount all routes under `/api/v1`.
- Keep existing `/api` routes unchanged for the current `ec` CLI.
- Public routes: health, meta, and OpenAPI.
- Protected routes: all content, media, social, moderation, and site-config routes.
- Success responses use `{ "data": ... }` unless the route returns `204`.
- Errors use `{ "error": { "code", "message", "fields"?, "operation"? } }`.
- JSON fields exposed by `/api/v1` are camelCase.
- Operation IDs are required and stable.
- Unsupported optional features return standardized `501 NOT_IMPLEMENTED`, not legacy errors or missing routes.

## Spec documents

- `00-foundation-health-meta-site-config.md`
- `01-posts-tags-media.md`
- `02-contacts-sources-accounts.md`
- `03-followers-following-engagement.md`
- `04-comments.md`
- `05-implementation-phases-and-verification.md`
