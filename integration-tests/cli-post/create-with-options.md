# Test: Create Article with Options

Create an article with tags, excerpt, and JSON output.

## Command

```bash
cd cli
bun src/index.ts --config dev-config.yaml post create \
  --title "Tagged Test Post" \
  --slug tagged-test-post \
  --content "Content with tags" \
  --excerpt "A short summary" \
  --tags tech,testing
```

## Expected Output

```
✅ Post created: tagged-test-post
   Title: Tagged Test Post
   Type: article
   Status: draft
   Tags: tech, testing
```

## Verify with JSON

```bash
bun src/index.ts --config dev-config.yaml post show tagged-test-post --json
```

Should include `"tags": ["tech", "testing"]` and `"excerpt": "A short summary"`.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml post delete tagged-test-post --force
```
