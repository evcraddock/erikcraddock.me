# Test: Delete Link

Test deleting links with confirmation.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com/to-delete" \
  --slug delete-test-link \
  --content "Link to delete" \
  --title "Delete Me"
```

## Delete with Confirmation (Cancel)

```bash
echo "n" | bun src/index.ts --config dev-config.yaml link delete delete-test-link
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
bun src/index.ts --config dev-config.yaml link show delete-test-link
```

**Expected:** Shows the link details.

## Delete with Confirmation (Confirm)

```bash
echo "y" | bun src/index.ts --config dev-config.yaml link delete delete-test-link
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
bun src/index.ts --config dev-config.yaml link show delete-test-link
```

**Expected:**

```
❌ Link not found: delete-test-link
```

## Delete with Force Flag

```bash
# Create another link
bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com/force-delete" \
  --slug force-delete-link \
  --content "Force delete"

# Delete without confirmation
bun src/index.ts --config dev-config.yaml link delete force-delete-link --force
```

**Expected:**

```
✅ Deleted: force-delete-link
```
