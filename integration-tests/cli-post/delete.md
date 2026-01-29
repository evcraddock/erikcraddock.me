# Test: Delete Post

Test deleting posts with confirmation.

## Setup

```bash
cd cli
bun run src/index.ts post create \
  --title "Delete Test" \
  --slug delete-test \
  --content "To be deleted"
```

## Delete with Confirmation

```bash
bun run src/index.ts post delete delete-test
```

**Expected:** Prompts `Delete 'Delete Test' (delete-test)? [y/N]`

- Type `n` or press Enter → `Cancelled.`
- Type `y` → `✅ Deleted: delete-test`

## Delete with Force

```bash
# Recreate first
bun run src/index.ts post create \
  --title "Force Delete" \
  --slug force-delete \
  --content "Content"

# Delete without prompt
bun run src/index.ts post delete force-delete --force
```

**Expected:**

```
✅ Deleted: force-delete
```

## Delete Non-Existent

```bash
bun run src/index.ts post delete does-not-exist --force
```

**Expected:**

```
❌ Post not found: does-not-exist
```

## Delete with JSON Output

```bash
bun run src/index.ts post create --title "JSON Delete" --slug json-delete --content "X"
bun run src/index.ts post delete json-delete --force --json
```

**Expected:**

```json
{
  "deleted": "json-delete"
}
```
