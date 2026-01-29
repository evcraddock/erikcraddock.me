# Test: Note Create Error Cases

Test error handling for invalid inputs.

## Missing Slug

```bash
cd cli
bun run src/index.ts note create --content "Test content"
```

**Expected:**

```
❌ Missing required option: --slug
   Or add 'slug:' to frontmatter when using --file
```

## Missing Content

```bash
bun run src/index.ts note create --slug test
```

**Expected:**

```
❌ Missing required option: --content
   Or provide content in markdown file when using --file
```

## File Not Found

```bash
bun run src/index.ts note create --file /nonexistent/file.md
```

**Expected:**

```
❌ File not found: /nonexistent/file.md
```

## Empty File Content

```bash
cat > /tmp/empty-note.md << 'EOF'
---
slug: empty-test
---
EOF

bun run src/index.ts note create --file /tmp/empty-note.md
```

**Expected:**

```
❌ Missing required option: --content
   Or provide content in markdown file when using --file
```

## Cleanup

```bash
rm /tmp/empty-note.md 2>/dev/null || true
```
