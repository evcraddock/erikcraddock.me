# Test: Create Source

Test creating sources with various options.

## Create Basic Source

```bash
cd cli
bun run src/index.ts source create --name "Test Source" --url "https://example.com"
```

**Expected:** Success message with source ID.

## Create with Feed URL

```bash
bun run src/index.ts source create --name "Hacker News" --url "https://news.ycombinator.com" --feed-url "https://news.ycombinator.com/rss"
```

**Expected:** Success message with source ID.

## Create with JSON Output

```bash
bun run src/index.ts source create --name "JSON Test" --url "https://json.example.com" --json
```

**Expected:** JSON object with id, name, url, feed_url fields.

## Error: Missing Name

```bash
bun run src/index.ts source create --url "https://example.com"
```

**Expected:** Error message about missing --name.

## Error: Missing URL

```bash
bun run src/index.ts source create --name "Test"
```

**Expected:** Error message about missing --url.

## Cleanup

```bash
# List sources to get IDs
bun run src/index.ts source list

# Delete test sources (replace IDs as needed)
bun run src/index.ts source delete <id> --force
```
