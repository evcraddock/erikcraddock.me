# 05: Implementation phases and verification

## Reviewable follow-on phases

### Phase 1: `/api/v1` foundation

Deliverables:

- New `/api/v1` router mounted beside `/api`.
- Public health, meta, and OpenAPI routes.
- Shared auth, response, error, and OpenAPI helper modules.
- Tests for public routes, protected auth failures, and OpenAPI operation IDs.

Dependencies: none.

### Phase 2: Low-risk read adapters

Deliverables:

- `GET /api/v1/tags`.
- `GET /api/v1/media/{id}` plus media serializer.
- `GET /api/v1/followers`.
- `GET /api/v1/site-config`.

Dependencies: Phase 1.

### Phase 3: Posts

Deliverables:

- Slug-based `/api/v1/posts` CRUD, publish, and unpublish routes.
- Post list filters and pagination metadata where supported.
- Post serializers for `sourceId`, `creditContactIds`, `creditedContacts`, tag objects, and camelCase timestamps.

Dependencies: Phase 1; tags serializer from Phase 2 is helpful.

### Phase 4: Contacts and sources

Deliverables:

- Contacts routes over current people data.
- Source routes exposing `contactIds`, embedded contacts, `imageUrl`, `faviconUrl`, and account summaries.

Dependencies: Phase 1; posts can consume contact serializers once available.

### Phase 5: Generic accounts

Deliverables:

- Generic account list/get routes over current person/source social accounts.
- Create/update/delete behavior only after ownership and persistence rules are clear.
- `501 NOT_IMPLEMENTED` for site-owned accounts if persistence is deferred.

Dependencies: Phase 4 for contact/source owner mapping.

### Phase 6: Social, engagement, and comments

Deliverables:

- Following routes with `{ target }` create request and `{id}/unfollow` path.
- Engagement summary, likes list, and boost not-implemented response if needed.
- Comments list, post comments list, approve, hide, and local-create not-implemented response if needed.

Dependencies: Phase 1; posts slug lookup from Phase 3; ActivityPub service stability.

### Phase 7: Compatibility decision

Deliverables:

- Slugkit CLI smoke-test report.
- `ec` CLI compatibility report.
- Recommendation to keep, redirect, or deprecate legacy `/api`.

Dependencies: all route groups required by daily Slugkit CLI workflows.

## Cross-phase acceptance checks

Every implementation phase should confirm:

- No legacy `/api` route behavior changed unless explicitly in scope.
- New `/api/v1` routes use shared success and error helpers.
- OpenAPI includes every route with the required operation ID.
- Auth failures use Slugkit error shape.
- JSON fields in `/api/v1` are camelCase.
- Delete routes specified as `204` return no body.
- Unsupported operations return standardized `501 NOT_IMPLEMENTED`.

## Risk checklist

Before opening each implementation PR, document whether the phase touches:

- `ec` CLI assumptions.
- Deployment base paths, CORS, or reverse proxy behavior.
- Database schema or migrations.
- ActivityPub follow/unfollow, federation, or moderation side effects.
- Existing production content, media, followers, following records, or comments.

If a phase touches production data or external ActivityPub side effects, include a rollback or mitigation note in the PR description.

## Verification matrix

| Area                 | Verification                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Foundation           | `GET /api/v1/health`, `GET /api/v1/meta`, and `GET /api/v1/openapi.json` work without auth.                              |
| Auth                 | Missing and invalid bearer tokens return `401` with Slugkit error shape.                                                 |
| OpenAPI              | Operation IDs match the route specs and no `/api` server URL leaks into `/api/v1/openapi.json`.                          |
| Posts                | Slugkit CLI can list, create, read by slug, update, publish, unpublish, and delete test posts.                           |
| Tags                 | Slugkit CLI can list tags with counts.                                                                                   |
| Media                | Slugkit CLI can upload, fetch metadata, and delete test media.                                                           |
| Contacts             | Slugkit CLI can list/create/update contacts and see embedded accounts.                                                   |
| Sources              | Slugkit CLI can list/create/update/delete sources with contact IDs.                                                      |
| Accounts             | Slugkit CLI can list accounts by owner and perform supported write operations.                                           |
| Followers/following  | Slugkit CLI can list followers/following and initiate/cancel/unfollow using existing ActivityPub behavior.               |
| Engagement           | Slugkit CLI can read engagement and likes; boosts return `501` if not implemented.                                       |
| Comments             | Slugkit CLI can list/filter comments and approve/hide pending comments; local creation returns `501` if not implemented. |
| Legacy compatibility | Existing `ec` CLI smoke tests still pass against `/api`.                                                                 |

## Final conversion gate

The conversion should not be considered complete until:

1. `slug doctor` passes against local development.
2. `slug doctor` passes against the deployed target when safe.
3. Representative Slugkit CLI commands pass for all supported route groups.
4. Existing `/api` behavior is either verified unchanged or intentionally deprecated with human approval.
5. Production data and ActivityPub behavior have been checked for unintended changes.
