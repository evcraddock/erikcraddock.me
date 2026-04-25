# Test: List Sources

Test listing sources.

## Setup

```bash
cd cli

# Create test sources
bun src/index.ts --config dev-config.yaml source create --name "Source One" --url "https://one.example.com"
bun src/index.ts --config dev-config.yaml source create --name "Source Two" --url "https://two.example.com" --feed-url "https://two.example.com/feed"
```

## List All Sources

```bash
bun src/index.ts --config dev-config.yaml source list
```

**Expected:** Table with ID, NAME, AUTHORS, URL columns showing both sources.

## List as JSON

```bash
bun src/index.ts --config dev-config.yaml source list --json
```

**Expected:** JSON array of source objects with id, name, url, feed_url, and authors fields.

## Empty List

```bash
# After cleanup, verify empty list
bun src/index.ts --config dev-config.yaml source list
```

**Expected:** "No sources found." message.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml source list --json | jq -r '.[].id' | xargs -I {} bun src/index.ts --config dev-config.yaml source delete {} --force
```
