# Test: List Sources

Test listing sources.

## Setup

```bash
cd cli

# Create test sources
bun run src/index.ts source create --name "Source One" --url "https://one.example.com"
bun run src/index.ts source create --name "Source Two" --url "https://two.example.com" --feed-url "https://two.example.com/feed"
```

## List All Sources

```bash
bun run src/index.ts source list
```

**Expected:** Table with ID, NAME, URL columns showing both sources.

## List as JSON

```bash
bun run src/index.ts source list --json
```

**Expected:** JSON array of source objects with id, name, url, feed_url fields.

## Empty List

```bash
# After cleanup, verify empty list
bun run src/index.ts source list
```

**Expected:** "No sources found." message.

## Cleanup

```bash
bun run src/index.ts source list --json | jq -r '.[].id' | xargs -I {} bun run src/index.ts source delete {} --force
```
