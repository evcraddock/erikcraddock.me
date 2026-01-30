# Test: Delete Image

Test deleting images with confirmation.

## Setup

```bash
cd cli

# Create a test image
convert -size 100x100 xc:green /tmp/test-delete.jpg

# Upload test images
bun src/index.ts --config dev-config.yaml image upload /tmp/test-delete.jpg --json
bun src/index.ts --config dev-config.yaml image upload /tmp/test-delete.jpg --key "delete-test-2.jpg" --json
```

Note the IDs from the output.

## Delete with Confirmation

```bash
bun src/index.ts --config dev-config.yaml image delete <id1>
```

**Expected:** Prompt: "Delete image <id1> (test-delete.jpg)? [y/N]"

Type `y` and press Enter.

**Expected:** Success message "Image <id1> deleted."

## Delete with --yes Flag

```bash
bun src/index.ts --config dev-config.yaml image delete <id2> --yes
```

**Expected:** No prompt, immediate success message.

## Cancel Deletion

```bash
# Upload another image
bun src/index.ts --config dev-config.yaml image upload /tmp/test-delete.jpg --key "delete-test-cancel.jpg" --json

bun src/index.ts --config dev-config.yaml image delete <id>
```

**Expected:** Prompt appears.

Type `n` and press Enter.

**Expected:** "Cancelled." message.

```bash
# Verify image still exists by fetching it
curl -I <url>
```

**Expected:** HTTP 200.

## Error: Non-existent ID

```bash
bun src/index.ts --config dev-config.yaml image delete 99999 --yes 2>&1; echo "Exit: $?"
```

**Expected:** Error message "Media not found" and exit code 1.

## Error: Missing ID

```bash
bun src/index.ts --config dev-config.yaml image delete 2>&1; echo "Exit: $?"
```

**Expected:** Error message "Image ID is required" and exit code 1.

## Cleanup

```bash
# Delete any remaining test images
bun src/index.ts --config dev-config.yaml image delete <remaining-id> --yes
```
