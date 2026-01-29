# Integration Test: CLI Post Create

Test creating a post via the CLI against the dev environment.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI configured with API key

### Check dev environment

```bash
make dev-status
```

Expected: `app`, `css`, `docker` all showing as running.

### Check CLI configuration

```bash
cd cli && bun run src/index.ts config show
```

Expected: Shows `api_url` and `api_key` (masked).

If not configured, run:

```bash
bun run src/index.ts login
```

Set API URL to `http://localhost:5000/api` when prompted.

---

## Test Cases

### 1. Create a basic article

**Command:**

```bash
cd cli
bun run src/index.ts post create \
  --title "Integration Test Post" \
  --slug integration-test-post \
  --content "# Hello World\n\nThis is a test post created via CLI."
```

**Expected output:**

```
✅ Post created: integration-test-post
   Title: Integration Test Post
   Type: article
   Status: draft
```

**Verify via API:**

```bash
curl -s http://localhost:5000/api/posts/by-slug/integration-test-post \
  -H "Authorization: Bearer $(grep api_key ~/.config/ec/config.yaml | cut -d' ' -f2)" \
  | jq '.data | {slug, title, type, published_at}'
```

**Verify in browser:**

- Post should NOT appear on http://localhost:5000 (it's a draft)
- After publishing, should appear at http://localhost:5000/posts/integration-test-post

---

### 2. Create article with tags and excerpt

**Command:**

```bash
bun run src/index.ts post create \
  --title "Tagged Test Post" \
  --slug tagged-test-post \
  --content "Content with tags" \
  --excerpt "A short summary" \
  --tags tech,testing
```

**Expected output:**

```
✅ Post created: tagged-test-post
   Title: Tagged Test Post
   Type: article
   Status: draft
   Tags: tech, testing
```

---

### 3. Create with JSON output

**Command:**

```bash
bun run src/index.ts post create \
  --title "JSON Output Test" \
  --slug json-output-test \
  --content "Testing JSON output" \
  --json
```

**Expected:** JSON object with all post fields.

---

### 4. Error: Missing required slug

**Command:**

```bash
bun run src/index.ts post create \
  --title "No Slug Post" \
  --content "This should fail"
```

**Expected:**

```
❌ Missing required option: --slug
Run 'ec post create --help' for usage.
```

---

### 5. Error: Missing content

**Command:**

```bash
bun run src/index.ts post create \
  --title "No Content Post" \
  --slug no-content-post
```

**Expected:**

```
❌ Missing required option: --content
Run 'ec post create --help' for usage.
```

---

### 6. Error: Article without title

**Command:**

```bash
bun run src/index.ts post create \
  --slug no-title-article \
  --content "Article needs a title"
```

**Expected:**

```
❌ Articles require a title. Use --title option.
```

---

### 7. Error: Invalid slug format

**Command:**

```bash
bun run src/index.ts post create \
  --title "Bad Slug" \
  --slug "Invalid Slug With Spaces" \
  --content "This should fail"
```

**Expected:** Error from API about invalid slug format.

---

### 8. Error: Duplicate slug

**Command (run twice):**

```bash
bun run src/index.ts post create \
  --title "Duplicate Test" \
  --slug duplicate-slug-test \
  --content "First post"

bun run src/index.ts post create \
  --title "Duplicate Test 2" \
  --slug duplicate-slug-test \
  --content "Second post with same slug"
```

**Expected:** First succeeds, second fails with "Slug already exists" error.

---

## Cleanup

After testing, delete test posts:

```bash
bun run src/index.ts post delete integration-test-post --force
bun run src/index.ts post delete tagged-test-post --force
bun run src/index.ts post delete json-output-test --force
bun run src/index.ts post delete duplicate-slug-test --force
```

Or list and delete all test posts:

```bash
bun run src/index.ts post list --status draft
```
