# Test: Link Create Error Cases

Test error handling for invalid inputs.

## Missing URL

```bash
cd cli
bun src/index.ts --config dev-config.yaml link create --slug test --content "Test"
```

**Expected:**

```
❌ Missing required option: --url
   Or add 'url:' to frontmatter when using --file
```

## Missing Slug

```bash
bun src/index.ts --config dev-config.yaml link create --url "https://example.com" --content "Test"
```

**Expected:**

```
❌ Missing required option: --slug
   Or add 'slug:' to frontmatter when using --file
```

## Missing Content

```bash
bun src/index.ts --config dev-config.yaml link create --url "https://example.com" --slug test
```

**Expected:**

```
❌ Missing required option: --content
   Or provide content in markdown file when using --file
```

## Invalid Source ID

```bash
bun src/index.ts --config dev-config.yaml link create \
  --url "https://example.com" \
  --slug test \
  --content "Test" \
  --source "invalid"
```

**Expected:**

```
❌ Invalid source ID. Must be a positive integer.
```

## File Not Found

```bash
bun src/index.ts --config dev-config.yaml link create --file /nonexistent/file.md
```

**Expected:**

```
❌ File not found: /nonexistent/file.md
```
