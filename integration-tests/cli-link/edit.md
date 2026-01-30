# Test: Edit Link

Test editing link fields.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com/original" \
  --slug edit-test-link \
  --content "Original content"
```

## Edit URL

```bash
bun src/index.ts --config dev-config.yaml link edit edit-test-link --url "https://example.com/updated"
```

**Expected:**

```
✅ Link updated: edit-test-link
   URL: https://example.com/updated
```

## Verify URL Changed

```bash
bun src/index.ts --config dev-config.yaml link show edit-test-link | grep "URL:"
```

**Expected:** `URL:       https://example.com/updated`

## Edit Content

```bash
bun src/index.ts --config dev-config.yaml link edit edit-test-link --content "Updated commentary"
```

**Expected:**

```
✅ Link updated: edit-test-link
   Content updated
```

## Edit Tags

```bash
bun src/index.ts --config dev-config.yaml link edit edit-test-link --tags tech,updated
```

**Expected:**

```
✅ Link updated: edit-test-link
   Tags: tech, updated
```

## Edit from File

```bash
cat > /tmp/updated-link.md << 'EOF'
---
url: https://example.com/file-updated
title: Updated Title
tags: [file, updated]
---

Content updated from file.
EOF

bun src/index.ts --config dev-config.yaml link edit edit-test-link --file /tmp/updated-link.md
```

**Expected:**

```
✅ Link updated: edit-test-link
   URL: https://example.com/file-updated
   Title: Updated Title
   Content updated
   Tags: file, updated
   Source: /tmp/updated-link.md
```

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml link delete edit-test-link --force
rm /tmp/updated-link.md
```
