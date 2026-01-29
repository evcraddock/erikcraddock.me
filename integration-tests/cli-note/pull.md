# Test: Pull Note

Test downloading notes as markdown files.

## Setup

```bash
cd cli
bun run src/index.ts note create \
  --slug pull-test-note \
  --content "This is a note to pull."
```

## Pull to Default Filename

```bash
bun run src/index.ts note pull pull-test-note
```

**Expected:**

```
✅ Downloaded: pull-test-note.md
   Status: draft
```

## Verify File Contents

```bash
cat pull-test-note.md
```

**Expected:**

```yaml
---
slug: pull-test-note
type: note
status: draft
created: 2026-XX-XX
---
This is a note to pull.
```

Note: Notes have minimal frontmatter - no title, tags, or excerpt.

## Pull to Custom Path

```bash
bun run src/index.ts note pull pull-test-note -o /tmp/custom-note.md
cat /tmp/custom-note.md
```

**Expected:** Same content, saved to `/tmp/custom-note.md`.

## Pull as JSON

```bash
bun run src/index.ts note pull pull-test-note --json
```

**Expected:** Full JSON object (not saved to file).

## Cleanup

```bash
bun run src/index.ts note delete pull-test-note --force
rm pull-test-note.md /tmp/custom-note.md
```
