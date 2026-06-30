# 04: Comments

## Purpose

Expose Slugkit-compatible comments and moderation routes over current ActivityPub comment data while avoiding product decisions about local comment creation until they are explicit.

## Routes

| Method | Path                            | Auth   | Operation ID            |
| ------ | ------------------------------- | ------ | ----------------------- |
| `GET`  | `/api/v1/posts/{slug}/comments` | Bearer | `posts.comments.list`   |
| `POST` | `/api/v1/posts/{slug}/comments` | Bearer | `posts.comments.create` |
| `GET`  | `/api/v1/comments`              | Bearer | `comments.list`         |
| `POST` | `/api/v1/comments/{id}/approve` | Bearer | `comments.approve`      |
| `POST` | `/api/v1/comments/{id}/hide`    | Bearer | `comments.hide`         |

## List filters

`GET /comments` should support:

- `status`
- `postSlug`
- `author`
- `receivedFrom`
- `receivedTo`
- `limit`
- `offset`

`GET /posts/{slug}/comments` is a post-scoped convenience route and should use the same serializer as `GET /comments`.

## Comment shape

```json
{
  "data": {
    "id": 1,
    "postId": 1,
    "postSlug": "example-post",
    "author": {
      "profileUrl": "https://example.social/@reader",
      "displayName": "Reader",
      "handle": "@reader@example.social"
    },
    "contentHtml": "<p>Hello</p>",
    "contentText": "Hello",
    "status": "pending",
    "activityUrl": "https://example.social/activity/1",
    "objectUrl": "https://example.social/comment/1",
    "inReplyToUrl": null,
    "publishedAt": "2026-06-30T00:00:00.000Z",
    "receivedAt": "2026-06-30T00:00:00.000Z",
    "moderatedAt": null
  }
}
```

Map current fields:

- `post_id` → `postId`
- `activity_uri` → `activityUrl`
- `object_uri` → `objectUrl`
- `actor_uri`/`actor_url` → `author.profileUrl`
- `actor_name` → `author.displayName`
- `content_html` → `contentHtml`
- `content_text` → `contentText`
- `moderation_status` → `status`
- `published_at` → `publishedAt`
- `received_at` → `receivedAt`
- `moderated_at` → `moderatedAt`

## Create behavior

If local/site-authored comment creation is not supported, `POST /posts/{slug}/comments` should return `501 NOT_IMPLEMENTED` with operation `posts.comments.create`. Do not silently create ActivityPub objects until federation semantics are designed.

## Moderation behavior

`approve` and `hide` should call existing moderation behavior and return the serialized comment. Preserve existing ActivityPub side effects, if any. The legacy pending-only route `/api/comments/pending` stays available but is not part of the Slugkit OpenAPI document.

## Compatibility risks

- Current comments are remote ActivityPub comments, not necessarily local comments.
- Local comment creation may require spam, moderation, identity, and federation design beyond API shape.
- Moderation status values should be normalized carefully so existing admin UI behavior does not change.
