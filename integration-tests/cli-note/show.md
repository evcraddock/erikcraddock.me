# Test: Show Note

Test showing note details.

## Setup

```bash
cd cli
bun run src/index.ts note create \
  --slug show-test-note \
  --content "This is a test note with some content."
```

## Show Note

```bash
bun run src/index.ts note show show-test-note
```

**Expected:**

```
Slug:      show-test-note
Status:    draft
Created:   2026-XX-XX XX:XX:XX
Updated:   2026-XX-XX XX:XX:XX

---
This is a test note with some content.
```

## Show as JSON

```bash
bun run src/index.ts note show show-test-note --json
```

**Expected:** Full JSON object with `type: "note"`, no title field.

## Show Non-existent Note

```bash
bun run src/index.ts note show nonexistent-note
```

**Expected:**

```
❌ Note not found: nonexistent-note
```

## Cleanup

```bash
bun run src/index.ts note delete show-test-note --force
```
