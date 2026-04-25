# Test: Create Source

Test creating sources with various options.

## Create Basic Source

```bash
cd cli
bun src/index.ts --config dev-config.yaml source create --name "Test Source" --url "https://example.com"
```

**Expected:** Success message with source ID.

## Create with Feed URL

```bash
bun src/index.ts --config dev-config.yaml source create --name "Hacker News" --url "https://news.ycombinator.com" --feed-url "https://news.ycombinator.com/rss"
```

**Expected:** Success message with source ID.

## Create with Multiple Authors

```bash
bun src/index.ts --config dev-config.yaml source create --name "Team Blog" --url "https://team.example.com" --author "Alice" --author "Bob"
```

**Expected:** Success message with source ID.

## Create with JSON Output

```bash
bun src/index.ts --config dev-config.yaml source create --name "JSON Test" --url "https://json.example.com" --author "Alice" --json
```

**Expected:** JSON object with id, name, url, feed_url, and authors fields.

## Error: Missing Name

```bash
bun src/index.ts --config dev-config.yaml source create --url "https://example.com"
```

**Expected:** Error message about missing --name.

## Error: Missing URL

```bash
bun src/index.ts --config dev-config.yaml source create --name "Test"
```

**Expected:** Error message about missing --url.

## Cleanup

```bash
# List sources to get IDs
bun src/index.ts --config dev-config.yaml source list

# Delete test sources (replace IDs as needed)
bun src/index.ts --config dev-config.yaml source delete <id> --force
```
