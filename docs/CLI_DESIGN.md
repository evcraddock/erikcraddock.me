# CLI Design: `ec`

Command-line interface for managing content on erikcraddock.me.

## Overview

```
ec <resource> <action> [args] [flags]
```

**Stack:** TypeScript/Bun  
**Location:** erikcraddock.me repo (likely `cli/` directory)

## Global Flags

Available on all commands:

```bash
--verbose          # debug output
--dry-run          # preview without executing
--api-url <url>    # override API URL for this command
--api-key <key>    # override API key for this command
--json             # JSON output (where applicable)
```

## Design Decisions

| Topic              | Decision                                    |
| ------------------ | ------------------------------------------- |
| Default publish    | Draft (explicit `publish` command required) |
| Output format      | Table default, `--json` flag for scripting  |
| Slug               | Required for all post types                 |
| Image keys         | `posts/{slug}/{filename}`                   |
| Image same key     | Overwrites existing                         |
| Image references   | Resolve to URLs at save time                |
| Editor integration | Deferred                                    |

## Commands

### Posts (articles)

```bash
ec post list [--limit N] [--tag TAG] [--status draft|published]
ec post show <slug>
ec post create --title "..." --slug "..." --content "..." [--excerpt "..."] [--tags a,b,c] [--banner-file ./img.jpg]
ec post create --file draft.md
ec post edit <slug> [--title "..."] [--content "..."] [--excerpt "..."] [--tags a,b,c]
ec post edit <slug> --file updated.md
ec post pull <slug> [--output ./path.md]    # download as markdown
ec post delete <slug>
ec post publish <slug>
ec post unpublish <slug>
```

### Links (linkblog)

```bash
ec link list [--limit N] [--tag TAG] [--status draft|published]
ec link show <slug>
ec link create --url "..." --slug "..." --content "..." [--title "..."] [--excerpt "..."] [--source ID] [--tags a,b,c]
ec link create --file draft.md
ec link edit <slug> [--url "..."] [--content "..."] [--title "..."] [--excerpt "..."]
ec link edit <slug> --file updated.md
ec link pull <slug> [--output ./path.md]
ec link delete <slug>
ec link publish <slug>
ec link unpublish <slug>
```

### Notes

```bash
ec note list [--limit N] [--status draft|published]
ec note show <slug>
ec note create --slug "..." --content "..."
ec note create --file draft.md
ec note edit <slug> [--content "..."]
ec note edit <slug> --file updated.md
ec note pull <slug> [--output ./path.md]
ec note delete <slug>
ec note publish <slug>
ec note unpublish <slug>
```

### Sources

Sources provide attribution for links (e.g., "via Hacker News").

```bash
ec source list
ec source show <id>
ec source create --name "..." --url "..." [--feed-url "..."] [--author "..."]...
ec source edit <id> [--name "..."] [--url "..."] [--feed-url "..."] [--author "..."]... [--no-authors]
ec source delete <id>

ec person list
ec person show <id>
ec person create --name "..." [--url "..."]
ec person edit <id> [--name "..."] [--url "..."] [--no-url]
```

### Tags

```bash
ec tag list                    # list all tags in use
```

### Images

```bash
ec image upload <file> [--alt "..."] [--key "..."] [--post <slug>]
ec image delete <id>
```

**Key behavior:**

- `--post <slug>` sets key to `posts/{slug}/{filename}`
- `--key "..."` sets explicit key
- Same key overwrites existing image

### Authentication

```bash
ec login                       # opens browser, generates API key
```

### Config

```bash
ec config set api_url <url>
ec config set api_key          # manual key entry (alternative to login)
ec config show
```

### Utility

```bash
ec version                     # show CLI version
```

## File-Based Content Creation

Create content from markdown files with YAML frontmatter.

### Post (article)

```bash
ec post create --file draft.md
```

```yaml
---
title: My Great Article
slug: my-great-article
tags: [tech, rust]
excerpt: A short summary for previews
banner: ./hero.jpg
---

Here's the content with an embedded image:

![architecture diagram](./images/arch.png)

More content...
```

### Link

```bash
ec link create --file link.md
```

```yaml
---
url: https://example.com/interesting-article
slug: interesting-article
title: Optional Title
excerpt: Why this is worth reading
source: 1
tags: [tech]
---
My commentary on this article...
```

### Note

```bash
ec note create --file note.md
```

```yaml
---
slug: quick-thought-jan-28
---
Just a quick thought I wanted to share.
```

### What happens on create:

1. Parse frontmatter for metadata
2. Extract slug from frontmatter (required)
3. Find local image references:
   - `banner: ./hero.jpg`
   - `![...](./local/path.png)` in content
4. Upload each image with key `posts/{slug}/{filename}`
5. Replace local paths with full URLs in content
6. Create post via API

**Paths are resolved relative to the markdown file's directory.**

## Pull and Edit Workflow

Download existing content for local editing:

```bash
# Download as markdown
ec post pull my-great-article
# → Creates ./my-great-article.md

ec post pull my-great-article --output ./drafts/article.md
# → Creates at specified path
```

**Generated file includes frontmatter:**

```yaml
---
title: My Great Article
slug: my-great-article
tags: [tech, rust]
excerpt: A short summary
status: published
---
Content here...
```

**Edit and push back:**

```bash
# Edit the file locally, then:
ec post edit my-great-article --file ./my-great-article.md
```

This uploads any new local images and updates the post.

## Image Reference Syntax

In markdown content, reference images by:

**Local path (uploaded at save time):**

```markdown
![alt text](./images/diagram.png)
```

**Image ID (resolved at save time):**

```markdown
![alt text](image:42)
```

**External URL (unchanged):**

```markdown
![alt text](https://example.com/image.png)
```

All local paths and image IDs are resolved to full URLs before saving. The database always stores final URLs so previews work everywhere.

## Authentication Flow

### `ec login`

```
$ ec login
Opening browser to authenticate...

  https://erikcraddock.me/cli/auth

After logging in, copy the API key and paste it here.

API Key: ████████████████████████

✓ Logged in as erik@craddock.org
  API key stored in ~/.config/ec/config.yaml
```

**How it works:**

1. CLI runs `ec login`
2. Opens browser to `/cli/auth` (or similar)
3. User authenticates via magic email or passkey
4. Web UI generates a new API key with a name like "CLI - 2026-01-28"
5. UI displays the key with a copy button
6. User copies key and pastes into CLI prompt
7. CLI stores key in config file
8. CLI verifies key works via `GET /api/ping`

**Alternative: callback flow (future enhancement)**

Instead of copy/paste, CLI could:

1. Start local server on random port
2. Open browser to `/cli/auth?callback=http://localhost:PORT`
3. After auth, browser redirects with key in URL
4. CLI captures key automatically

This is more seamless but adds complexity. Start with copy/paste.

### Web UI Requirements

New page needed: `/cli/auth` (or `/admin/cli`)

- Requires authentication (magic email or passkey)
- After auth, generates API key automatically
- Displays key with:
  - Copy button
  - Instructions: "Paste this key into your terminal"
  - Warning: "This key won't be shown again"
- Key name auto-set to "CLI - {date}"

## Configuration

**Location:** `~/.config/ec/config.yaml`

```yaml
api_url: https://erikcraddock.me/api
api_key: <encrypted or reference to keyring>
```

**Environment override:**

```bash
EC_API_URL=https://erikcraddock.me/api
EC_API_KEY=sk_...
```

Environment variables take precedence over config file.

**Required:** Both `api_url` and `api_key` must be configured. CLI exits with code 2 if missing.

## Output Formats

**Default (table):**

```
SLUG                  TITLE                    STATUS      DATE
my-great-post         My Great Post            draft       2026-01-28
interesting-article   Interesting Article      published   2026-01-27
```

**JSON (`--json` global flag):**

```json
{
  "data": [
    {"slug": "my-great-post", "type": "article", "title": "My Great Post", "status": "draft", ...}
  ]
}
```

## Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | Success                                                |
| 1    | General error (API error, validation, etc.)            |
| 2    | Configuration error (missing API URL, missing API key) |

## Open Questions

1. **Editor integration** - Should `ec post create` (no args) open `$EDITOR`?
2. **API key storage** - System keyring, encrypted file, or plain text with warning?
3. **Slug validation** - What characters allowed? Auto-sanitize or reject invalid?
4. **Confirmation prompts** - Require `--yes` for delete, or always prompt?

## API Endpoints Used

| Command        | Endpoint                                                |
| -------------- | ------------------------------------------------------- |
| login          | `GET /api/ping` (verify key)                            |
| post list      | `GET /api/posts?type=article&status=...`                |
| post show      | `GET /api/posts/:slug` ⚠️ needs slug support            |
| post create    | `POST /api/posts`                                       |
| post edit      | `PUT /api/posts/:slug` ⚠️ needs slug support            |
| post delete    | `DELETE /api/posts/:slug` ⚠️ needs slug support         |
| post publish   | `POST /api/posts/:slug/publish` ⚠️ needs slug support   |
| post unpublish | `POST /api/posts/:slug/unpublish` ⚠️ needs slug support |
| source list    | `GET /api/sources`                                      |
| source show    | `GET /api/sources/:id`                                  |
| source create  | `POST /api/sources`                                     |
| source edit    | `PUT /api/sources/:id` ⚠️ needs endpoint                |
| source delete  | `DELETE /api/sources/:id` ⚠️ needs endpoint             |
| person list    | `GET /api/people`                                       |
| person show    | `GET /api/people/:id`                                   |
| person create  | `POST /api/people`                                      |
| person edit    | `PUT /api/people/:id`                                   |
| tag list       | `GET /api/tags` ⚠️ needs endpoint                       |
| image upload   | `POST /api/media`                                       |
| image delete   | `DELETE /api/media/:id`                                 |

Authentication via `X-API-Key` header.

⚠️ = API endpoint needs to be added or modified

## Web UI Pages Needed

| Page        | Purpose                                            |
| ----------- | -------------------------------------------------- |
| `/cli/auth` | CLI login flow - authenticate and generate API key |

## Versioning & Releases

### Version Management

Version stored in `cli/package.json`:

```json
{
  "name": "ec",
  "version": "0.1.0"
}
```

`ec version` reads from package.json (embedded at build time).

### Build

Bun compiles to standalone binary:

```bash
bun build ./cli/src/index.ts --compile --outfile ec
```

### Release Workflow

Trigger: Push tag `cli-v*` (e.g., `cli-v0.1.0`)

**GitHub Actions (`.github/workflows/cli-release.yml`):**

1. Run tests
2. Build binaries for each target:
   - `x86_64-unknown-linux-gnu`
   - `x86_64-apple-darwin`
   - `aarch64-apple-darwin`
   - (Windows if needed)
3. Package as `.tar.gz` (Unix) or `.zip` (Windows)
4. Create GitHub release with artifacts

### Targets

| Target            | OS    | Arch          |
| ----------------- | ----- | ------------- |
| `ec-linux-x64`    | Linux | x86_64        |
| `ec-darwin-x64`   | macOS | Intel         |
| `ec-darwin-arm64` | macOS | Apple Silicon |

### Install Script

`install.sh` in repo root:

```bash
curl -fsSL https://raw.githubusercontent.com/evcraddock/erikcraddock.me/main/install.sh | bash
```

**What it does:**

1. Detect OS and architecture
2. Fetch latest release from GitHub API
3. Download appropriate binary
4. Extract to `~/.local/bin/ec`
5. Print PATH instructions if needed

### Release Process

```bash
# 1. Update version in cli/package.json
# 2. Commit: "chore(cli): bump version to 0.2.0"
# 3. Tag and push
git tag cli-v0.2.0
git push origin cli-v0.2.0
# 4. GitHub Actions builds and creates release
```
