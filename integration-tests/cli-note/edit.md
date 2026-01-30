# Test: Edit Note

Test editing note content.

## Setup

```bash
cd cli
bun src/index.ts --config dev-config.yaml note create \
  --slug edit-test-note \
  --content "Original content"
```

## Edit Content

```bash
bun src/index.ts --config dev-config.yaml note edit edit-test-note --content "Updated content here"
```

**Expected:**

```
✅ Note updated: edit-test-note
   Content updated
```

## Verify Content Changed

```bash
bun src/index.ts --config dev-config.yaml note show edit-test-note
```

**Expected:** Shows "Updated content here" (not original).

## Edit from File

```bash
cat > /tmp/updated-note.md << 'EOF'
---
slug: ignored
---

Content updated from file.

Multiple paragraphs work too.
EOF

bun src/index.ts --config dev-config.yaml note edit edit-test-note --file /tmp/updated-note.md
```

**Expected:**

```
✅ Note updated: edit-test-note
   Content updated
   Source: /tmp/updated-note.md
```

## Verify File Content

```bash
bun src/index.ts --config dev-config.yaml note show edit-test-note
```

**Expected:** Shows content from file (slug in frontmatter is ignored).

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml note delete edit-test-note --force
rm /tmp/updated-note.md
```
