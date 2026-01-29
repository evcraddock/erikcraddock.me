# Test: Delete Link

Test deleting links with confirmation.

## Setup

```bash
cd cli
bun run src/index.ts link create \
  --url "https://example.com/to-delete" \
  --slug delete-test-link \
  --content "Link to delete" \
  --title "Delete Me"
```

## Delete with Confirmation (Cancel)

```bash
echo "n" | bun run src/index.ts link delete delete-test-link
```

**Expected:**

```
About to delete link: delete-test-link
  Title: Delete Me
  URL: https://example.com/to-delete

Are you sure? (y/N): Cancelled.
```

## Verify Still Exists

```bash
bun run src/index.ts link show delete-test-link
```

**Expected:** Shows the link details.

## Delete with Confirmation (Confirm)

```bash
echo "y" | bun run src/index.ts link delete delete-test-link
```

**Expected:**

```
About to delete link: delete-test-link
  Title: Delete Me
  URL: https://example.com/to-delete

Are you sure? (y/N): ✅ Deleted: delete-test-link
```

## Verify Deleted

```bash
bun run src/index.ts link show delete-test-link
```

**Expected:**

```
❌ Link not found: delete-test-link
```

## Delete with Force Flag

```bash
# Create another link
bun run src/index.ts link create \
  --url "https://example.com/force-delete" \
  --slug force-delete-link \
  --content "Force delete"

# Delete without confirmation
bun run src/index.ts link delete force-delete-link --force
```

**Expected:**

```
✅ Deleted: force-delete-link
```
