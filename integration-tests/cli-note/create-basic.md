# Test: Create Basic Note

Create a simple note with required fields only.

## Command

```bash
cd cli
bun src/index.ts --config dev-config.yaml note create \
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
bun src/index.ts --config dev-config.yaml note show test-note
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
bun src/index.ts --config dev-config.yaml note delete test-note --force
```
