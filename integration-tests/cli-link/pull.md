# Test: Pull Link

Test downloading links as markdown files.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com/pulled-article" \
  --slug pull-test-link \
  --content "Commentary on the article" \
  --title "Pulled Article" \
  --tags tech,testing
```

## Pull to Default Filename

```bash
bun src/index.ts --config dev-config.yaml link pull pull-test-link
```

**Expected:**

```
✅ Downloaded: pull-test-link.md
   URL: https://example.com/pulled-article
   Title: Pulled Article
   Status: draft
```

## Verify File Contents

```bash
cat pull-test-link.md
```

**Expected:**

```yaml
---
slug: pull-test-link
type: link
url: https://example.com/pulled-article
title: Pulled Article
status: draft
tags: [tech, testing]
created: 2026-XX-XX
---
Commentary on the article
```

## Pull to Custom Path

```bash
bun src/index.ts --config dev-config.yaml link pull pull-test-link -o /tmp/custom-link.md
cat /tmp/custom-link.md
```

**Expected:** Same content, saved to `/tmp/custom-link.md`.

## Pull as JSON

```bash
bun src/index.ts --config dev-config.yaml link pull pull-test-link --json
```

**Expected:** Full JSON object (not saved to file).

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml link delete pull-test-link --force
rm pull-test-link.md /tmp/custom-link.md
```
