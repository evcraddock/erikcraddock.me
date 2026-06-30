# 00: Foundation, health, meta, and site config

## Purpose

Establish the `/api/v1` foundation used by every later route group: router mounting, OpenAPI generation, public diagnostics, shared auth, shared response helpers, and site configuration conventions.

## Routes

| Method  | Path                   | Auth   | Operation ID        | Response                                    |
| ------- | ---------------------- | ------ | ------------------- | ------------------------------------------- |
| `GET`   | `/api/v1/health`       | Public | `health.get`        | `{ data: Health }`                          |
| `GET`   | `/api/v1/meta`         | Public | `meta.get`          | `{ data: Meta }`                            |
| `GET`   | `/api/v1/openapi.json` | Public | `openapi.get`       | OpenAPI 3.1 document                        |
| `GET`   | `/api/v1/site-config`  | Bearer | `siteConfig.get`    | `{ data: SiteConfig }`                      |
| `PATCH` | `/api/v1/site-config`  | Bearer | `siteConfig.update` | `{ data: SiteConfig }` or `501` if deferred |

## Health shape

```json
{
  "data": {
    "status": "ok",
    "service": "slugkit-api",
    "version": "0.0.0",
    "time": "2026-06-30T00:00:00.000Z"
  }
}
```

Keep the existing public `/health` route unchanged.

## Meta shape

```json
{
  "data": {
    "site": {
      "name": "Erik Craddock",
      "url": "https://erikcraddock.me"
    },
    "api": {
      "name": "slugkit-api",
      "version": "v1",
      "basePath": "/api/v1"
    },
    "software": {
      "name": "erikcraddock.me",
      "version": "0.0.0"
    }
  }
}
```

Read package metadata where safe; otherwise use existing configured application/version values.

## Site config shape

```json
{
  "data": {
    "core": {
      "name": "Erik Craddock",
      "url": "https://erikcraddock.me",
      "tagline": null,
      "description": null,
      "homepage": {
        "intro": null,
        "body": null
      }
    },
    "custom": {}
  }
}
```

Start with read support if the current site configuration is environment-driven. Return `501 NOT_IMPLEMENTED` for `PATCH /site-config` until a durable persistence model is chosen.

## OpenAPI requirements

- Generate a `/api/v1`-scoped OpenAPI 3.1 document.
- Do not reuse the legacy `/api/openapi.json` server URL or operation set.
- Include shared schemas for `ErrorResponse`, `NotImplementedResponse`, `ValidationError`, success envelopes, and route resources.
- Include bearer auth security requirements on protected routes only.

## Compatibility notes

- Existing `/api/openapi.json` and `/api/docs` stay in place.
- Existing `/health` stays in place.
- No database migration should be needed for this group unless writeable site config is implemented.
