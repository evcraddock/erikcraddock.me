# Test: List Links

Test listing links with various filters.

## Setup

```bash
cd cli

# Create test links
bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com/draft" \
  --slug link-draft \
  --content "Draft link"

bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com/published" \
  --slug link-published \
  --content "Published link" \
  --tags tech

bun src/index.ts --config dev-config.yaml link publish link-published
```

## List All (Default)

```bash
bun src/index.ts --config dev-config.yaml link list
```

**Expected:** Shows both links in table format with slug, title, status, date.

## List Drafts Only

```bash
bun src/index.ts --config dev-config.yaml link list --status draft
```

**Expected:** Shows only `link-draft`.

## List Published Only

```bash
bun src/index.ts --config dev-config.yaml link list --status published
```

**Expected:** Shows only `link-published`.

## List by Tag

```bash
bun src/index.ts --config dev-config.yaml link list --tag tech
```

**Expected:** Shows only `link-published` (has tech tag).

## List with Limit

```bash
bun src/index.ts --config dev-config.yaml link list --limit 1
```

**Expected:** Shows only 1 link.

## List as JSON

```bash
bun src/index.ts --config dev-config.yaml link list --json
```

**Expected:** JSON array of link objects.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml link delete link-draft --force
bun src/index.ts --config dev-config.yaml link delete link-published --force
```
