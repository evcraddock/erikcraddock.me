# Test: List Posts

Test listing posts with various filters.

## Setup

```bash
cd cli

# Create test posts
bun run src/index.ts post create --title "Draft Post" --slug list-draft --content "Draft"
bun run src/index.ts post create --title "Published Post" --slug list-published --content "Published"
bun run src/index.ts post publish list-published
```

## List All (Default)

```bash
bun run src/index.ts post list
```

**Expected:** Shows both posts in table format with slug, title, status, date.

## List Drafts Only

```bash
bun run src/index.ts post list --status draft
```

**Expected:** Shows only `list-draft`.

## List Published Only

```bash
bun run src/index.ts post list --status published
```

**Expected:** Shows only `list-published`.

## List with Limit

```bash
bun run src/index.ts post list --limit 1
```

**Expected:** Shows only 1 post.

## List as JSON

```bash
bun run src/index.ts post list --json
```

**Expected:** JSON array of post objects.

## Cleanup

```bash
bun run src/index.ts post delete list-draft --force
bun run src/index.ts post delete list-published --force
```
