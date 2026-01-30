# Test: Delete Note

Test deleting notes with confirmation.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml note create \
  --slug delete-test-note \
  --content "Note to delete"
```

## Delete with Confirmation (Cancel)

```bash
echo "n" | bun src/index.ts --config dev-config.yaml note delete delete-test-note
```

**Expected:**

```
About to delete note: delete-test-note
  Content: Note to delete

Are you sure? (y/N): Cancelled.
```

## Verify Still Exists

```bash
bun src/index.ts --config dev-config.yaml note show delete-test-note
```

**Expected:** Shows the note details.

## Delete with Confirmation (Confirm)

```bash
echo "y" | bun src/index.ts --config dev-config.yaml note delete delete-test-note
```

**Expected:**

```
About to delete note: delete-test-note
  Content: Note to delete

Are you sure? (y/N): ✅ Deleted: delete-test-note
```

## Verify Deleted

```bash
bun src/index.ts --config dev-config.yaml note show delete-test-note
```

**Expected:**

```
❌ Note not found: delete-test-note
```

## Delete with Force Flag

```bash
# Create another note
bun src/index.ts --config dev-config.yaml note create \
  --slug force-delete-note \
  --content "Force delete"

# Delete without confirmation
bun src/index.ts --config dev-config.yaml note delete force-delete-note --force
```

**Expected:**

```
✅ Deleted: force-delete-note
```
