# Test: Create Basic Link

Create a simple link with required fields only.

## Command

```bash
cd cli
bun run src/index.ts link create \
  --url "https://example.com/interesting-article" \
  --slug test-link \
  --content "This is an interesting article worth reading."
```

## Expected Output

```
✅ Link created: test-link
   URL: https://example.com/interesting-article
   Status: draft
```

## Verify

```bash
bun run src/index.ts link show test-link
```

**Expected:**

```
URL:       https://example.com/interesting-article
Slug:      test-link
Status:    draft
Created:   2026-01-XX XX:XX:XX
Updated:   2026-01-XX XX:XX:XX

---
This is an interesting article worth reading.
```

## Cleanup

```bash
bun run src/index.ts link delete test-link --force
```
