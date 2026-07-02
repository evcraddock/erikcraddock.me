# 03: Followers, following, and engagement

## Purpose

Expose Slugkit social and engagement routes while preserving current ActivityPub state transitions and moderation behavior.

## Followers route

| Method | Path                | Auth   | Operation ID     |
| ------ | ------------------- | ------ | ---------------- |
| `GET`  | `/api/v1/followers` | Bearer | `followers.list` |

Response fields:

```json
{
  "data": [
    {
      "id": 1,
      "profileUrl": "https://example.social/@reader",
      "displayName": "Reader",
      "handle": "@reader@example.social",
      "inboxUrl": "https://example.social/inbox",
      "followedAt": "2026-06-30T00:00:00.000Z"
    }
  ]
}
```

Only expose fields needed by Slugkit. Avoid leaking raw ActivityPub internals unless the Slugkit contract requires them.

## Following routes

| Method | Path                              | Auth   | Operation ID         |
| ------ | --------------------------------- | ------ | -------------------- |
| `GET`  | `/api/v1/following`               | Bearer | `following.list`     |
| `POST` | `/api/v1/following`               | Bearer | `following.create`   |
| `POST` | `/api/v1/following/{id}/unfollow` | Bearer | `following.unfollow` |

Create request:

```json
{ "target": "@person@example.social" }
```

Map current legacy `{ handle }` behavior to Slugkit `{ target }` only in `/api/v1`. Keep legacy `/api/following` unchanged.

Response fields:

- `id`
- `contactId`
- `profileUrl`
- `displayName`
- `inboxUrl`
- `avatarUrl`
- `status`
- `lastError`
- `followedAt`
- `acceptedAt`
- `rejectedAt`
- `unfollowedAt`

The Slugkit unfollow route should handle both accepted unfollow and pending cancel. The legacy `/api/following/cancel` and `/api/following/resolve` helpers remain legacy-only.

## Engagement routes

| Method | Path                              | Auth   | Operation ID           |
| ------ | --------------------------------- | ------ | ---------------------- |
| `GET`  | `/api/v1/posts/{slug}/engagement` | Bearer | `posts.engagement.get` |
| `GET`  | `/api/v1/posts/{slug}/likes`      | Bearer | `posts.likes.list`     |
| `GET`  | `/api/v1/posts/{slug}/boosts`     | Bearer | `posts.boosts.list`    |

Engagement summary response:

```json
{
  "data": {
    "likes": 0,
    "boosts": 0,
    "comments": 0
  }
}
```

Likes response fields:

- `id`
- `profileUrl`
- `displayName`
- `handle`
- `activityUrl`
- `objectUrl`
- `receivedAt`

If boosts are not tracked, `GET /posts/{slug}/boosts` should return a standardized `501 NOT_IMPLEMENTED` response until boost persistence exists.

## OpenAPI requirements

The current following routes are registered in a way that may not appear in OpenAPI. All `/api/v1` social and engagement routes must be registered through OpenAPI-aware helpers with explicit operation IDs.

## Compatibility risks

- Following state changes produce external ActivityPub side effects. Keep request handling aligned with existing legacy service behavior.
- Follower data may include remote actor details that should not be exposed blindly.
- Engagement queries depend on stable post slug lookup and may need efficient count helpers before production use.
