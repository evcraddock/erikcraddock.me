# Test: Show Source

Test showing source details.

## Setup

```bash
cd cli

# Create a test source and capture ID
bun run src/index.ts source create --name "Show Test" --url "https://show.example.com" --feed-url "https://show.example.com/rss" --json
```

Note the ID from the output.

## Show Source Details

```bash
bun run src/index.ts source show <id>
```

**Expected:** Formatted output with:

- ID: <id>
- Name: Show Test
- URL: https://show.example.com
- Feed URL: https://show.example.com/rss

## Show as JSON

```bash
bun run src/index.ts source show <id> --json
```

**Expected:** JSON object with all source fields.

## Error: Non-existent ID

```bash
bun run src/index.ts source show 99999
```

**Expected:** Error message "Source not found".

## Error: Missing ID

```bash
bun run src/index.ts source show
```

**Expected:** Error message about missing source ID.

## Cleanup

```bash
bun run src/index.ts source delete <id> --force
```
