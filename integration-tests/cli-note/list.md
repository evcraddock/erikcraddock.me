# Test: List Notes

Test listing notes with various filters.

## Setup

```bash
cd cli

# Create test notes
bun run src/index.ts note create --slug note-draft --content "Draft note"
bun run src/index.ts note create --slug note-published --content "Published note"
bun run src/index.ts note publish note-published
```

## List All (Default)

```bash
bun run src/index.ts note list
```

**Expected:** Shows both notes in table format with slug, excerpt, status, date.

## List Drafts Only

```bash
bun run src/index.ts note list --status draft
```

**Expected:** Shows only `note-draft`.

## List Published Only

```bash
bun run src/index.ts note list --status published
```

**Expected:** Shows only `note-published`.

## List with Limit

```bash
bun run src/index.ts note list --limit 1
```

**Expected:** Shows only 1 note.

## List as JSON

```bash
bun run src/index.ts note list --json
```

**Expected:** JSON array of note objects.

## Cleanup

```bash
bun run src/index.ts note delete note-draft --force
bun run src/index.ts note delete note-published --force
```
