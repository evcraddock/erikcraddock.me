# Test: Create Basic Note

Create a simple note with required fields only.

## Command

```bash
cd cli
bun run src/index.ts note create \
  --slug test-note \
  --content "Just shipped a new feature! 🚀"
```

## Expected Output

```
✅ Note created: test-note
   Status: draft
```

## Verify

```bash
bun run src/index.ts note show test-note
```

**Expected:**

```
Slug:      test-note
Status:    draft
Created:   2026-XX-XX XX:XX:XX
Updated:   2026-XX-XX XX:XX:XX

---
Just shipped a new feature! 🚀
```

## Cleanup

```bash
bun run src/index.ts note delete test-note --force
```
