# Test: Delete Source

Test deleting sources with confirmation.

## Setup

```bash
cd cli

# Create test sources
bun run src/index.ts source create --name "Delete Test 1" --url "https://delete1.example.com" --json
bun run src/index.ts source create --name "Delete Test 2" --url "https://delete2.example.com" --json
```

Note the IDs from the output.

## Delete with Confirmation

```bash
bun run src/index.ts source delete <id1>
```

**Expected:** Prompt: "Delete source 'Delete Test 1'? This may affect linked posts. [y/N]"

Type `y` and press Enter.

**Expected:** Success message "Source 'Delete Test 1' deleted."

## Delete with Force Flag

```bash
bun run src/index.ts source delete <id2> --force
```

**Expected:** No prompt, immediate success message.

## Cancel Deletion

```bash
# Create another source
bun run src/index.ts source create --name "Cancel Test" --url "https://cancel.example.com" --json
bun run src/index.ts source delete <id>
```

**Expected:** Prompt appears.

Type `n` and press Enter.

**Expected:** "Cancelled." message.

```bash
bun run src/index.ts source show <id>
```

**Expected:** Source still exists.

## Error: Non-existent ID

```bash
bun run src/index.ts source delete 99999 --force
```

**Expected:** Error message "Source not found".

## Cleanup

```bash
# Delete any remaining test sources
bun run src/index.ts source list --json | jq -r '.[].id' | xargs -I {} bun run src/index.ts source delete {} --force
```
