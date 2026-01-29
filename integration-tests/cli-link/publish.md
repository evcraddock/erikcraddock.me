# Test: Publish and Unpublish Link

Test publishing and unpublishing links.

## Setup

```bash
cd cli
bun run src/index.ts link create \
  --url "https://example.com/article" \
  --slug publish-test-link \
  --content "Link to publish"
```

## Verify Initial State (Draft)

```bash
bun run src/index.ts link show publish-test-link | grep "Status:"
```

**Expected:** `Status:    draft`

## Publish Link

```bash
bun run src/index.ts link publish publish-test-link
```

**Expected:**

```
✅ Published: publish-test-link
   URL: https://example.com/article
```

## Verify Published

```bash
bun run src/index.ts link show publish-test-link | grep -E "(Status:|Published:)"
```

**Expected:**

```
Status:    published
Published: 2026-XX-XX XX:XX:XX
```

## View in Browser (Optional)

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/publish-test-link
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Link displays with URL prominently shown, content as commentary.

## Unpublish Link

```bash
bun run src/index.ts link unpublish publish-test-link
```

**Expected:**

```
✅ Unpublished: publish-test-link
```

## Verify Unpublished

```bash
bun run src/index.ts link show publish-test-link | grep "Status:"
```

**Expected:** `Status:    draft`

## Cleanup

```bash
bun run src/index.ts link delete publish-test-link --force
```
