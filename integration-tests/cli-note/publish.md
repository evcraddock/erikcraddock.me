# Test: Publish and Unpublish Note

Test publishing and unpublishing notes.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml note create \
  --slug publish-test-note \
  --content "Note to publish"
```

## Verify Initial State (Draft)

```bash
bun src/index.ts --config dev-config.yaml note show publish-test-note | grep "Status:"
```

**Expected:** `Status:    draft`

## Publish Note

```bash
bun src/index.ts --config dev-config.yaml note publish publish-test-note
```

**Expected:**

```
✅ Published: publish-test-note
```

## Verify Published

```bash
bun src/index.ts --config dev-config.yaml note show publish-test-note | grep -E "(Status:|Published:)"
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
bun src/index.ts --config dev-config.yaml note unpublish publish-test-note
```

**Expected:**

```
✅ Unpublished: publish-test-note
```

## Verify Unpublished

```bash
bun src/index.ts --config dev-config.yaml note show publish-test-note | grep "Status:"
```

**Expected:** `Status:    draft`

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml note delete publish-test-note --force
```
