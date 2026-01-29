# Test: List Links

Test listing links with various filters.

## Setup

```bash
cd cli

# Create test links
bun run src/index.ts link create \
  --url "https://example.com/draft" \
  --slug link-draft \
  --content "Draft link"

bun run src/index.ts link create \
  --url "https://example.com/published" \
  --slug link-published \
  --content "Published link" \
  --tags tech

bun run src/index.ts link publish link-published
```

## List All (Default)

```bash
bun run src/index.ts link list
```

**Expected:** Shows both links in table format with slug, title, status, date.

## List Drafts Only

```bash
bun run src/index.ts link list --status draft
```

**Expected:** Shows only `link-draft`.

## List Published Only

```bash
bun run src/index.ts link list --status published
```

**Expected:** Shows only `link-published`.

## List by Tag

```bash
bun run src/index.ts link list --tag tech
```

**Expected:** Shows only `link-published` (has tech tag).

## List with Limit

```bash
bun run src/index.ts link list --limit 1
```

**Expected:** Shows only 1 link.

## List as JSON

```bash
bun run src/index.ts link list --json
```

**Expected:** JSON array of link objects.

## Cleanup

```bash
bun run src/index.ts link delete link-draft --force
bun run src/index.ts link delete link-published --force
```
