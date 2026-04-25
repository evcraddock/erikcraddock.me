# erikcraddock.me

A personal website that can be followed from Mastodon.

## What It Does

- Publish articles, linkblogs, and notes
- People follow `@erik@erikcraddock.me` from Mastodon
- When I post, it shows up in their feeds

## Tech Stack

- **Hono** - Web framework
- **Fedify** - ActivityPub
- **Drizzle + SQLite** - Database
- **Hono JSX** - Templates
- **Tailwind** - Styles

## Project Structure

```
src/
├── db/
│   └── schema.ts       # Tables
├── federation/
│   └── setup.ts        # Fedify config
├── auth/
│   ├── magic-link.ts   # Email login
│   ├── passkey.ts      # WebAuthn
│   └── api-key.ts      # API key validation
├── routes/
│   ├── pages.tsx       # Public pages
│   ├── admin.tsx       # Admin UI
│   ├── api.ts          # Post API
│   └── feed.ts         # RSS
├── templates/
│   └── *.tsx           # Page templates
└── index.ts            # Entry point
```

## Database

```
posts
  id, type, title, content, excerpt, url, source_id, published_at, created_at, updated_at

tags
  id, name, slug

post_tags
  post_id, tag_id

sources (link attribution)
  id, name, url, feed_url

people (public attribution identities)
  id, name, url

source_authors (source bylines)
  id, source_id, person_id, sort_order

followers
  id, actor_uri, inbox_uri, shared_inbox_uri, followed_at

actor_keys
  id, public_key, private_key, created_at

authors (allow list)
  id, email, created_at

passkeys
  id, author_id, credential_id, public_key, name, created_at, last_used_at

api_keys
  id, author_id, key_hash, name, created_at, last_used_at, revoked_at

magic_links
  id, email, token_hash, expires_at, used_at

sessions
  id, author_id, expires_at, created_at

media
  id, post_id, filename, mime_type, s3_key, alt_text, created_at
```

## Post Types

- **article** - Long-form with title
- **link** - Commentary on external URL
- **note** - Short text

## Routes

**Public pages:**

- `/` - Home
- `/posts/:id` - Post detail
- `/tags/:slug` - Posts by tag
- `/sources` - Blogroll
- `/about` - About page
- `/feed.xml` - RSS

**Admin UI (requires login):**

- `/admin` - Dashboard
- `/admin/posts` - Manage posts
- `/admin/posts/new` - Create post
- `/admin/posts/:id/edit` - Edit post
- `/admin/keys` - Manage API keys
- `/admin/authors` - Manage author allow list (admin only)

**Auth:**

- `/login` - Enter email, get magic link
- `/login/verify` - Magic link callback
- `/login/passkey` - Passkey login
- `/logout` - End session

**API (requires API key):**

- `GET/POST /api/posts`
- `GET/PUT/DELETE /api/posts/:id`
- `POST /api/posts/:id/publish`

**ActivityPub (Fedify):**

- `/.well-known/webfinger`
- `/users/erik`
- `/users/erik/inbox`
- `/users/erik/outbox`
- `/users/erik/followers`

## Authentication

### Who Can Login

- **Admin** - Email address set in `ADMIN_EMAIL` env var
- **Authors** - Email addresses added to allow list by admin

### Login Flow

1. Go to `/login`, enter email
2. If email is admin or in authors allow list, send magic link (invalid emails silently ignored)
3. Click link, session created
4. First time: prompted to register passkey
5. Next time: can login with passkey directly (no email needed)

### API Keys

- Admin and authors can create API keys in `/admin/keys`
- Use with `Authorization: Bearer <key>` header
- Can have multiple (one per device/tool)
- Can revoke
- Only way to access `/api/*` endpoints

### Admin vs Author

- **Admin** - Can add/remove authors from allow list
- **Author** - Can manage posts, create own API keys

## Federation

1. Someone searches `@erik@erikcraddock.me` on Mastodon
2. Mastodon finds the actor via webfinger
3. They click Follow, inbox receives Follow activity
4. Fedify saves follower, sends Accept
5. When I publish, Fedify delivers to all followers

## Environment Variables

```
DOMAIN=erikcraddock.me
ADMIN_EMAIL=erik@example.com
DATABASE_PATH=./data/site.db

# For magic links
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
FROM_EMAIL=noreply@erikcraddock.me

# For media storage (Garage/S3)
S3_ENDPOINT=https://s3.example.com
S3_BUCKET=erikcraddock-media
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

## Deployment

Docker container in k3s cluster, SQLite volume, Traefik for HTTPS.
