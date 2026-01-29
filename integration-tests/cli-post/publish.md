# Test: Publish and Unpublish

Test publishing and unpublishing posts.

## Setup

```bash
cd cli
bun run src/index.ts post create \
  --title "Publish Test" \
  --slug publish-test \
  --content $'# Hello\n\nThis is a published post.'
```

> **Note:** Use `$'...'` syntax in bash to interpret `\n` as actual newlines.

## Publish

```bash
bun run src/index.ts post publish publish-test
```

**Expected:**

```
✅ Published: publish-test
   Title: Publish Test
```

**Verify via CLI:**

```bash
bun run src/index.ts post list --status published
```

Should include `publish-test`.

## Verify in Browser

After publishing, the post should be visible on the website.

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/publish-test
```

Take a screenshot to verify:

```bash
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Post page displays with title "Publish Test" and content.

## Unpublish

```bash
bun run src/index.ts post unpublish publish-test
```

**Expected:**

```
✅ Unpublished: publish-test
   Title: Publish Test
   Status: draft
```

**Verify via CLI:**

```bash
bun run src/index.ts post list --status draft
```

Should include `publish-test`.

## Verify Unpublished Not Visible

After unpublishing, the post should not be publicly accessible.

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/publish-test
```

**Expected:** 404 page or "Post not found" message.

## Publish Non-Existent

```bash
bun run src/index.ts post publish does-not-exist
```

**Expected:**

```
❌ Post not found: does-not-exist
```

## Cleanup

```bash
bun run src/index.ts post delete publish-test --force
```
