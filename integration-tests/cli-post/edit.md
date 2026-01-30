# Test: Edit Post

Test editing post fields.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml post create \
  --title "Edit Test" \
  --slug edit-test \
  --content "Original content" \
  --tags original
```

## Edit Title

```bash
bun src/index.ts --config dev-config.yaml post edit edit-test --title "Updated Title"
```

**Expected:**

```
✅ Post updated: edit-test
   Title: Updated Title
```

**Verify:**

```bash
bun src/index.ts --config dev-config.yaml post show edit-test
```

## Edit Content

```bash
bun src/index.ts --config dev-config.yaml post edit edit-test --content "New content here"
```

**Expected:** Success message, content updated.

## Edit Tags

```bash
bun src/index.ts --config dev-config.yaml post edit edit-test --tags new,tags
```

**Expected:** Tags replaced with `new, tags`.

## Edit Multiple Fields

```bash
bun src/index.ts --config dev-config.yaml post edit edit-test \
  --title "Final Title" \
  --excerpt "New excerpt"
```

**Expected:** Both fields updated.

## Edit Non-Existent

```bash
bun src/index.ts --config dev-config.yaml post edit does-not-exist --title "Fail"
```

**Expected:**

```
❌ Post not found: does-not-exist
```

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml post delete edit-test --force
```
