# Slugkit API conversion architecture

## Purpose

This document turns the Slugkit API conversion research in `docs/SLUGKIT_API_CONVERSION.md` into implementation-ready architecture guidance. It is design-only: do not change functional API behavior as part of this task.

## Goals

- Add a Slugkit-compatible `/api/v1` surface without breaking the existing `/api` API.
- Keep the current `ec` CLI working during migration.
- Standardize `/api/v1` auth, response envelopes, error payloads, and OpenAPI operation IDs.
- Implement route groups as small reviewable slices with adapters over current services and schema.
- Preserve production data and ActivityPub behavior unless a later task explicitly migrates them.

## Non-goals

- Do not rename database tables or columns just to match Slugkit terminology.
- Do not remove or redirect existing `/api` routes in the initial migration.
- Do not change the `ec` CLI contract until Slugkit CLI compatibility is proven.
- Do not introduce broad ActivityPub behavior changes while adding Slugkit route adapters.

## Target API layout

Mount a new router beside the legacy router:

```ts
app.route("/api", api);
app.route("/api/v1", slugkitApi);
```

The legacy `/api` router remains the compatibility surface for the current `ec` CLI. The new `/api/v1` router owns the Slugkit contract, including OpenAPI paths, operation IDs, camelCase JSON, standardized errors, and optional `501 NOT_IMPLEMENTED` responses.

Public `/api/v1` routes:

- `GET /api/v1/health`
- `GET /api/v1/meta`
- `GET /api/v1/openapi.json`

Protected `/api/v1` routes use the existing bearer API-key mechanism unless a route spec explicitly says it is public.

## Router structure

Recommended initial structure:

```text
src/routes/api-v1/
  index.ts
  openapi.ts
  health.ts
  meta.ts
  posts.ts
  tags.ts
  contacts.ts
  sources.ts
  accounts.ts
  media.ts
  followers.ts
  following.ts
  engagement.ts
  comments.ts
  site-config.ts
  helpers/
    auth.ts
    errors.ts
    responses.ts
    serializers.ts
```

Keep `/api/v1` route handlers thin. They should validate Slugkit request shapes, call existing services, serialize internal results to Slugkit response shapes, and return standardized responses.

## OpenAPI generation

`/api/v1/openapi.json` should be generated from the `/api/v1` route definitions, not copied from the legacy `/api/openapi.json` document. Every route must define an explicit Slugkit operation ID.

Conventions:

- Use OpenAPI 3.1.
- Use server URL `/api/v1`.
- Keep operation IDs stable and dot-separated: `resource.action` or `resource.subresource.action`.
- Use shared components for auth, envelopes, validation errors, not-implemented responses, and common resource schemas.
- Register following and other social routes through OpenAPI-aware route helpers so they appear in the document.

Operation ID examples:

| Route                          | Operation ID           |
| ------------------------------ | ---------------------- |
| `GET /health`                  | `health.get`           |
| `GET /meta`                    | `meta.get`             |
| `GET /posts`                   | `posts.list`           |
| `POST /posts`                  | `posts.create`         |
| `GET /posts/{slug}/engagement` | `posts.engagement.get` |
| `POST /comments/{id}/approve`  | `comments.approve`     |

## Response envelope

Use a shared success helper so route groups do not drift.

Recommended shapes:

```json
{ "data": { "id": "example" } }
```

```json
{ "data": [{ "id": "example" }] }
```

Delete routes that Slugkit specifies as `204` should return no body.

If a route needs pagination metadata, use one consistent extension shape:

```json
{
  "data": [],
  "meta": { "limit": 50, "offset": 0, "total": 0 }
}
```

Do not reuse legacy snake_case response bodies in `/api/v1`.

## Error response helper

All `/api/v1` errors should use a shared helper with this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": { "title": "Required" },
    "operation": "posts.create"
  }
}
```

Required standard codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `NOT_IMPLEMENTED`
- `INTERNAL_ERROR`

The helper should accept the operation ID so errors can include the failing operation consistently.

## Auth behavior

Reuse the existing bearer API-key auth path for protected `/api/v1` routes. The auth middleware should produce Slugkit error payloads instead of legacy `{ "error": "message" }` strings.

Expected behavior:

- Missing bearer token: `401 UNAUTHORIZED`.
- Invalid bearer token: `401 UNAUTHORIZED`.
- Authenticated route success may use the current user/site admin context internally.
- `GET /api/v1/health`, `GET /api/v1/meta`, and `GET /api/v1/openapi.json` are public.
- `GET /api/v1/ping`, if added for diagnostics, should return `{ "data": { "status": "ok", "authenticated": true } }` and stay protected.

## Serialization strategy

Keep internal service and database shapes stable. Add serializers at the `/api/v1` boundary to convert:

- snake_case fields to camelCase fields,
- `people`/`authors` terminology to `contacts`/`creditedContacts`,
- embedded `social_accounts` to Slugkit `accounts`,
- ActivityPub-specific fields to generic profile/activity URL fields where possible.

Serializers should be covered by focused tests in later implementation tasks because they contain compatibility logic.

## Compatibility strategy

### Legacy `/api`

Keep `/api` available until all of these are true:

1. `/api/v1` covers the Slugkit commands needed for daily use.
2. `slug doctor` passes against local and deployed environments.
3. Representative Slugkit CLI commands are verified.
4. The `ec` CLI has been retired, updated, or intentionally pinned to legacy behavior.
5. A human approves any deprecation or redirect plan.

### Existing `ec` CLI

The `ec` CLI should continue using `/api`. Do not change its default base path in route implementation tasks unless the task explicitly includes CLI migration. Any route-level breaking change to `/api` is out of scope for `/api/v1` additions.

### Deployment behavior

Adding `/api/v1` should not require a deployment topology change. Verify that reverse proxies, CORS, and API base URL assumptions allow both `/api` and `/api/v1`.

### Database schema

Prefer adapters over schema changes in early phases. Schema changes are only justified when a Slugkit feature cannot be represented with current persistence, such as generic site-owned accounts or local comments. Any schema change must follow the migration workflow in `AGENTS.md`.

### ActivityPub behavior

ActivityPub inbox/outbox, federation update/delete helpers, follower state, and comment moderation should keep existing semantics. Slugkit routes should expose safe summaries or moderation actions, not rewrite federation behavior.

### Production data

No implementation phase should mutate existing production content during read-only route work. Write routes must preserve existing validation and publishing behavior unless a later task explicitly changes it.

## Implementation phases

1. **Foundation.** Add `/api/v1` router, public health/meta/openapi, shared auth wrapper, response helpers, error helpers, and OpenAPI components.
2. **Low-risk reads.** Add tags, media metadata, followers, and site-config read routes to prove adapters and OpenAPI conventions.
3. **Posts.** Add slug-based post list/create/get/update/delete/publish/unpublish routes with Slugkit serializers.
4. **Contacts and sources.** Add contacts over current people data, then sources with contact and account adapters.
5. **Accounts.** Add generic accounts abstraction over current person/source social account data; defer site-owned accounts if persistence is unresolved.
6. **Social and moderation.** Add following, engagement, comments, and standardized `501 NOT_IMPLEMENTED` responses for unsupported boosts or local comment creation.
7. **Compatibility verification.** Run Slugkit CLI checks locally and against deployment, then decide whether to deprecate or bridge legacy `/api`.

## Phase dependencies

- Posts depend on foundation helpers and OpenAPI conventions.
- Contacts should land before source adapters that expose `contactIds` and embedded `contacts`.
- Accounts design should land before fully normalizing source feed/social data.
- Engagement and comments depend on stable post slug lookup behavior.
- Following/followers depend on preserving current ActivityPub state transitions.
- Legacy API deprecation depends on verified Slugkit CLI coverage and human approval.

## Verification expectations for later implementation

Each implementation task should verify:

- Existing `/api` tests and CLI behavior still pass.
- New `/api/v1/openapi.json` includes expected paths and operation IDs.
- Protected `/api/v1` routes reject missing/invalid tokens with Slugkit error shape.
- Success responses use `{ data: ... }` and camelCase fields.
- Unsupported operations return standardized `501 NOT_IMPLEMENTED` where specified.

Before considering the conversion complete, run:

- `slug doctor` against local development.
- `slug doctor` against deployed staging or production target when safe.
- Representative Slugkit CLI commands for posts, tags, media, sources, contacts, following, comments/moderation, and site config.
- Existing `ec` CLI smoke tests against `/api` until the CLI is retired.
