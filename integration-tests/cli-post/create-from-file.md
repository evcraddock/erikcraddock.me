# Test: Create Post from File

Test creating posts from markdown files with frontmatter.

## Setup

Create a test markdown file:

```bash
cd cli
cat > /tmp/test-post.md << 'EOF'
---
title: File Created Post
slug: file-created-post
tags: [test, file-based]
excerpt: A post created from a markdown file.
type: article
---

# Hello from File

This post was created using `ec post create --file`.

## Features

- Frontmatter parsing
- Content extraction
- Tag support
EOF
```

## Create from File

```bash
bun run src/index.ts post create --file /tmp/test-post.md
```

**Expected:**

```
✅ Post created: file-created-post
   Title: File Created Post
   Type: article
   Status: draft
   Tags: Test, File Based
   Source: /tmp/test-post.md
```

## Verify Post Created

```bash
bun run src/index.ts post show file-created-post
```

**Expected:** Shows title "File Created Post", tags "Test, File Based", and content starting with "# Hello from File".

## Publish and Verify on Home Page

```bash
bun run src/index.ts post publish file-created-post

~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Home page shows "File Created Post" with excerpt.

## Verify Post Page

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/file-created-post
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:**

- Title: "File Created Post"
- Tags: "Test", "File Based"
- Content: Rendered markdown with heading, code, and bullet list

## Pull Back and Verify Roundtrip

```bash
bun run src/index.ts post pull file-created-post --output /tmp/pulled.md
cat /tmp/pulled.md
```

**Expected:** Downloaded file contains:

- Frontmatter with title, slug, type, status, tags, excerpt, created
- Content matching original

## Edit with File

Create updated file:

```bash
cat > /tmp/updated-post.md << 'EOF'
---
title: Updated via File
tags: [updated, roundtrip]
excerpt: This post was updated from a file.
---

# Updated Content

The content has been changed via file-based editing.
EOF

bun run src/index.ts post edit file-created-post --file /tmp/updated-post.md
```

**Expected:**

```
✅ Post updated: file-created-post
   Title: Updated via File
   Content updated
   Excerpt: This post was updated from a file.
   Tags: Updated, Roundtrip
   Source: /tmp/updated-post.md
```

## Verify Update

```bash
bun run src/index.ts post show file-created-post
```

**Expected:** Title is "Updated via File", tags are "Updated, Roundtrip".

## CLI Override of Frontmatter

```bash
bun run src/index.ts post edit file-created-post --file /tmp/updated-post.md --tags cli,override
```

**Expected:** Tags are "Cli, Override" (CLI flag overrides frontmatter).

## Cleanup

```bash
bun run src/index.ts post delete file-created-post --force
rm /tmp/test-post.md /tmp/updated-post.md /tmp/pulled.md
```
