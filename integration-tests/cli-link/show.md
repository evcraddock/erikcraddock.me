# Test: Show Link

Test showing link details.

## Setup

```bash
cd cli
bun run src/index.ts link create \
  --url "https://example.com/article" \
  --slug show-test-link \
  --content "Great article about testing" \
  --title "Test Article" \
  --tags testing,cli
```

## Show Link

```bash
bun run src/index.ts link show show-test-link
```

**Expected:**

```
URL:       https://example.com/article
Title:     Test Article
Slug:      show-test-link
Status:    draft
Created:   2026-XX-XX XX:XX:XX
Updated:   2026-XX-XX XX:XX:XX
Tags:      Testing, Cli

---
Great article about testing
```

## Show as JSON

```bash
bun run src/index.ts link show show-test-link --json
```

**Expected:** Full JSON object with all fields including `url`, `type: "link"`.

## Show Non-existent Link

```bash
bun run src/index.ts link show nonexistent-link
```

**Expected:**

```
❌ Link not found: nonexistent-link
```

## Cleanup

```bash
bun run src/index.ts link delete show-test-link --force
```
