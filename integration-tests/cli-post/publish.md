# Test: Publish and Unpublish

Test publishing and unpublishing posts, verifying visibility on the website.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml post create \
  --title "Publish Test" \
  --slug publish-test \
  --content $'# Hello\n\nThis is a published post.'
```

> **Note:** Use `$'...'` syntax in bash to interpret `\n` as actual newlines.

## Verify Draft Not on Home Page

Before publishing, the post should NOT appear on the home page.

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Home page does NOT show "Publish Test" in the post list.

## Publish

```bash
bun src/index.ts --config dev-config.yaml post publish publish-test
```

**Expected:**

```
✅ Published: publish-test
   Title: Publish Test
```

## Verify Published Post on Home Page

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Home page shows "Publish Test" in the post list.

## Verify Post Page

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/publish-test
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Post page displays with title "Publish Test", date, and rendered markdown content.

## Unpublish

```bash
bun src/index.ts --config dev-config.yaml post unpublish publish-test
```

**Expected:**

```
✅ Unpublished: publish-test
   Title: Publish Test
   Status: draft
```

## Verify Unpublished Not on Home Page

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Home page does NOT show "Publish Test" in the post list.

## Re-publish and Delete

```bash
bun src/index.ts --config dev-config.yaml post publish publish-test
```

Verify it's back on home page, then delete:

```bash
bun src/index.ts --config dev-config.yaml post delete publish-test --force
```

## Verify Deleted Not on Home Page

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Home page does NOT show "Publish Test" in the post list.

## Verify Deleted Post Page Returns 404

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/publish-test
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** 404 page or "Post not found" message.
