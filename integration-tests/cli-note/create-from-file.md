# Test: Create Note from File

Create a note from a markdown file with frontmatter.

## Setup

Create a test markdown file:

```bash
cat > /tmp/test-note.md << 'EOF'
---
slug: file-note
---

Working on some exciting stuff today!

- Fixed a nasty bug
- Added new feature
- Deployed to production

Feeling productive 💪
EOF
```

## Command

```bash
cd cli
bun src/index.ts --config dev-config.yaml note create --file /tmp/test-note.md
```

## Expected Output

```
✅ Note created: file-note
   Status: draft
   Source: /tmp/test-note.md
```

## Verify

```bash
bun src/index.ts --config dev-config.yaml note show file-note
```

**Expected:** Shows the full content from the file.

## Pull and Verify Roundtrip

```bash
bun src/index.ts --config dev-config.yaml note pull file-note -o /tmp/pulled-note.md
cat /tmp/pulled-note.md
```

**Expected:** Frontmatter with `slug`, `type: note`, `status`, `created`.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml note delete file-note --force
rm /tmp/test-note.md /tmp/pulled-note.md
```
