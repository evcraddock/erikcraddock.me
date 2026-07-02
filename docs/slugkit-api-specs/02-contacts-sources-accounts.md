# 02: Contacts, sources, and accounts

## Purpose

Expose Slugkit contact/source/account terminology over the current `people`, source, and social-account data model without forcing an early persistence migration.

## Contacts routes

| Method | Path                    | Auth   | Operation ID      |
| ------ | ----------------------- | ------ | ----------------- |
| `GET`  | `/api/v1/contacts`      | Bearer | `contacts.list`   |
| `POST` | `/api/v1/contacts`      | Bearer | `contacts.create` |
| `GET`  | `/api/v1/contacts/{id}` | Bearer | `contacts.get`    |
| `PUT`  | `/api/v1/contacts/{id}` | Bearer | `contacts.update` |

Map existing people records to contacts. Embedded `social_accounts` become `accounts`; `default_social_account` becomes `defaultAccount`.

Example response:

```json
{
  "data": {
    "id": 1,
    "name": "Example Person",
    "url": "https://example.com",
    "accounts": [],
    "defaultAccount": null,
    "createdAt": "2026-06-30T00:00:00.000Z",
    "updatedAt": "2026-06-30T00:00:00.000Z"
  }
}
```

## Sources routes

| Method   | Path                   | Auth   | Operation ID     |
| -------- | ---------------------- | ------ | ---------------- |
| `GET`    | `/api/v1/sources`      | Bearer | `sources.list`   |
| `POST`   | `/api/v1/sources`      | Bearer | `sources.create` |
| `GET`    | `/api/v1/sources/{id}` | Bearer | `sources.get`    |
| `PUT`    | `/api/v1/sources/{id}` | Bearer | `sources.update` |
| `DELETE` | `/api/v1/sources/{id}` | Bearer | `sources.delete` |

Expose current source authors as Slugkit `contacts` and source author IDs as `contactIds`.

Slugkit fields:

- `name`
- `url`
- `description`
- `imageUrl`
- `faviconUrl`
- `contactIds`
- `contacts`
- `accounts`

Implementation note: current feed URLs and source social accounts should be represented through the accounts adapter rather than adding Slugkit-only source fields.

`DELETE /sources/{id}` returns `204` with no body.

## Accounts routes

| Method   | Path                    | Auth   | Operation ID      |
| -------- | ----------------------- | ------ | ----------------- |
| `GET`    | `/api/v1/accounts`      | Bearer | `accounts.list`   |
| `POST`   | `/api/v1/accounts`      | Bearer | `accounts.create` |
| `GET`    | `/api/v1/accounts/{id}` | Bearer | `accounts.get`    |
| `PUT`    | `/api/v1/accounts/{id}` | Bearer | `accounts.update` |
| `DELETE` | `/api/v1/accounts/{id}` | Bearer | `accounts.delete` |

Required filters:

- `ownerType=contact|source|site`
- `ownerId=<id>`

Account shape:

```json
{
  "data": {
    "id": 1,
    "ownerType": "contact",
    "ownerId": 1,
    "label": "Mastodon",
    "url": "https://example.social/@person",
    "avatarUrl": null,
    "kind": "social",
    "protocol": "activitypub",
    "isDefault": false,
    "sortOrder": 0,
    "createdAt": "2026-06-30T00:00:00.000Z",
    "updatedAt": "2026-06-30T00:00:00.000Z"
  }
}
```

## Persistence strategy

Start with an adapter over existing split social-account persistence:

- contact-owned accounts map to current person social accounts,
- source-owned accounts map to current source social accounts and feed URL where semantically safe,
- site-owned accounts may return `501 NOT_IMPLEMENTED` or an empty list until persistence is decided.

Do not unify account tables in the first API adapter task unless a later task explicitly includes the schema migration.

## Compatibility risks

- Contacts replace the public API term `people`, but internal people tables and services can remain.
- Sources are high risk because Slugkit treats feeds and social URLs as accounts while the current app stores feed-specific fields.
- Generic account writes could cross current ownership boundaries; consider implementing read/list before create/update/delete.
