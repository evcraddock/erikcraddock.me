# Test: List Tags

Test listing tags with post counts.

## Setup

```bash
cd cli

# Create posts with tags to have meaningful counts
bun run src/index.ts post create --title "Tag Test 1" --slug tag-test-1 --content "Content" --tags tech,testing
bun run src/index.ts post create --title "Tag Test 2" --slug tag-test-2 --content "Content" --tags tech,demo
bun run src/index.ts post create --title "Tag Test 3" --slug tag-test-3 --content "Content" --tags demo
```

## List All Tags

```bash
bun run src/index.ts tag list
```

**Expected:** Table with TAG and COUNT columns:

- Tags sorted by count descending
- "tech" should have count 2
- "demo" should have count 2
- "testing" should have count 1

## List as JSON

```bash
bun run src/index.ts tag list --json
```

**Expected:** JSON array of tag objects with id, name, slug, count fields.

## Empty Tags

If no posts exist with tags:

```bash
bun run src/index.ts tag list
```

**Expected:** Either "No tags found." or empty table.

## Cleanup

```bash
bun run src/index.ts post delete tag-test-1 --force
bun run src/index.ts post delete tag-test-2 --force
bun run src/index.ts post delete tag-test-3 --force
```
