# Slugkit API conversion research

## Purpose

This document audits the current `erikcraddock.me` API against the Slugkit API contract and recommends a safe conversion plan. It is research only: no functional API migration changes were made for this task.

Sources reviewed:

- Slugkit `docs/api-design.md`
- Slugkit route specs in `docs/specs/00-openapi-foundation-health.md` through `docs/specs/11-comments-routes.md`
- Slugkit `docs/reference-site-findings.md`
- Current `erikcraddock.me` `src/routes/api.tsx`, `src/routes/health.ts`, `src/index.tsx`, tests, services, and schema references

## Current API summary

The current API is mounted at `/api`, not `/api/v1`:

```ts
app.route("/api", api);
```

The current OpenAPI document is served at `/api/openapi.json`, and Swagger UI is served at `/api/docs`. Most managed routes are protected with bearer API-key auth by mounting `protectedApi` under `/` inside the API router.

Current documented/protected route surface:

| Current route                              | Notes                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `GET /api/openapi.json`                    | Public OpenAPI document; server URL is `/api`.                                                    |
| `GET /api/docs`                            | Public Swagger UI.                                                                                |
| `GET /api/ping`                            | Protected auth check.                                                                             |
| `GET /api/posts`                           | Protected list route.                                                                             |
| `POST /api/posts`                          | Protected create route.                                                                           |
| `GET /api/posts/{id}`                      | Protected ID route; Slugkit uses slug route.                                                      |
| `PUT /api/posts/{id}`                      | Protected ID route; Slugkit uses slug route.                                                      |
| `DELETE /api/posts/{id}`                   | Protected ID route; Slugkit uses slug route.                                                      |
| `POST /api/posts/{id}/publish`             | Protected ID route; Slugkit uses slug route.                                                      |
| `POST /api/posts/{id}/unpublish`           | Protected ID route; Slugkit uses slug route.                                                      |
| `GET /api/posts/by-slug/{slug}`            | Protected slug route with non-Slugkit path.                                                       |
| `GET /api/posts/by-slug/{slug}/likes`      | Protected likes route with non-Slugkit path.                                                      |
| `PUT /api/posts/by-slug/{slug}`            | Protected slug route with non-Slugkit path.                                                       |
| `DELETE /api/posts/by-slug/{slug}`         | Protected slug route with non-Slugkit path.                                                       |
| `POST /api/posts/by-slug/{slug}/publish`   | Protected slug route with non-Slugkit path.                                                       |
| `POST /api/posts/by-slug/{slug}/unpublish` | Protected slug route with non-Slugkit path.                                                       |
| `GET /api/people`                          | Protected; maps conceptually to Slugkit contacts.                                                 |
| `GET /api/people/{id}`                     | Protected; maps conceptually to Slugkit contacts.                                                 |
| `POST /api/people`                         | Protected; maps conceptually to Slugkit contacts.                                                 |
| `PUT /api/people/{id}`                     | Protected; maps conceptually to Slugkit contacts.                                                 |
| `GET /api/sources`                         | Protected.                                                                                        |
| `GET /api/sources/{id}`                    | Protected.                                                                                        |
| `POST /api/sources`                        | Protected.                                                                                        |
| `PUT /api/sources/{id}`                    | Protected.                                                                                        |
| `DELETE /api/sources/{id}`                 | Protected.                                                                                        |
| `GET /api/tags`                            | Protected.                                                                                        |
| `POST /api/media`                          | Protected multipart upload.                                                                       |
| `GET /api/media/{id}`                      | Protected metadata route.                                                                         |
| `DELETE /api/media/{id}`                   | Protected deletion route.                                                                         |
| `POST /api/federation/update-actor`        | Protected site-specific ActivityPub operation.                                                    |
| `POST /api/federation/delete`              | Protected site-specific ActivityPub operation.                                                    |
| `GET /api/comments/pending`                | Protected pending-only comments route; Slugkit replaces this with `GET /comments?status=pending`. |
| `POST /api/comments/{id}/approve`          | Protected.                                                                                        |
| `POST /api/comments/{id}/hide`             | Protected.                                                                                        |
| `GET /api/following`                       | Protected but not in OpenAPI because it is registered with plain Hono rather than `openapi`.      |
| `POST /api/following/resolve`              | Protected site-specific helper.                                                                   |
| `POST /api/following/unfollow`             | Protected; Slugkit uses `/following/{id}/unfollow`.                                               |
| `POST /api/following/cancel`               | Protected site-specific helper; Slugkit combines cancel/unfollow.                                 |
| `POST /api/following`                      | Protected; request field differs from Slugkit.                                                    |

Current public health is `/health`, outside the API router, and returns `{ status, version, timestamp }`.

## Global contract gaps

| Area                | Current behavior                                                              | Slugkit contract                                                                          | Recommendation                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API base path       | `/api`                                                                        | `/api/v1`                                                                                 | Add a new Slugkit-compatible router mounted at `/api/v1`. Keep `/api` temporarily for the existing `ec` CLI until replacement or compatibility is confirmed. |
| OpenAPI path        | `/api/openapi.json`                                                           | `/api/v1/openapi.json`                                                                    | Generate an OpenAPI document for the `/api/v1` contract with Slugkit operation IDs. The legacy document can remain during transition.                        |
| Operation IDs       | Mostly absent in current route definitions.                                   | Required operation IDs like `posts.list`, `media.upload`, `comments.approve`.             | Add explicit operation IDs to all `/api/v1` OpenAPI routes.                                                                                                  |
| Error shape         | `{ "error": "message" }` string errors.                                       | `{ "error": { "code", "message", "fields?", "operation?" } }`.                            | Introduce shared Slugkit error helpers before converting individual routes.                                                                                  |
| Auth                | Bearer API key on protected routes; current ping returns authenticated email. | Bearer API key on protected routes; ping returns `{ status: "ok", authenticated: true }`. | Auth mechanism is compatible; response/error shape needs adaptation.                                                                                         |
| Unsupported routes  | Missing routes or site-specific helpers.                                      | Implement or return standardized `501 NOT_IMPLEMENTED`.                                   | Add route stubs for unsupported Slugkit operations when implementation is deferred.                                                                          |
| Naming convention   | Mostly snake_case JSON (`published_at`, `source_id`, `social_accounts`).      | camelCase JSON (`publishedAt`, `sourceId`, `accounts`).                                   | Add serializers/adapters for `/api/v1`; do not rename database columns or internal service types in the first pass.                                          |
| Resource vocabulary | `people`, `authors`, `social_accounts`, ActivityPub-specific helper routes.   | `contacts`, generic `accounts`, generic social/audience routes.                           | Keep internal names if desired, but expose Slugkit names at `/api/v1`.                                                                                       |

## Route-by-route audit

### Spec 00: OpenAPI foundation and health

Status: partially implemented, incompatible paths and shape.

Current:

- `GET /health` exists outside `/api`.
- Response has `status`, `version`, and `timestamp`.
- `GET /api/openapi.json` exists.
- OpenAPI currently describes `/api` routes and has no required Slugkit operation IDs.

Needed:

- `GET /api/v1/health` public route with `{ status, service: "slugkit-api", version, time }`.
- `GET /api/v1/openapi.json` public OpenAPI 3.1 document.
- Operation IDs `health.get` and `openapi.get`.
- Shared OpenAPI schemas `ErrorResponse` and `NotImplementedResponse`.

Risk: low. This can be added without changing existing `/health` or `/api/openapi.json`.

### Spec 01: Meta route

Status: missing.

Needed:

- `GET /api/v1/meta` public route.
- Response with `site`, `api`, `software`, and ideally package metadata if the Slugkit CLI expects it.
- Operation ID `meta.get`.

Risk: low. This route is read-only and can be backed by existing site config/package metadata.

### Site configuration from API design

Status: missing.

Needed:

- `GET /api/v1/site-config` protected.
- `PATCH /api/v1/site-config` protected.
- `core` fields: `name`, `url`, `tagline`, `description`, `homepage.intro`, `homepage.body`.
- `custom` object for public runtime extension settings.

Recommendation: defer write support if the current site does not persist editable runtime config safely. It is acceptable to start with read support and return standardized `501 NOT_IMPLEMENTED` for update until a persistence model is chosen.

Risk: medium. Write support touches site configuration ownership and may conflict with environment/deployment configuration.

### Spec 02: Posts routes

Status: conceptually implemented, incompatible paths and JSON shapes.

Current:

- Current API supports list/create/get/update/delete/publish/unpublish posts.
- It supports articles, links, and notes.
- It has ID routes and `/posts/by-slug/{slug}` routes.
- Post JSON uses snake_case fields: `source_id`, `author_id`, `banner_image_id`, `is_featured`, `published_at`, `created_at`, `updated_at`.
- Tags are arrays of strings in post responses and create/update requests.
- Current attribution uses `author_id` and embedded `author` sourced from `people`.
- Create/update bodies use `tags`, not `tagSlugs`.
- `GET /posts` has `type`, `tag`, `limit`, and `status`; it does not expose Slugkit `offset` in the schema seen during audit.

Needed:

- `/api/v1/posts` list/create.
- `/api/v1/posts/{slug}` get/update/delete.
- `/api/v1/posts/{slug}/publish` and `/api/v1/posts/{slug}/unpublish`.
- Slugkit request fields: `sourceId`, `creditContactIds`, `tagSlugs`.
- Slugkit response fields: `sourceId`, `creditContactIds`, `creditedContacts`, `publishedAt`, `createdAt`, `updatedAt`, tag objects.
- `DELETE /posts/{slug}` returns `204` with no body.
- Operation IDs: `posts.list`, `posts.create`, `posts.get`, `posts.update`, `posts.delete`, `posts.publish`, `posts.unpublish`.

Recommendation:

- Add adapter serializers for Slugkit `Post` and `PostListItem` rather than changing internal post service return shapes.
- Treat existing `people` records as Slugkit contacts for `creditContactIds` and `creditedContacts`.
- Map `tagSlugs` to the existing tag creation/update path. If existing service expects tag names instead of slugs, normalize and document behavior before coding.
- Keep existing `/api/posts/*` routes until `ec` CLI retirement or migration.

Risk: high. This is the largest compatibility area because it affects primary content commands and attribution vocabulary.

### Spec 03: Tags route

Status: mostly implemented, missing path/version/operation ID verification.

Current:

- `GET /api/tags` exists and returns tag records with counts according to current schemas/tests.

Needed:

- `GET /api/v1/tags` protected.
- Operation ID `tags.list`.
- Response `{ data: [{ id, name, slug, count }] }`.
- Shared error shape for auth failures.

Risk: low.

### Spec 04: Contacts routes

Status: implemented under `people`, incompatible route names and account shape.

Current:

- `GET/POST /api/people`, `GET/PUT /api/people/{id}` exist.
- `Person` includes `social_accounts` and `default_social_account`.
- No `DELETE /people/{id}` route, which is fine because the Slugkit contacts spec does not require delete.

Needed:

- `GET/POST /api/v1/contacts`.
- `GET/PUT /api/v1/contacts/{id}`.
- Operation IDs: `contacts.list`, `contacts.create`, `contacts.get`, `contacts.update`.
- Expose `accounts` and `defaultAccount` using Slugkit account shape when embedded.
- Validate URLs with shared validation errors.

Recommendation: expose adapter routes named `contacts` while continuing to store data in the existing `people` tables and services.

Risk: medium. The terminology change is straightforward for the API, but downstream code and the legacy CLI may still use `people`.

### Spec 05: Sources routes

Status: partially implemented, incompatible fields.

Current:

- `GET/POST /api/sources`, `GET/PUT/DELETE /api/sources/{id}` exist.
- Current `Source` includes `feed_url`, preview fields, `favicon_url`, `authors`, and `social_accounts`.
- Current create schema requires `url`.
- Current source authors are embedded as `authors`; Slugkit uses `contacts` and `contactIds`.
- Current source accounts are embedded `social_accounts`; Slugkit manages accounts through `/accounts` and may embed account summaries.

Needed:

- `/api/v1/sources` routes with operation IDs `sources.list`, `sources.create`, `sources.get`, `sources.update`, `sources.delete`.
- Allow sources without URLs.
- Slugkit fields: `description`, `imageUrl`, `faviconUrl`, `contactIds`, `contacts`, `accounts`.
- Feed URLs should be represented as source-owned accounts, not `feedUrl` fields.
- Delete returns `204` with no body.

Recommendation:

- Convert current `authors` to Slugkit `contacts` in the API adapter.
- Represent `feed_url` and `social_accounts` through the future accounts adapter.
- Do not remove current source preview fields internally; map `preview_image_url` to `imageUrl` only if that is semantically correct, otherwise leave `imageUrl` null and document preview metadata as site-specific.

Risk: high. The source/contact/account model changed materially from the reference-site API.

### Spec 06: Accounts routes

Status: missing as a standalone generic API.

Current:

- Person and source social accounts exist as embedded nested data.
- Tables/services appear split by owner type: person social accounts and source social accounts.
- Account fields are snake_case and ActivityPub-specific in places: `avatar_url`, `is_activitypub`, `is_default`, `sort_order`.
- There is no generic site-level account API.

Needed:

- `GET/POST /api/v1/accounts`.
- `GET/PUT/DELETE /api/v1/accounts/{id}`.
- Owner types `contact`, `source`, `site`.
- Fields `ownerType`, `ownerId`, `label`, `url`, `avatarUrl`, `kind`, `protocol`, `isDefault`, `sortOrder`.
- Filter by `ownerType` and `ownerId`.

Recommendation:

- Create a compatibility abstraction over existing person/source social account tables for read/list first.
- Decide whether to unify persistence or maintain adapters over existing split tables.
- Treat `is_activitypub` as `protocol: "activitypub"`; infer `kind: "social"` for social accounts and `kind: "feed"`/`protocol: "rss"` for feeds.
- Implement site-level accounts only after deciding where site-owned links live.

Risk: high. This likely needs its own implementation task because it crosses people/contacts, sources, and site configuration.

### Spec 07: Media routes

Status: mostly implemented, incompatible field names and error shape.

Current:

- `POST /api/media`, `GET /api/media/{id}`, and `DELETE /api/media/{id}` exist.
- Media response uses `mime_type`, `s3_key`, `alt_text`, `created_at`.
- Upload uses multipart form data and allowed MIME checks.

Needed:

- `/api/v1/media` routes with operation IDs `media.upload`, `media.get`, `media.delete`.
- Response fields `mimeType`, `key`, `altText`, `createdAt`.
- Error codes `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, and `VALIDATION_ERROR` in the shared error shape.
- Delete returns `204` with no body.

Risk: medium. Serialization is straightforward, but upload error behavior must be standardized.

### Spec 08: Followers route

Status: data exists; API route missing.

Current:

- Admin follower UI exists.
- ActivityPub followers table/service exists.
- No `GET /api/followers` route was found in the current API router.

Needed:

- `GET /api/v1/followers` protected.
- Operation ID `followers.list`.
- Response fields `profileUrl`, `displayName`, `handle`, `inboxUrl`, `followedAt`.
- If unsupported in a different environment, return standardized `501 NOT_IMPLEMENTED`; for this site, implementation should be possible.

Risk: medium. Data mapping should be simple, but the route must avoid leaking unnecessary ActivityPub internals.

### Spec 09: Following routes

Status: partially implemented, incompatible paths, request fields, response fields, and OpenAPI coverage.

Current:

- `GET /api/following` exists but is registered as a plain Hono route, so it is likely absent from OpenAPI.
- `POST /api/following` creates/retries a remote follow with request `{ handle }`.
- `POST /api/following/unfollow` and `POST /api/following/cancel` use body `{ id }`.
- `POST /api/following/resolve` is a helper not in the Slugkit contract.
- Response fields use snake_case: `person_id`, `actor_uri`, `profile_url`, `display_name`, `followed_at`, etc.

Needed:

- `GET /api/v1/following` with operation ID `following.list`.
- `POST /api/v1/following` with request `{ target }` and response status `201`.
- `POST /api/v1/following/{id}/unfollow` for both accepted unfollow and pending cancel.
- Response fields `contactId`, `profileUrl`, `displayName`, `inboxUrl`, `avatarUrl`, `lastError`, `followedAt`, `acceptedAt`, `rejectedAt`, `unfollowedAt`.
- OpenAPI coverage.

Recommendation: keep `resolve` as a legacy/site-specific route, but do not include it in the Slugkit OpenAPI contract unless explicitly added later.

Risk: medium.

### Spec 10: Engagement routes

Status: likes partially implemented; engagement summary and boosts missing.

Current:

- `GET /api/posts/by-slug/{slug}/likes` exists.
- Current like fields are ActivityPub-specific snake_case: `actor_uri`, `actor_name`, `activity_uri`, `object_uri`, `received_at`.
- No Slugkit `GET /posts/{slug}/engagement` route was found.
- No boosts route was found.

Needed:

- `GET /api/v1/posts/{slug}/engagement` with `posts.engagement.get`.
- `GET /api/v1/posts/{slug}/likes` with `posts.likes.list`.
- `GET /api/v1/posts/{slug}/boosts` with `posts.boosts.list`, or standardized `501 NOT_IMPLEMENTED` if boosts are not tracked.
- CamelCase actor fields: `profileUrl`, `displayName`, `handle`, `activityUrl`, `objectUrl`, `receivedAt`.

Risk: medium. Likes can be adapted; summary and boosts need either new queries or explicit not-implemented behavior.

### Spec 11: Comments routes

Status: moderation partially implemented; route model changed.

Current:

- `GET /api/comments/pending` exists.
- `POST /api/comments/{id}/approve` and `/hide` exist.
- Current comments are remote ActivityPub comments with fields like `post_id`, `activity_uri`, `object_uri`, `actor_uri`, `actor_name`, `actor_url`, `content_html`, `content_text`, `in_reply_to_uri`, `moderation_status`, `published_at`, `received_at`, `moderated_at`.
- No `GET /api/posts/{slug}/comments` route was found.
- No `POST /api/posts/{slug}/comments` route was found.
- No generic `GET /api/comments` route with filters was found.

Needed:

- `GET /api/v1/posts/{slug}/comments` with `posts.comments.list`.
- `POST /api/v1/posts/{slug}/comments` with `posts.comments.create`, or `501 NOT_IMPLEMENTED` if local/site-authored comments are not supported yet.
- `GET /api/v1/comments` with filters including `status`, `postSlug`, `author`, `receivedFrom`, and `receivedTo`.
- Keep approve/hide routes but use Slugkit response fields and operation IDs `comments.approve` and `comments.hide`.
- Remove or stop documenting the old pending-only endpoint in the Slugkit OpenAPI document.

Risk: medium-high. Moderation adapters are straightforward; local comment creation may require product decisions and federation behavior.

## Recommended implementation sequence

1. **Add API v1 foundation without breaking legacy API.** Mount a new `/api/v1` router alongside `/api`. Add `health`, `meta`, `openapi.json`, shared error helpers, shared envelope helpers, and operation IDs. Keep `/api` for the existing `ec` CLI during migration.
2. **Convert low-risk read-only routes.** Add `/api/v1/tags`, `/api/v1/media/{id}`, `/api/v1/followers`, and possibly `/api/v1/site-config` read support. These validate serializer/error/OpenAPI patterns before touching write-heavy content routes.
3. **Convert posts through adapter serializers.** Implement `/api/v1/posts` slug-based routes and map existing post services to Slugkit camelCase shapes. This unlocks most `slug` CLI content workflows.
4. **Convert contacts and sources together.** Add `/api/v1/contacts` over existing people services, then adapt sources to use contacts/contact IDs in API shape while preserving current source internals.
5. **Introduce generic accounts.** Build a generic `/api/v1/accounts` adapter over existing person/source social account persistence and decide where site-level accounts should live.
6. **Convert social/audience routes.** Add Slugkit-compatible following, engagement, and comments routes. Return standardized `501 NOT_IMPLEMENTED` for unsupported boosts or local comment creation until implemented.
7. **Run compatibility verification.** Configure the Slugkit CLI against local or deployed `erikcraddock.me`, run `slug doctor`, then test representative post, media, tag, source, contact, following, and comment moderation commands as those commands become available.
8. **Deprecate or bridge the legacy API.** After the Slugkit-compatible surface is stable and the `ec` CLI is retired or adapted, decide whether `/api` should remain, redirect, or be removed.

## Follow-on task candidates

- Add `/api/v1` foundation, meta, health, OpenAPI, and shared error helpers to `erikcraddock.me`.
- Add Slugkit-compatible posts routes over the current post service.
- Add contacts routes over current people data.
- Add source route adapters using Slugkit source/contact/account terminology.
- Design and implement generic accounts over current person/source social account data.
- Add followers/following Slugkit API adapters and OpenAPI coverage.
- Add engagement and comments Slugkit API adapters, including `501 NOT_IMPLEMENTED` for unsupported boosts/local comments.
- Update or replace the legacy `ec` CLI with `slug` compatibility once `/api/v1` is ready.

## Key migration risks

- **Breaking the existing `ec` CLI.** Keep `/api` stable until `slug` fully replaces it or a compatibility layer is intentionally shipped.
- **Attribution terminology drift.** Current `people/authors` model maps to Slugkit `contacts/creditedContacts`, but this should remain an API adapter at first.
- **Source model differences.** Current source `feed_url`, preview fields, authors, and social accounts do not map one-to-one to Slugkit `contacts` and generic `accounts`.
- **Generic account persistence.** Slugkit wants one API model for contact/source/site accounts; current persistence is split and may need a compatibility abstraction or schema migration.
- **Error-shape churn.** Standardizing errors will affect tests and CLI behavior. Do this through helpers to avoid inconsistent conversions.
- **OpenAPI generation.** Plain Hono routes currently used for following do not appear in OpenAPI. Slugkit-compatible routes should be registered through OpenAPI route helpers.
- **Deployment/API base URL.** Existing public clients may use `/api`; adding `/api/v1` is safer than moving the existing router.

## Definition of done for a future coding migration

A future implementation should be considered complete only when:

- `GET /api/v1/meta`, `/health`, and `/openapi.json` work publicly.
- Protected `/api/v1` routes require `Authorization: Bearer <api-key>`.
- Slugkit route names, JSON fields, response envelopes, operation IDs, and errors match the specs.
- Unsupported optional/social features return standardized `501 NOT_IMPLEMENTED` instead of missing routes or legacy errors.
- Existing public website behavior and legacy `/api` behavior are preserved unless intentionally deprecated.
- `slug doctor` succeeds against the deployed site.
- Representative Slugkit CLI commands work for posts, tags, media, sources, contacts, following, and comment moderation as each route group is implemented.
