# Test: Show Post

Test displaying post details.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml post create \
  --title "Show Test" \
  --slug show-test \
  --content $'# Content\n\nWith markdown.' \
  --excerpt "Short summary" \
  --tags demo
```

> **Note:** Use `$'...'` syntax in bash to interpret `\n` as actual newlines.

## Show Post

```bash
bun src/index.ts --config dev-config.yaml post show show-test
```

**Expected:**

```
Title:     Show Test
Slug:      show-test
Type:      article
Status:    draft
Created:   <timestamp>
Updated:   <timestamp>
Tags:      demo
Excerpt:   Short summary

---
# Content

With markdown.
```

## Show as JSON

```bash
bun src/index.ts --config dev-config.yaml post show show-test --json
```

**Expected:** Full post object as JSON.

## Show Non-Existent

```bash
bun src/index.ts --config dev-config.yaml post show does-not-exist
```

**Expected:**

```
❌ Post not found: does-not-exist
```

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml post delete show-test --force
```
