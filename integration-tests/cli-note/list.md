# Test: List Notes

Test listing notes with various filters.

## Setup

```bash
cd cli

# Create test notes
bun src/index.ts --config dev-config.yaml note create --slug note-draft --content "Draft note"
bun src/index.ts --config dev-config.yaml note create --slug note-published --content "Published note"
bun src/index.ts --config dev-config.yaml note publish note-published
```

## List All (Default)

```bash
bun src/index.ts --config dev-config.yaml note list
```

**Expected:** Shows both notes in table format with slug, excerpt, status, date.

## List Drafts Only

```bash
bun src/index.ts --config dev-config.yaml note list --status draft
```

**Expected:** Shows only `note-draft`.

## List Published Only

```bash
bun src/index.ts --config dev-config.yaml note list --status published
```

**Expected:** Shows only `note-published`.

## List with Limit

```bash
bun src/index.ts --config dev-config.yaml note list --limit 1
```

**Expected:** Shows only 1 note.

## List as JSON

```bash
bun src/index.ts --config dev-config.yaml note list --json
```

**Expected:** JSON array of note objects.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml note delete note-draft --force
bun src/index.ts --config dev-config.yaml note delete note-published --force
```
