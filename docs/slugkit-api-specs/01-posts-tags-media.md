# 01: Posts, tags, and media

## Purpose

Define the primary content routes for Slugkit compatibility while preserving existing legacy `/api/posts`, `/api/tags`, and `/api/media` behavior.

## Posts routes

| Method   | Path                             | Auth   | Operation ID      |
| -------- | -------------------------------- | ------ | ----------------- |
| `GET`    | `/api/v1/posts`                  | Bearer | `posts.list`      |
| `POST`   | `/api/v1/posts`                  | Bearer | `posts.create`    |
| `GET`    | `/api/v1/posts/{slug}`           | Bearer | `posts.get`       |
| `PUT`    | `/api/v1/posts/{slug}`           | Bearer | `posts.update`    |
| `DELETE` | `/api/v1/posts/{slug}`           | Bearer | `posts.delete`    |
| `POST`   | `/api/v1/posts/{slug}/publish`   | Bearer | `posts.publish`   |
| `POST`   | `/api/v1/posts/{slug}/unpublish` | Bearer | `posts.unpublish` |

### Query support

`GET /posts` should support current practical filters and Slugkit-compatible names:

- `type`
- `status`
- `tag`
- `limit`
- `offset`

### Request shape

Use Slugkit camelCase fields at the API boundary:

```json
{
  "title": "Example",
  "slug": "example",
  "type": "article",
  "content": "Markdown or HTML content",
  "summary": null,
  "sourceId": null,
  "creditContactIds": [],
  "tagSlugs": ["example"],
  "bannerImageId": null,
  "isFeatured": false
}
```

Map `sourceId`, `creditContactIds`, `tagSlugs`, and `bannerImageId` to existing service inputs without renaming database columns in the first implementation pass.

### Response shape

```json
{
  "data": {
    "id": 1,
    "slug": "example",
    "type": "article",
    "title": "Example",
    "sourceId": null,
    "creditContactIds": [],
    "creditedContacts": [],
    "tags": [{ "id": 1, "name": "Example", "slug": "example" }],
    "publishedAt": null,
    "createdAt": "2026-06-30T00:00:00.000Z",
    "updatedAt": "2026-06-30T00:00:00.000Z"
  }
}
```

`DELETE /posts/{slug}` returns `204` with no body.

## Tags route

| Method | Path           | Auth   | Operation ID |
| ------ | -------------- | ------ | ------------ |
| `GET`  | `/api/v1/tags` | Bearer | `tags.list`  |

Response:

```json
{
  "data": [{ "id": 1, "name": "Example", "slug": "example", "count": 3 }]
}
```

## Media routes

| Method   | Path                 | Auth   | Operation ID   |
| -------- | -------------------- | ------ | -------------- |
| `POST`   | `/api/v1/media`      | Bearer | `media.upload` |
| `GET`    | `/api/v1/media/{id}` | Bearer | `media.get`    |
| `DELETE` | `/api/v1/media/{id}` | Bearer | `media.delete` |

Upload remains multipart form data. Convert current response fields to Slugkit names:

- `mime_type` → `mimeType`
- `s3_key` → `key`
- `alt_text` → `altText`
- `created_at` → `createdAt`

Media errors must use standard codes: `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, and `VALIDATION_ERROR`.

## Compatibility risks

- Posts are high risk because current legacy routes are ID-first while Slugkit routes are slug-first.
- Tag slugs may not be identical to current tag names; normalize through one helper.
- Media upload behavior should preserve existing storage and validation safeguards.
- The `ec` CLI must continue to use legacy `/api/posts/*` and `/api/media/*` until migrated.
