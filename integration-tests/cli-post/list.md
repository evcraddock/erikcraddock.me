# Test: List Posts

Test listing posts with various filters.

## Setup

```bash
cd cli

# Create test posts
bun src/index.ts --config dev-config.yaml post create --title "Draft Post" --slug list-draft --content "Draft"
bun src/index.ts --config dev-config.yaml post create --title "Published Post" --slug list-published --content "Published"
bun src/index.ts --config dev-config.yaml post publish list-published
```

## List All (Default)

```bash
bun src/index.ts --config dev-config.yaml post list
```

**Expected:** Shows both posts in table format with slug, title, status, date.

## List Drafts Only

```bash
bun src/index.ts --config dev-config.yaml post list --status draft
```

**Expected:** Shows only `list-draft`.

## List Published Only

```bash
bun src/index.ts --config dev-config.yaml post list --status published
```

**Expected:** Shows only `list-published`.

## List with Limit

```bash
bun src/index.ts --config dev-config.yaml post list --limit 1
```

**Expected:** Shows only 1 post.

## List as JSON

```bash
bun src/index.ts --config dev-config.yaml post list --json
```

**Expected:** JSON array of post objects.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml post delete list-draft --force
bun src/index.ts --config dev-config.yaml post delete list-published --force
```
