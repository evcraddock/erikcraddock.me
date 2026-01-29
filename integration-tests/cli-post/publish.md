# Test: Publish and Unpublish

Test publishing and unpublishing posts.

## Setup

```bash
cd cli
bun run src/index.ts post create \
  --title "Publish Test" \
  --slug publish-test \
  --content "Content"
```

## Publish

```bash
bun run src/index.ts post publish publish-test
```

**Expected:**

```
✅ Published: publish-test
   Title: Publish Test
```

**Verify:**

```bash
bun run src/index.ts post list --status published
```

Should include `publish-test`.

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

**Verify:**

```bash
bun run src/index.ts post list --status draft
```

Should include `publish-test`.

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
