# Test: List Tags

Test listing tags with post counts.

## Setup

```bash
cd cli

# Create posts with tags to have meaningful counts
bun src/index.ts --config dev-config.yaml post create --title "Tag Test 1" --slug tag-test-1 --content "Content" --tags tech,testing
bun src/index.ts --config dev-config.yaml post create --title "Tag Test 2" --slug tag-test-2 --content "Content" --tags tech,demo
bun src/index.ts --config dev-config.yaml post create --title "Tag Test 3" --slug tag-test-3 --content "Content" --tags demo
```

## List All Tags

```bash
bun src/index.ts --config dev-config.yaml tag list
```

**Expected:** Table with TAG and COUNT columns:

- Tags sorted by count descending
- "tech" should have count 2
- "demo" should have count 2
- "testing" should have count 1

## List as JSON

```bash
bun src/index.ts --config dev-config.yaml tag list --json
```

**Expected:** JSON array of tag objects with id, name, slug, count fields.

## Empty Tags

If no posts exist with tags:

```bash
bun src/index.ts --config dev-config.yaml tag list
```

**Expected:** Either "No tags found." or empty table.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml post delete tag-test-1 --force
bun src/index.ts --config dev-config.yaml post delete tag-test-2 --force
bun src/index.ts --config dev-config.yaml post delete tag-test-3 --force
```
