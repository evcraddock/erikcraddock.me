# Test: Publish and Unpublish Note

Test publishing and unpublishing notes.

## Setup

```bash
cd cli
bun run src/index.ts note create \
  --slug publish-test-note \
  --content "Note to publish"
```

## Verify Initial State (Draft)

```bash
bun run src/index.ts note show publish-test-note | grep "Status:"
```

**Expected:** `Status:    draft`

## Publish Note

```bash
bun run src/index.ts note publish publish-test-note
```

**Expected:**

```
✅ Published: publish-test-note
```

## Verify Published

```bash
bun run src/index.ts note show publish-test-note | grep -E "(Status:|Published:)"
```

**Expected:**

```
Status:    published
Published: 2026-XX-XX XX:XX:XX
```

## View in Browser (Optional)

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/publish-test-note
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:** Note displays inline-style (no title, left border styling).

## Unpublish Note

```bash
bun run src/index.ts note unpublish publish-test-note
```

**Expected:**

```
✅ Unpublished: publish-test-note
```

## Verify Unpublished

```bash
bun run src/index.ts note show publish-test-note | grep "Status:"
```

**Expected:** `Status:    draft`

## Cleanup

```bash
bun run src/index.ts note delete publish-test-note --force
```
