# Test: Create Basic Article

Create a simple article with required fields only.

## Command

```bash
cd cli
bun run src/index.ts post create \
  --title "Integration Test Post" \
  --slug integration-test-post \
  --content "# Hello World\n\nThis is a test post created via CLI."
```

## Expected Output

```
✅ Post created: integration-test-post
   Title: Integration Test Post
   Type: article
   Status: draft
```

## Verify

```bash
bun run src/index.ts post show integration-test-post
```

Should display the post with correct title, slug, type, and content.

## Cleanup

```bash
bun run src/index.ts post delete integration-test-post --force
```
