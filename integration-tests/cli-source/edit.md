# Test: Edit Source

Test editing source fields.

## Setup

```bash
cd cli

# Create a test source
bun run src/index.ts source create --name "Edit Test" --url "https://edit.example.com" --json
```

Note the ID from the output.

## Edit Name

```bash
bun run src/index.ts source edit <id> --name "Updated Name"
```

**Expected:** Success message.

```bash
bun run src/index.ts source show <id>
```

**Expected:** Name shows "Updated Name".

## Edit URL

```bash
bun run src/index.ts source edit <id> --url "https://updated.example.com"
```

**Expected:** Success message.

## Add Feed URL

```bash
bun run src/index.ts source edit <id> --feed-url "https://updated.example.com/feed"
```

**Expected:** Success message.

```bash
bun run src/index.ts source show <id>
```

**Expected:** Feed URL shows the new value.

## Remove Feed URL

```bash
bun run src/index.ts source edit <id> --no-feed-url
```

**Expected:** Success message.

```bash
bun run src/index.ts source show <id>
```

**Expected:** Feed URL shows "-".

## Edit with JSON Output

```bash
bun run src/index.ts source edit <id> --name "JSON Edit" --json
```

**Expected:** JSON object with updated source.

## Error: No Updates Provided

```bash
bun run src/index.ts source edit <id>
```

**Expected:** Error message about no update options provided.

## Error: Non-existent ID

```bash
bun run src/index.ts source edit 99999 --name "Test"
```

**Expected:** Error message "Source not found".

## Cleanup

```bash
bun run src/index.ts source delete <id> --force
```
